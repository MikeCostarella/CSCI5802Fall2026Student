// The Repositories tab's engine: the repos of the course's GitHub org
// (COURSE.participantsOrg), cloned under reposRoot(), managed with plain git.
//
// Same shape as StatehouseUI's git.mjs + routes.mjs, with two deliberate
// differences:
//   - The repo list comes from GitHub (gh api orgs/<org>/repos), not from a
//     hand-maintained manifest. The org IS the manifest: a repo that is not
//     in the org cannot be touched by any endpoint here.
//   - Commits run through git directly (add -A / commit / push), not through
//     Statehouse's commit.ps1, so this app has no dependency on Statehouse.
//
// Student edition: the list is the org's repos PLUS your own fork of the
// starter (from your profile's GitHub handle). Clones live under the folder
// chosen on the Setup tab (default %USERPROFILE%\CSCI5802\<org>).
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { COURSE } from "./course.mjs";
import { runGh } from "./gh.mjs";
import { reposRoot } from "./repos-root.mjs";
import { readDoc } from "./store.mjs";

const pExecFile = promisify(execFile);

// ---------------------------------------------------------------------------
// git plumbing (ported from StatehouseUI/server/git.mjs)
// ---------------------------------------------------------------------------

export async function git(repoPath, args, opts = {}) {
  try {
    const { stdout } = await pExecFile("git", ["--no-optional-locks", "-C", repoPath, ...args], {
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, // else every git child pops a console window
      ...(opts.timeout ? { timeout: opts.timeout } : {}),
      ...(opts.env ? { env: { ...process.env, ...opts.env } } : {}),
    });
    return { ok: true, out: stdout };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || e.message || "") };
  }
}

/** Run fn over items with at most `limit` in flight at once, preserving order. */
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function firstLine(s) { return String(s || "").trim().split("\n")[0] || ""; }

// ---------------------------------------------------------------------------
// The org's repo list (the safety boundary), cached in memory
// ---------------------------------------------------------------------------

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
let cache = { at: 0, repos: null, error: null };
const CACHE_MS = 5 * 60 * 1000;

