import { fetchWithTimeout } from './provider-fetch.js';

const DEFAULT_API_BASE = 'https://api.github.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2_700_000;
const DEFAULT_MAX_CONTENT_BYTES = 2_000_000;
const DEFAULT_API_VERSION = '2022-11-28';

export function createGitHubClient(options = {}) {
  const token = boundedString(options.token, 16_384);
  const owner = requiredSlug(options.owner, 'owner');
  const repo = requiredSlug(options.repo, 'repo');
  const ref = requiredRef(options.ref || 'main');
  const userAgent = requiredUserAgent(options.userAgent);
  const apiBase = normalizedApiBase(options.apiBase || DEFAULT_API_BASE);
  const timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeoutMs');
  const maxResponseBytes = positiveInteger(
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    'maxResponseBytes'
  );
  const maxContentBytes = positiveInteger(
    options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES,
    'maxContentBytes'
  );
  const fetchTarget = options.fetchTarget || globalThis.fetch;

  const headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    accept: 'application/vnd.github+json',
    'x-github-api-version': DEFAULT_API_VERSION,
    'content-type': 'application/json',
    'user-agent': userAgent
  };
  const repoBase = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  async function request(path, init = {}) {
    let response;
    try {
      response = await fetchWithTimeout(
        `${repoBase}${path}`,
        { redirect: 'error', ...init, headers: { ...headers, ...init.headers } },
        timeoutMs,
        { fetchTarget }
      );
    } catch (error) {
      return {
        ok: false,
        status: 502,
        code: error?.name === 'AbortError' ? 'github_timeout' : 'github_request_failed',
        error: error?.name === 'AbortError' ? 'GitHub request timed out' : 'Unable to reach GitHub'
      };
    }

    const body = await readBoundedText(response, maxResponseBytes);
    if (!body.ok) return { ...body, status: 502 };
    let data = {};
    if (body.text) {
      try {
        data = JSON.parse(body.text);
      } catch {
        return {
          ok: false,
          status: response.ok ? 502 : response.status,
          code: 'github_invalid_response',
          error: 'GitHub returned an invalid response'
        };
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: 'github_api_error',
        error: boundedString(data?.message, 512) || `GitHub API error: ${response.status}`,
        data
      };
    }
    return { ok: true, status: response.status, data };
  }

  async function dispatchWorkflow(workflow, inputs = {}, dispatchRef = ref) {
    if (!token) return notConfigured();
    const workflowFile = requiredWorkflow(workflow);
    const result = await request(
      `/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
      {
        method: 'POST',
        body: JSON.stringify({ ref: requiredRef(dispatchRef), inputs: boundedInputs(inputs) })
      }
    );
    if (!result.ok) return result;
    if (result.status !== 204) {
      return { ok: false, status: 502, code: 'github_invalid_response', error: 'Unexpected GitHub workflow response' };
    }
    return { ok: true, status: 204, workflow: workflowFile };
  }

  async function getTextFile(filePath, readRef = ref) {
    const path = requiredPath(filePath);
    const result = await request(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(requiredRef(readRef))}`,
      { method: 'GET' }
    );
    if (!result.ok) return { ...result, path };
    const data = result.data;
    if (data?.encoding !== 'base64' || typeof data?.content !== 'string' || !data?.sha) {
      return unexpected('GitHub file', path);
    }
    if (data.content.length > Math.ceil(maxContentBytes * 4 / 3) + 16) {
      return tooLarge('GitHub file content', path);
    }
    let content;
    try {
      content = decodeUtf8Base64(data.content);
    } catch {
      return unexpected('GitHub file', path);
    }
    if (byteLength(content) > maxContentBytes) return tooLarge('GitHub file content', path);
    return { ok: true, path: data.path || path, sha: data.sha, content };
  }

  async function listDirectory(directoryPath, readRef = ref) {
    const path = requiredPath(directoryPath);
    const result = await request(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(requiredRef(readRef))}`,
      { method: 'GET' }
    );
    if (!result.ok) return { ...result, path };
    if (!Array.isArray(result.data)) return unexpected('GitHub directory', path);
    return {
      ok: true,
      entries: result.data.map((entry) => ({
        name: boundedString(entry?.name, 512),
        path: boundedString(entry?.path, 2_048),
        type: boundedString(entry?.type, 32),
        sha: boundedString(entry?.sha, 128)
      })).filter((entry) => entry.name && entry.path)
    };
  }

  async function putTextFile(filePath, content, message, sha) {
    if (byteLength(String(content ?? '')) > maxContentBytes) {
      return tooLarge('GitHub file content', String(filePath || ''));
    }
    return putBase64File(filePath, encodeUtf8Base64(content), message, sha);
  }

  async function putBase64File(filePath, base64Content, message, sha) {
    if (!token) return notConfigured();
    const path = requiredPath(filePath);
    const content = String(base64Content || '')
      .replace(/^data:[^;]+;base64,/, '')
      .replace(/\s+/g, '');
    if (content.length > Math.ceil(maxContentBytes * 4 / 3) + 16) {
      return tooLarge('GitHub file content', path);
    }
    const body = {
      message: boundedString(message, 4_096) || `Update ${path}`,
      content,
      branch: ref,
      ...(sha ? { sha: boundedString(sha, 128) } : {})
    };
    const result = await request(`/contents/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    if (!result.ok) return { ...result, path };
    return {
      ok: true,
      path: result.data?.content?.path || path,
      contentSha: result.data?.content?.sha || '',
      commitSha: result.data?.commit?.sha || '',
      commitUrl: result.data?.commit?.html_url || ''
    };
  }

  async function deleteFile(filePath, message) {
    if (!token) return notConfigured();
    const path = requiredPath(filePath);
    const current = await request(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
      { method: 'GET' }
    );
    if (!current.ok && current.status === 404) {
      return { ok: true, path, deleted: false, skipped: true, reason: 'not_found' };
    }
    if (!current.ok) return { ...current, path };
    if (!current.data?.sha) return unexpected('GitHub file', path);
    const result = await request(`/contents/${encodePath(path)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: boundedString(message, 4_096) || `Delete ${path}`,
        sha: current.data.sha,
        branch: ref
      })
    });
    if (!result.ok) return { ...result, path };
    return {
      ok: true,
      path: result.data?.content?.path || path,
      deleted: true,
      commitSha: result.data?.commit?.sha || '',
      commitUrl: result.data?.commit?.html_url || ''
    };
  }

  async function putTextFiles(files, message) {
    if (!token) return notConfigured();
    const normalized = normalizeBatchFiles(files, maxContentBytes);
    if (!normalized.ok) return normalized;
    if (normalized.files.length === 0) {
      return { ok: true, skipped: true, reason: 'No files to update', paths: [] };
    }
    const branch = normalizeBranchRef(ref);
    const encodedBranch = encodePath(branch);
    const refResult = await request(`/git/ref/heads/${encodedBranch}`, { method: 'GET' });
    if (!refResult.ok) return refResult;
    const baseCommitSha = boundedString(refResult.data?.object?.sha, 128);
    if (!baseCommitSha) return unexpected('GitHub branch');

    const commitResult = await request(`/git/commits/${encodeURIComponent(baseCommitSha)}`, { method: 'GET' });
    if (!commitResult.ok) return commitResult;
    const baseTreeSha = boundedString(commitResult.data?.tree?.sha, 128);
    if (!baseTreeSha) return unexpected('GitHub commit');

    for (const file of normalized.files) {
      if (!file.expectedSha) continue;
      const current = await request(
        `/contents/${encodePath(file.path)}?ref=${encodeURIComponent(baseCommitSha)}`,
        { method: 'GET' }
      );
      if (!current.ok) return { ...current, path: file.path };
      if (String(current.data?.sha || '') !== file.expectedSha) {
        return {
          ok: false,
          status: 409,
          path: file.path,
          code: 'github_file_changed',
          error: `${file.path} changed in GitHub before the batch commit could be created. Reload and try again.`
        };
      }
    }

    const tree = [];
    for (const file of normalized.files) {
      const blob = await request('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
      });
      if (!blob.ok) return { ...blob, path: file.path };
      const blobSha = boundedString(blob.data?.sha, 128);
      if (!blobSha) return unexpected('GitHub blob', file.path);
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blobSha });
    }

    const treeResult = await request('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree })
    });
    if (!treeResult.ok) return treeResult;
    const newTreeSha = boundedString(treeResult.data?.sha, 128);
    if (!newTreeSha) return unexpected('GitHub tree');

    const newCommit = await request('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: boundedString(message, 4_096) || `Update ${normalized.files.length} files`,
        tree: newTreeSha,
        parents: [baseCommitSha]
      })
    });
    if (!newCommit.ok) return newCommit;
    const newCommitSha = boundedString(newCommit.data?.sha, 128);
    if (!newCommitSha) return unexpected('GitHub commit creation');

    const update = await request(`/git/refs/heads/${encodedBranch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitSha, force: false })
    });
    if (!update.ok) return update;
    return {
      ok: true,
      paths: normalized.files.map((file) => file.path),
      commitSha: newCommitSha,
      commitUrl: newCommit.data?.html_url || `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
      updated: normalized.files.length
    };
  }

  return {
    dispatchWorkflow,
    getTextFile,
    listDirectory,
    putTextFile,
    putBase64File,
    putTextFiles,
    deleteFile
  };
}

function normalizeBatchFiles(files, maxContentBytes) {
  const normalized = [];
  const paths = new Set();
  for (const value of Array.isArray(files) ? files : []) {
    let path;
    try {
      path = requiredPath(value?.path || value?.filePath);
    } catch (error) {
      return { ok: false, status: 400, code: 'github_invalid_path', error: error.message };
    }
    if (paths.has(path)) {
      return { ok: false, status: 400, code: 'github_duplicate_path', error: `Duplicate GitHub file update path: ${path}` };
    }
    paths.add(path);
    const content = String(value?.content || '');
    if (byteLength(content) > maxContentBytes) return tooLarge('GitHub file content', path);
    normalized.push({
      path,
      content,
      expectedSha: boundedString(value?.expectedSha || value?.sha, 128)
    });
  }
  return { ok: true, files: normalized };
}

async function readBoundedText(response, maximumBytes) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    await response.body?.cancel().catch(() => {});
    return { ok: false, code: 'github_response_too_large', error: 'GitHub response exceeds the configured limit' };
  }
  if (!response.body) return { ok: true, text: '' };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, code: 'github_response_too_large', error: 'GitHub response exceeds the configured limit' };
    }
    text += decoder.decode(value, { stream: true });
  }
  return { ok: true, text: text + decoder.decode() };
}

function notConfigured() {
  return { ok: false, status: 503, code: 'github_not_configured', error: 'GitHub token not configured' };
}

function unexpected(subject, path) {
  return { ok: false, status: 502, code: 'github_invalid_response', ...(path ? { path } : {}), error: `Unexpected ${subject} response` };
}

function tooLarge(subject, path) {
  return { ok: false, status: 413, code: 'github_content_too_large', ...(path ? { path } : {}), error: `${subject} exceeds the configured limit` };
}

function requiredPath(value) {
  const path = boundedString(value, 2_048);
  if (!path || path.startsWith('/') || path.endsWith('/') || path.includes('\\')) {
    throw new TypeError('GitHub path must be a repository-relative file or directory path');
  }
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/u.test(part))) {
    throw new TypeError('GitHub path contains an invalid segment');
  }
  return path;
}

function requiredSlug(value, label) {
  const slug = boundedString(value, 100);
  if (!/^[A-Za-z0-9_.-]+$/u.test(slug)) throw new TypeError(`${label} is invalid`);
  return slug;
}

function requiredRef(value) {
  const ref = boundedString(value, 255);
  if (!ref || ref.startsWith('/') || ref.endsWith('/') || ref.includes('..') || /[~^:?*[\]\\\u0000-\u001f\u007f]/u.test(ref)) {
    throw new TypeError('ref is invalid');
  }
  return ref;
}

function normalizeBranchRef(value) {
  return requiredRef(value).replace(/^refs\/heads\//u, '').replace(/^heads\//u, '');
}

function requiredWorkflow(value) {
  const workflow = boundedString(value, 255);
  if (!workflow || workflow.includes('/') || !/^[A-Za-z0-9_.-]+$/u.test(workflow)) {
    throw new TypeError('workflow is invalid');
  }
  return workflow;
}

function requiredUserAgent(value) {
  const userAgent = boundedString(value, 255);
  if (!userAgent || /[\u0000-\u001f\u007f]/u.test(userAgent)) throw new TypeError('userAgent is invalid');
  return userAgent;
}

function normalizedApiBase(value) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new TypeError('apiBase must use HTTPS');
  url.pathname = url.pathname.replace(/\/+$/u, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/u, '');
}

function boundedInputs(inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new TypeError('inputs must be an object');
  const entries = Object.entries(inputs);
  if (entries.length > 25) throw new TypeError('inputs exceeds the configured limit');
  return Object.fromEntries(entries.map(([key, value]) => [
    requiredInputName(key),
    boundedString(value, 10_000)
  ]));
}

function requiredInputName(value) {
  const key = boundedString(value, 100);
  if (!/^[A-Za-z0-9_-]+$/u.test(key)) throw new TypeError('workflow input name is invalid');
  return key;
}

function encodePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeUtf8Base64(value) {
  const binary = atob(String(value || '').replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function boundedString(value, maximum) {
  const text = String(value ?? '').trim();
  return text.length <= maximum ? text : text.slice(0, maximum);
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer`);
  return value;
}
