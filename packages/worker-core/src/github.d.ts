export interface GitHubClientOptions {
  token?: string;
  owner: string;
  repo: string;
  ref?: string;
  userAgent: string;
  apiBase?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxContentBytes?: number;
  fetchTarget?: typeof fetch;
}

export type GitHubFailure = {
  ok: false;
  status: number;
  code?: string;
  error: string;
  path?: string;
};

export type GitHubResult<T extends object> = ({ ok: true } & T) | GitHubFailure;

export interface GitHubClient {
  dispatchWorkflow(workflow: string, inputs?: Record<string, unknown>, ref?: string): Promise<GitHubResult<{ status: number; workflow: string }>>;
  getTextFile(path: string, ref?: string): Promise<GitHubResult<{ path: string; sha: string; content: string }>>;
  listDirectory(path: string, ref?: string): Promise<GitHubResult<{ entries: Array<{ name: string; path: string; type: string; sha: string }> }>>;
  putTextFile(path: string, content: string, message?: string, sha?: string): Promise<GitHubResult<{ path: string; contentSha: string; commitSha: string; commitUrl: string }>>;
  putBase64File(path: string, content: string, message?: string, sha?: string): Promise<GitHubResult<{ path: string; contentSha: string; commitSha: string; commitUrl: string }>>;
  putTextFiles(files: Array<{ path?: string; filePath?: string; content: string; expectedSha?: string; sha?: string }>, message?: string): Promise<GitHubResult<{ paths: string[]; commitSha?: string; commitUrl?: string; updated?: number; skipped?: boolean; reason?: string }>>;
  deleteFile(path: string, message?: string): Promise<GitHubResult<{ path: string; deleted: boolean; skipped?: boolean; reason?: string; commitSha?: string; commitUrl?: string }>>;
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient;