/** Ask gh for every repo in the org. One object per line so --paginate is safe. */
async function fetchOrgRepos() {
  const jq = ".[] | {name, full_name, default_branch, private, fork, archived, pushed_at, html_url, description, has_pages, owner: .owner.login}";
  const r = await runGh(["api", `orgs/${COURSE.participantsOrg}/repos?per_page=100&type=all`, "--paginate", "--jq", jq]);
  if (!r.ok) throw new Error(firstLine(r.err) || `gh api orgs/${COURSE.participantsOrg}/repos failed`);
  const repos = r.out.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))
    .filter((e) => SAFE_NAME.test(e.name))
    // Project sites live at https://<owner>.github.io/<repo>/ when Pages is on.
    .map((e) => ({ ...e, pagesUrl: e.has_pages ? `https://${String(e.owner).toLowerCase()}.github.io/${e.name}/` : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return repos;
}

/** Your fork of the starter, as one more list entry (null when there is none). */
async function myForkEntry(taken) {
  let handle = String(readDoc("profile", {}).github || "").trim();
  if (!handle) {
    const me = await runGh(["api", "user", "--jq", ".login"]);
    handle = me.ok ? me.out.trim() : "";
  }
  if (!handle || taken.has(COURSE.starterRepo)) return null; // an org repo of the same name wins the folder
  const jq = "{name, full_name, default_branch, private, fork, archived, pushed_at, html_url, description, has_pages, owner: .owner.login}";
  const r = await runGh(["api", `repos/${handle}/${COURSE.starterRepo}`, "--jq", jq]);
  if (!r.ok) return null;
  try {
    const e = JSON.parse(r.out);
    return { ...e, mine: true, pagesUrl: e.has_pages ? `https://${String(e.owner).toLowerCase()}.github.io/${e.name}/` : null };
  } catch { return null; }
}

export async function orgRepos({ refresh = false } = {}) {
  if (!refresh && cache.repos && Date.now() - cache.at < CACHE_MS) return cache.repos;
  try {
    const repos = await fetchOrgRepos();
    const fork = await myForkEntry(new Set(repos.map((r) => r.name)));
    if (fork) repos.unshift(fork);
    cache = { at: Date.now(), repos, error: null };
    return repos;
  } catch (e) {
    cache.error = String(e.message || e);
    if (cache.repos) return cache.repos; // stale beats nothing when GitHub is unreachable
    throw e;
  }
}

/** Resolve a repo name to its entry + local path, or null if it is not in the org. */
export async function resolveRepo(name) {
  if (!SAFE_NAME.test(String(name || ""))) return null;
  const entry = (await orgRepos()).find((r) => r.name === name);
  if (!entry) return null;
  return { entry, repoPath: path.join(reposRoot(), entry.name) };
}

/** Names not in the org, or null when all are known. */
export async function unknownRepos(names) {
  const known = new Set((await orgRepos()).map((r) => r.name));
  const unknown = names.filter((n) => !known.has(n));
  return unknown.length ? unknown : null;
}

// ---------------------------------------------------------------------------
// Status: local git state + GitHub signals, one row per org repo
// ---------------------------------------------------------------------------

function hasWorkflow(repoPath) {
  try {
    return fs.readdirSync(path.join(repoPath, ".github", "workflows"))
      .some((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  } catch { return false; }
}

export async function localStatus(entry) {
  const repoPath = path.join(reposRoot(), entry.name);
  const row = { state: "clean", cloned: true, branch: "", dirty: 0, ahead: 0, behind: 0, flags: [], hasWorkflow: false };
  if (!fs.existsSync(repoPath)) { row.state = "NOT-CLONED"; row.cloned = false; return row; }
  if (!fs.existsSync(path.join(repoPath, ".git"))) { row.state = "NO-GIT"; return row; }

  row.hasWorkflow = hasWorkflow(repoPath);

  // -uall lists every untracked file individually; without it git collapses a
  // whole new directory into one "??" line.
  const porcelain = await git(repoPath, ["status", "--porcelain", "-uall"]);
  row.dirty = porcelain.ok ? porcelain.out.split("\n").filter((l) => l.trim()).length : 0;

  const branch = await git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  row.branch = branch.ok ? branch.out.trim() : "";

  const counts = await git(repoPath, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  if (counts.ok) {
    const [behind, ahead] = counts.out.trim().split(/\s+/).map(Number);
    row.behind = behind || 0; row.ahead = ahead || 0;
  } else { row.flags.push("no-upstream"); }

  if (fs.existsSync(path.join(repoPath, ".git", "index.lock"))) row.flags.push("index.lock");

  if (row.dirty > 0) row.state = "DIRTY";
  else if (row.ahead > 0) row.state = "UNPUSHED";
  else if (row.behind > 0) row.state = "BEHIND";
  else if (row.flags.length > 0) row.state = "FLAGS";
  return row;
}

/** Open PR count and latest Actions conclusion, via gh. Null on any failure. */
export async function githubSignals(entry) {
  const [prs, ci] = await Promise.all([
    runGh(["api", `repos/${entry.full_name}/pulls?state=open&per_page=100`, "--jq", "length"]),
    // The CI workflow's newest run, not just the newest run of anything: a
    // repo with a deploy workflow would otherwise report the deploy's fate
    // under a column labelled CI. Falls back to any workflow when there is no CI.
    runGh(["api", `repos/${entry.full_name}/actions/runs?per_page=20`, "--jq", '(([.workflow_runs[] | select((.name | ascii_downcase) == "ci" or (.path | endswith("/ci.yml")))] | .[0]) // .workflow_runs[0]) | .conclusion // "none"']),
  ]);
  return {
    openPrs: prs.ok ? Number(prs.out.trim()) : null,
    ci: ci.ok ? ci.out.trim() : null,
  };
}

export async function repoRow(entry, { signals = true } = {}) {
  const [local, gh] = await Promise.all([
    localStatus(entry),
    signals ? githubSignals(entry) : Promise.resolve({ openPrs: null, ci: null }),
  ]);
  return {
    name: entry.name,
    fullName: entry.full_name,
    url: entry.html_url,
    description: entry.description || "",
    defaultBranch: entry.default_branch,
    private: !!entry.private,
    mine: !!entry.mine,
    fork: !!entry.fork,
    archived: !!entry.archived,
    pushedAt: entry.pushed_at,
    pagesUrl: entry.pagesUrl ?? null,
    ...local,
    ...gh,
  };
}

export async function allRepoRows({ refresh = false, signals = true } = {}) {
  const repos = await orgRepos({ refresh });
  const rows = await mapPool(repos, 4, (e) => repoRow(e, { signals }));
  return { org: COURSE.participantsOrg, root: reposRoot(), generated: new Date().toISOString(),
           listError: cache.error, repos: rows };
}

// ---------------------------------------------------------------------------
// Operations. Each returns { repo, kind, detail } so the UI can tally them.
// ---------------------------------------------------------------------------

export async function cloneOne(name) {
  const r = await resolveRepo(name);
  if (!r) return { repo: name, kind: "error", detail: "not in the org" };
  const { entry, repoPath } = r;
  if (fs.existsSync(repoPath)) return { repo: name, kind: "current", detail: "already cloned" };
  fs.mkdirSync(reposRoot(), { recursive: true });
  const cloneUrl = `https://github.com/${entry.full_name}.git`;
  const res = await git(reposRoot(), ["clone", cloneUrl, repoPath], { timeout: 300_000, env: { GIT_TERMINAL_PROMPT: "0" } });
  if (!res.ok) return { repo: name, kind: "error", detail: firstLine(res.out) };
  return { repo: name, kind: "updated", detail: `cloned into ${repoPath}` };
}

/** Conservative update: fetch, then fast-forward only; dirty repos are left alone. */
export async function pullOne(name) {
  const r = await resolveRepo(name);
  if (!r) return { repo: name, kind: "error", detail: "not in the org" };
  const { repoPath } = r;
  if (!fs.existsSync(path.join(repoPath, ".git"))) return { repo: name, kind: "skipped", detail: "not cloned" };

  const dirty = await git(repoPath, ["status", "--porcelain", "-uall"]);
  if (!dirty.ok) return { repo: name, kind: "error", detail: firstLine(dirty.out) };
  const pending = dirty.out.split("\n").filter((l) => l.trim());
  if (pending.length) return { repo: name, kind: "skipped", detail: `${pending.length} uncommitted change(s) - left untouched` };

  // GIT_TERMINAL_PROMPT=0 so a repo needing credentials fails instead of hanging.
  const fetched = await git(repoPath, ["fetch", "--prune"], { timeout: 120_000, env: { GIT_TERMINAL_PROMPT: "0" } });
  if (!fetched.ok) return { repo: name, kind: "error", detail: firstLine(fetched.out) };

  const upstream = await git(repoPath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  if (!upstream.ok) return { repo: name, kind: "error", detail: "no upstream branch configured" };

  const counts = await git(repoPath, ["rev-list", "--left-right", "--count", "HEAD...@{u}"]);
  if (!counts.ok) return { repo: name, kind: "error", detail: firstLine(counts.out) };
  const [ahead, behind] = counts.out.trim().split(/\s+/).map(Number);

  if (!behind) return { repo: name, kind: "current", detail: ahead ? `already current (${ahead} unpushed)` : "already current" };
  if (ahead) return { repo: name, kind: "diverged", detail: `${ahead} ahead, ${behind} behind - needs a manual rebase or merge` };

  const merged = await git(repoPath, ["merge", "--ff-only", "@{u}"]);
  if (!merged.ok) return { repo: name, kind: "error", detail: firstLine(merged.out) };
  return { repo: name, kind: "updated", detail: `fast-forwarded ${behind} commit(s)` };
}

/**
 * Commit everything in one repo. Dry run only reports what WOULD be added.
 * Events are emitted through `emit` so the UI log reads like a console.
 */
export async function commitOne(name, { summary, description, push, dryRun }, emit) {
  const r = await resolveRepo(name);
  if (!r) return { repo: name, kind: "error", detail: "not in the org" };
  const { repoPath } = r;
  if (!fs.existsSync(path.join(repoPath, ".git"))) return { repo: name, kind: "skipped", detail: "not cloned" };
  if (fs.existsSync(path.join(repoPath, ".git", "index.lock"))) {
    return { repo: name, kind: "skipped", detail: "stale .git/index.lock (delete it, then retry)" };
  }

  const status = await git(repoPath, ["status", "--porcelain", "-uall"]);
  if (!status.ok) return { repo: name, kind: "error", detail: firstLine(status.out) };
  const files = status.out.split("\n").filter((l) => l.trim());
  if (files.length === 0) return { repo: name, kind: "current", detail: "nothing to commit" };

  emit(`=== ${name} ===`);
  for (const f of files) emit(`  ${f}`);
  if (dryRun) return { repo: name, kind: "skipped", detail: `dry run: ${files.length} file(s) would be committed` };

  const added = await git(repoPath, ["add", "-A"]);
  if (!added.ok) return { repo: name, kind: "error", detail: firstLine(added.out) };

  const args = ["commit", "-m", summary];
  if (description && description.trim()) args.push("-m", description.trim());
  const committed = await git(repoPath, args);
  if (!committed.ok) return { repo: name, kind: "error", detail: firstLine(committed.out) };
  emit(`  ${firstLine(committed.out)}`);

  if (!push) return { repo: name, kind: "updated", detail: `committed ${files.length} file(s) (not pushed)` };
  const pushed = await git(repoPath, ["push"], { timeout: 120_000, env: { GIT_TERMINAL_PROMPT: "0" } });
  if (!pushed.ok) return { repo: name, kind: "error", detail: `committed, but push failed: ${firstLine(pushed.out)}` };
  return { repo: name, kind: "updated", detail: `committed ${files.length} file(s) and pushed` };
}

export async function pushOne(name) {
  const r = await resolveRepo(name);
  if (!r) return { repo: name, ok: false, output: "not in the org" };
  const res = await git(r.repoPath, ["push"], { timeout: 120_000, env: { GIT_TERMINAL_PROMPT: "0" } });
  return { repo: name, ok: res.ok, output: res.out.trim() };
}

/** Discard = stash, never delete. Recoverable with `git stash pop`. */
export async function discardOne(name, stamp) {
  const r = await resolveRepo(name);
  if (!r) return { repo: name, ok: false, output: "not in the org" };
  const { repoPath } = r;
  if (fs.existsSync(path.join(repoPath, ".git", "index.lock"))) {
    return { repo: name, ok: false, output: "skipped: stale .git/index.lock (delete it, then retry)" };
  }
  const res = await git(repoPath, ["stash", "push", "--include-untracked", "-m", `CSCI5802 Management discard ${stamp}`]);
  if (!res.ok) return { repo: name, ok: false, output: res.out.trim() };
  if (/No local changes to save/i.test(res.out)) return { repo: name, ok: true, output: "no changes to discard" };
  const ref = await git(repoPath, ["rev-parse", "--short", "stash@{0}"]);
  return { repo: name, ok: true, output: `stashed as ${ref.ok ? ref.out.trim() : "stash@{0}"} - recover with: git stash pop` };
}

// ---------------------------------------------------------------------------
// Read-only inspection
// ---------------------------------------------------------------------------

/** Working-tree changes as { path, status }[]; renames report the new name. */
export async function changes(repoPath) {
  const res = await git(repoPath, ["status", "--porcelain", "-uall"]);
  if (!res.ok) throw new Error(firstLine(res.out));
  return res.out.split("\n").filter((l) => l.trim()).map((line) => {
    const status = line.slice(0, 2).trim() || "??";
    let p = line.slice(3);
    if (p.includes(" -> ")) p = p.split(" -> ").pop();
    if (p.startsWith('"') && p.endsWith('"')) p = JSON.parse(p);
    return { path: p, status };
  });
}

/** Reject absolute paths and any `..` segment. Returns the safe relative path or null. */
export function safeRelPath(rel) {
  const s = String(rel || "").replace(/\\/g, "/");
  if (!s || s.startsWith("/") || /^[A-Za-z]:/.test(s)) return null;
  if (s.split("/").some((seg) => seg === "..")) return null;
  return s;
}

export async function diff(repoPath, rel) {
  const tracked = await git(repoPath, ["ls-files", "--error-unmatch", "--", rel]);
  const res = tracked.ok
    ? await git(repoPath, ["diff", "HEAD", "--", rel])
    : await git(repoPath, ["diff", "--no-index", "--", "/dev/null", rel]); // exits 1 when files differ; that is the diff
  return res.out.replace(/\nCommand failed:[\s\S]*$/, "");
}

/** Last N commits, oldest last. */
export async function log(repoPath, n = 30) {
  const res = await git(repoPath, ["log", `-${n}`, "--date=short", "--pretty=format:%h%x09%ad%x09%an%x09%s"]);
  if (!res.ok) throw new Error(firstLine(res.out));
  return res.out.split("\n").filter(Boolean).map((l) => {
    const [sha, date, author, ...subject] = l.split("\t");
    return { sha, date, author, subject: subject.join("\t") };
  });
}

export function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}
