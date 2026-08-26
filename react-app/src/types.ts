export interface Course {
  code: string; title: string; term: string; institution: string; owner: string;
  starterRepo: string; courseSiteRepo: string; studentRepo: string;
  courseSiteUrl: string; lmsUrl: string; directoryPath: string; dataFolder: string;
  host: string; dataDir: string;
}

export interface Profile { name: string; github: string; email: string; }
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

export interface Classmate { name: string; github: string; email: string; me: boolean; }
export interface DirectoryView {
  entries: Classmate[]; error: string | null; fetchedAt: string | null; listed: boolean;
  directoryUrl: string; editUrl: string; entry: Profile;
}

export interface TeamsLinks {
  emails: string[]; missing: string[]; subject: string;
  call: { app: string; web: string }; chat: { app: string; web: string }; mailto: string;
}

export interface Upstream { repo: string; url: string; commits: { sha: string; message: string; date: string; url: string }[]; }
