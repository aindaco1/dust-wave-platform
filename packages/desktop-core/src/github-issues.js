// Extracted from the characterized crash relay. Product formatting and provider authentication are injected.
export function createGitHubIssueReporter({ request, issueTitle, issueBody, groupingSummary,
  checkDailyIssueLimit, shouldUpdateIssue, owner, repository, defaultLabels,
  markers = { state: 'crash-report-state', fingerprint: 'crash-fingerprint' } }) {
  if (!owner || !repository) throw new TypeError('A fixed issue destination is required');
  for (const name of [markers.state, markers.fingerprint]) {
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(name)) throw new TypeError('Invalid issue marker');
  }
  const githubRequest = request;
  function repoConfig(env) {
    return { owner: String(env.GITHUB_OWNER || owner), repo: String(env.GITHUB_REPO || repository) };
  }
  function labels(env) {
    return String(env.CRASH_LABELS || defaultLabels).split(',').map(label => label.trim()).filter(Boolean);
  }
function stateMarker(state) {
  return `<!-- ${markers.state}:${btoa(JSON.stringify(state))} -->`;
}

function fingerprintMarker(fingerprint) {
  return `<!-- ${markers.fingerprint}:${fingerprint} -->`;
}

function parseState(body, fingerprint) {
  const marker = String(body || '').match(new RegExp(`<!-- ${markers.state}:([A-Za-z0-9+/=]+) -->`));
  if (!marker) {
    return {
      fingerprint,
      count: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: null,
      versions: {},
      platforms: {},
      grouping: null
    };
  }
  try {
    return {
      fingerprint,
      count: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: null,
      versions: {},
      platforms: {},
      grouping: null,
      ...JSON.parse(atob(marker[1]))
    };
  } catch {
    return {
      fingerprint,
      count: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: null,
      versions: {},
      platforms: {},
      grouping: null
    };
  }
}

function platformKey(sanitized) {
  return [sanitized?.app?.os || 'unknown', sanitized?.app?.arch || 'unknown']
    .map((part) => String(part || 'unknown').slice(0, 80))
    .join('/');
}

function incrementCount(map, key) {
  const out = { ...(map || {}) };
  const boundedKey = String(key || 'unknown').slice(0, 160);
  out[boundedKey] = Number(out[boundedKey] || 0) + 1;
  return out;
}

function updateAggregateState(state, sanitized, fingerprint, now) {
  state.fingerprint = fingerprint;
  state.grouping = groupingSummary(sanitized);
  state.count = Number(state.count || 0) + 1;
  state.lastSeen = now;
  state.versions = incrementCount(state.versions, sanitized.app.version);
  state.platforms = incrementCount(state.platforms, platformKey(sanitized));
  return state;
}

async function findIndexedIssue(env, fingerprint) {
  if (!env.CRASH_INDEX) return null;
  const indexed = await env.CRASH_INDEX.get(`fp:${fingerprint}`, { type: 'json' }).catch(() => null);
  if (!indexed?.number) return null;
  return Number(indexed.number);
}

async function indexIssue(env, fingerprint, issue) {
  if (!env.CRASH_INDEX || !issue?.number) return;
  await env.CRASH_INDEX.put(`fp:${fingerprint}`, JSON.stringify({
    number: issue.number,
    url: issue.html_url || '',
    updatedAt: new Date().toISOString()
  }));
}

async function searchIssue(env, fingerprint, includeClosed = false) {
  const { owner, repo } = repoConfig(env);
  const q = encodeURIComponent(`repo:${owner}/${repo} is:issue ${includeClosed ? '' : 'is:open '}in:body ${fingerprint}`);
  const data = await githubRequest(env, `/search/issues?q=${q}&per_page=5`, { method: 'GET' });
  const item = (data.items || []).find((issue) => {
    if (includeClosed) return String(issue.body || '').includes(fingerprintMarker(fingerprint));
    return String(issue.title || '').includes(fingerprint) || String(issue.body || '').includes(fingerprint);
  }) || (includeClosed ? null : data.items?.[0]);
  return item?.number ? Number(item.number) : null;
}

async function getIssue(env, number) {
  const { owner, repo } = repoConfig(env);
  return githubRequest(env, `/repos/${owner}/${repo}/issues/${number}`, { method: 'GET' });
}

