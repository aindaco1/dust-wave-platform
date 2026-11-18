// Optional Markdown mirror. Authentication, reviewed content, durable record
// storage and serialization belong to the caller. No report receipt depends on it.
export function createGitHubIssueArtifactWriter({ request, maxBodyBytes = 65536,
  maxPages = 5, timeoutMS = 5000 }) {
  if (typeof request !== 'function') throw new TypeError('An injected request is required');
  for (const value of [maxBodyBytes, maxPages, timeoutMS]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Positive integer bounds are required');
  }

  return async function writeIssueArtifact(env, document, record) {
    const { owner, repository, issueNumber, key, name, body } = document;
    if (![owner, repository].every(value => typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value)
      && value !== '.' && value !== '..') || !Number.isSafeInteger(issueNumber) || issueNumber < 1) {
      throw new TypeError('A fixed artifact destination is required');
    }
    if (typeof key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(key)) {
      throw new TypeError('Invalid artifact identity');
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 160 || typeof body !== 'string') {
      throw new TypeError('A bounded artifact name and Markdown body are required');
    }
    const marker = `<!-- dustwave-issue-artifact:${key} -->`;
    const content = `${marker}\n\n${body}`;
    if (new TextEncoder().encode(content).byteLength > maxBodyBytes) throw new RangeError('Artifact body exceeds byte budget');
    if (typeof record?.get !== 'function' || typeof record?.put !== 'function') {
      throw new TypeError('A durable artifact record is required');
    }

    const destination = JSON.stringify([owner, repository, issueNumber, key]);
    const saved = await record.get();
    if (saved && saved.destination !== destination) throw new Error('Artifact record destination mismatch');
    const path = `/repos/${owner}/${repository}/issues/${issueNumber}/artifacts`;
    const api = (suffix, method, payload) => request(env, path + suffix, {
      method, headers: { 'X-GitHub-Api-Version': '2026-03-10' },
      signal: AbortSignal.timeout(timeoutMS),
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const owns = artifact => typeof artifact?.body === 'string' && artifact.body.startsWith(`${marker}\n\n`);
    function validate(artifact, expectedNumber) {
      if (!Number.isSafeInteger(artifact?.number) || artifact.number < 1 || artifact.type !== 'generic'
        || !owns(artifact) || (expectedNumber !== undefined && artifact.number !== expectedNumber)) {
        throw new Error('Unconfirmed artifact identity');
      }
      return artifact;
    }

    let artifact;
    if (saved?.number !== undefined) {
      if (!Number.isSafeInteger(saved.number) || saved.number < 1) throw new Error('Invalid artifact record');
      // A deleted or repurposed document requires operator review, not recreation.
      artifact = validate((await api(`/${saved.number}`, 'GET'))?.artifact, saved.number);
    } else {
      // This API has no Link header. Only a short page confirms completeness.
      for (let page = 1; page <= maxPages; page++) {
        const items = await api(`?per_page=100&page=${page}`, 'GET');
        if (!Array.isArray(items) || items.length > 100) throw new Error('Invalid artifact listing');
        if (items.some(item => !Number.isSafeInteger(item?.number) || item.number < 1
          || typeof item.body !== 'string' || typeof item.name !== 'string')) {
          throw new Error('Invalid artifact listing');
        }
        for (const item of items.filter(owns)) {
          if (artifact) throw new Error('Ambiguous artifact identity');
          artifact = validate(item);
        }
        if (items.length < 100) break;
        if (page === maxPages) throw new Error('Artifact listing exceeds page budget');
      }
      if (artifact) await record.put({ destination, number: artifact.number });
    }

    if (artifact) {
      if (artifact.name === name && artifact.body === content) {
        return { action: 'unchanged', artifactNumber: artifact.number };
      }
      const updated = validate(await api(`/${artifact.number}`, 'PATCH', { name, body: content }), artifact.number);
      if (updated.name !== name || updated.body !== content) throw new Error('Unconfirmed artifact content');
      return { action: 'updated', artifactNumber: artifact.number };
    }

    if (saved?.pending) throw new Error('Artifact creation is unconfirmed');
    await record.put({ destination, pending: true });
    let created;
    try {
      created = await api('', 'POST', { type: 'generic', name, body: content });
    } catch (error) {
      // Timeout, transport errors and server errors can hide a committed create.
      // Clear intent only for a definite rejection; never retry within this call.
      if ([400, 401, 403, 404, 410, 422, 429].includes(error?.status)) {
        await record.put({ destination, pending: false });
      }
      throw error;
    }
    validate(created);
    if (created.name !== name || created.body !== content) throw new Error('Unconfirmed artifact content');
    await record.put({ destination, number: created.number });
    return { action: 'created', artifactNumber: created.number };
  };
}
