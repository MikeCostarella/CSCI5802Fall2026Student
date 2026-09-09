// Repositories tab plumbing: JSON endpoints plus the NDJSON stream reader
// (ported from StatehouseUI's api.ts) for the long-running operations.
import type { Batch, BatchListEntry, DeployRow, RepoChange, RepoCommit, RepoEvent, ReposResponse, RunDetail } from "./types";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
  return r.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
  return r.json();
}

export const fetchRepos = (opts: { refresh?: boolean; signals?: boolean } = {}) =>
  get<ReposResponse>(`/api/repos?refresh=${opts.refresh ? 1 : 0}&signals=${opts.signals === false ? 0 : 1}`);

export const fetchRepoChanges = (repo: string) =>
  get<{ repo: string; files: RepoChange[] }>(`/api/repos/changes?repo=${encodeURIComponent(repo)}`);

export const fetchRepoLog = (repo: string) =>
  get<{ repo: string; commits: RepoCommit[] }>(`/api/repos/log?repo=${encodeURIComponent(repo)}`);

export async function fetchRepoDiff(repo: string, path: string): Promise<string> {
  const r = await fetch(`/api/repos/diff?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
  return r.text();
}

export const openRepo = (repo: string | null, shell: "explorer" | "cmd" | "powershell" | "code") =>
  post<{ ok: true; cwd: string }>("/api/repos/open", { repo, shell });

export const fetchBatches = () => get<{ batches: BatchListEntry[] }>("/api/repos/batches");
export const fetchBatch = (id: string) => get<Batch>(`/api/repos/batch?id=${encodeURIComponent(id)}`);
export const fetchDeploys = (repos: string[]) => post<{ generated: string; rows: DeployRow[] }>("/api/repos/deploys", { repos });
export const fetchRunDetail = (repo: string, runId: number) =>
  get<RunDetail>(`/api/repos/run-detail?repo=${encodeURIComponent(repo)}&runId=${runId}`);
export const rerunFailed = (repo: string, runId: number) => post<{ ok: true }>("/api/repos/run-rerun", { repo, runId });

export interface OpResult { repo: string; ok: boolean; output: string; }
export const pushRepos = (repos: string[]) => post<{ results: OpResult[] }>("/api/repos/push", { repos });
export const discardRepos = (repos: string[]) => post<{ results: OpResult[] }>("/api/repos/discard", { repos });

/**
 * POST and read the NDJSON reply line by line. Errors before the stream
 * starts still arrive as one JSON object, so they are thrown as usual.
 */
async function stream(url: string, body: unknown, onEvent: (e: RepoEvent) => void): Promise<void> {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const problem = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(problem.error || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep the partial line for the next chunk
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as RepoEvent);
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as RepoEvent);
}

export const cloneRepos = (repos: string[], onEvent: (e: RepoEvent) => void) =>
  stream("/api/repos/clone", { repos }, onEvent);
export const pullRepos = (repos: string[], onEvent: (e: RepoEvent) => void) =>
  stream("/api/repos/pull", { repos }, onEvent);
export const commitRepos = (
  args: { repos: string[]; summary: string; description: string; push: boolean; dryRun: boolean },
  onEvent: (e: RepoEvent) => void,
) => stream("/api/repos/commit", args, onEvent);