async function createIssue(env, sanitized, fingerprint, state, request = githubRequest) {
  if (await env.CRASH_CREATION_GUARD?.get(fingerprint)) {
    // The prior POST had an uncertain outcome. Search on retry must recover
    // its exact marker before another issue may be created.
    return { action: 'pending', status: 503, fingerprint };
  }
  const allowed = await (env.REPORT_DAILY_LIMIT ? env.REPORT_DAILY_LIMIT() : checkDailyIssueLimit(env));
  if (!allowed.ok) {
    return {
      action: 'limited',
      fingerprint,
      status: allowed.status,
      error: allowed.error
    };
  }
  const { owner, repo } = repoConfig(env);
  const body = {
    title: issueTitle(sanitized, fingerprint),
    body: (env.REPORT_ISSUE_BODY ?? issueBody)(sanitized, fingerprint, state),
    labels: labels(env)
  };
  let issue;
  await env.CRASH_CREATION_GUARD?.put(fingerprint, true);
  try {
    issue = await request(env, `/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  } catch (error) {
    // An uncertain POST may already have created the issue. Only a definite
    // invalid-label response permits a second creation request.
    if (!body.labels.length || error.status !== 422 || !error.errors?.some(item => item.field === 'labels')) {
      if (error.status >= 400 && error.status < 500) await env.CRASH_CREATION_GUARD?.put(fingerprint, false);
      throw error;
    }
    try {
      issue = await request(env, `/repos/${owner}/${repo}/issues`, {
        method: 'POST', body: JSON.stringify({ title: body.title, body: body.body })
      });
    } catch (retryError) {
      if (retryError.status >= 400 && retryError.status < 500) await env.CRASH_CREATION_GUARD?.put(fingerprint, false);
      throw retryError;
    }
  }
  await indexIssue(env, fingerprint, issue);
  return {
    action: 'created',
    fingerprint,
    issueNumber: issue.number,
    issueUrl: issue.html_url
  };
}

function issueUpdateBody(sanitized, fingerprint, state, reopen = false) {
  return {
    body: issueBody(sanitized, fingerprint, state),
    ...(reopen ? { state: 'open' } : {})
  };
}

async function updateIssue(env, number, sanitized, fingerprint, state, force = false, reopen = false, existing = '') {
  if (!force && !await shouldUpdateIssue(env, fingerprint)) {
    return {
      action: 'aggregated',
      fingerprint,
      issueNumber: number
    };
  }
  const { owner, repo } = repoConfig(env);
  const issue = await githubRequest(env, `/repos/${owner}/${repo}/issues/${number}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...(env.REPORT_ISSUE_BODY ? (reopen ? { state: "open" } : {}) : issueUpdateBody(sanitized, fingerprint, state, reopen)),
      ...(env.REPORT_ISSUE_BODY ? { body: env.REPORT_ISSUE_BODY(sanitized, fingerprint, state, existing) } : {}) })
  });
  await indexIssue(env, fingerprint, issue);
  return {
    action: 'updated',
    fingerprint,
    issueNumber: issue.number,
    issueUrl: issue.html_url
  };
}

async function submitCrashReport(env, sanitized, fingerprint, aggregateState = null) {
  const now = new Date().toISOString();
  let issueNumber = await findIndexedIssue(env, fingerprint);
  if (!issueNumber) issueNumber = await searchIssue(env, fingerprint, aggregateState !== null);

  if (issueNumber) {
    const issue = await getIssue(env, issueNumber);
    const state = parseState(issue.body, fingerprint);
    return updateIssue(env, issueNumber, sanitized, fingerprint,
      aggregateState ?? updateAggregateState(state, sanitized, fingerprint, now),
      aggregateState !== null, env.REPORT_REOPEN ? env.REPORT_REOPEN(issue, sanitized) : issue.state === 'closed', issue.body);
  }

  const state = aggregateState ?? updateAggregateState({
    fingerprint,
    count: 0,
    firstSeen: now,
    lastSeen: null,
    versions: {},
    platforms: {},
    grouping: null
  }, sanitized, fingerprint, now);
  return createIssue(env, sanitized, fingerprint, state);
}


  return { submitCrashReport, createIssue, updateAggregateState, stateMarker,
    fingerprintMarker, parseState, issueUpdateBody };
}
