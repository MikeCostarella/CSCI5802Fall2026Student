export interface Course {
  code: string; title: string; term: string; institution: string; owner: string;
  starterRepo: string; courseSiteRepo: string; studentRepo: string;
  courseSiteUrl: string; lmsUrl: string; directoryPath: string; dataFolder: string; participantsOrg: string;
  host: string; dataDir: string;
}

export interface Profile { name: string; github: string; email: string; reposRoot?: string; }
export interface GhStatus { installed: boolean; authed: boolean; login: string | null; name?: string | null; }
export interface ProfileView { profile: Profile; gh: GhStatus; directoryEntry: Profile; }

export interface Sprint {
  id: string; kind: "lab" | "checkpoint" | "final"; title: string; module?: string;
  due: string; start: string; spec: string; daysLeft: number;
}

export interface OpenPr { number: number; title: string; html_url: string; created_at: string; }
export interface Fork {
  exists: boolean; url?: string; pushedAt?: string; branch?: string;
  commits?: number | null; prsOpen?: OpenPr[];
  ci?: { conclusion: string; status: string; url: string } | null;
  behind?: number | null; ahead?: number | null;
}
export interface MySprint { sprint: Sprint; github: string; fork: Fork; }

/** source: where the row came from - the shared directory, your own local list, or both. */
export interface Classmate { name: string; github: string; email: string; me: boolean; source: "directory" | "mine" | "both"; }
export interface ClassmateFields { name: string; github: string; email: string; }
export interface DirectoryView {
  entries: Classmate[]; error: string | null; directoryMissing: boolean; fetchedAt: string | null; listed: boolean; mineCount: number;
  directoryUrl: string; editUrl: string; entry: Profile;
}

export interface TeamsLinks {
  emails: string[]; missing: string[]; subject: string;
  call: { app: string; web: string }; chat: { app: string; web: string }; mailto: string;
}

export interface Upstream { repo: string; url: string; commits: { sha: string; message: string; date: string; url: string }[]; }

// ---- Repositories tab (appended to types.ts) ----

export type RepoState = "clean" | "DIRTY" | "UNPUSHED" | "BEHIND" | "FLAGS" | "NOT-CLONED" | "NO-GIT" | "PENDING";

export interface RepoRow {
  name: string; fullName: string; url: string; description: string;
  defaultBranch: string; private: boolean; fork: boolean; archived: boolean;
  /** Your own fork of the starter, listed alongside the org's repos. */
  mine: boolean;
  pushedAt: string | null;
  pagesUrl: string | null;
  // local git
  state: RepoState; cloned: boolean; branch: string;
  dirty: number; ahead: number; behind: number; flags: string[]; hasWorkflow: boolean;
  // GitHub signals (null when gh could not answer)
  openPrs: number | null; ci: string | null;
}

export interface ReposResponse {
  org: string; root: string; generated: string; listError: string | null; repos: RepoRow[];
}

export type RepoEvent =
  | { type: "start"; total: number }
  | { type: "line"; text: string }
  | { type: "repo"; repo: string; kind: "updated" | "current" | "skipped" | "diverged" | "error"; detail: string }
  | { type: "done"; tally: Record<string, number>; batch?: string };

export interface ChromeProfile {
  dir: string; pinned: boolean; name: string; email: string | null; hasPicture: boolean;
}

export interface ChromeProfile {
  dir: string; pinned: boolean; name: string; email: string | null; hasPicture: boolean;
}

export interface RepoChange { path: string; status: string; }

// Deploys drawer
export interface BatchRepoResult { repo: string; action: string; detail?: string; repoUrl?: string | null; }
export interface Batch {
  id: string; applied: string; dryRun: boolean; summary: string; description: string; push: boolean;
  results: BatchRepoResult[];
}
export interface BatchListEntry { id: string; applied: string; dryRun: boolean; summary: string; repoCount: number; }
export interface DeployRow {
  repo: string; pagesUrl: string | null; runId?: number | null;
  status: string; conclusion?: string | null; title?: string; workflow?: string;
  updatedAt?: string | null; url?: string | null; detail?: string;
}
export interface RunDetail {
  repo: string; runId: number; name: string; title: string; status: string; conclusion: string | null;
  event: string; createdAt: string | null; updatedAt: string | null; headSha: string; url: string | null;
  jobs: { name: string; status: string; conclusion: string | null }[];
  failedLog: string | null;
}
export interface RepoCommit { sha: string; date: string; author: string; subject: string; }
