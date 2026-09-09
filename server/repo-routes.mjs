// /api/repos/* - the Repositories tab. Handlers only; the engine is repos.mjs.
// Long operations stream NDJSON (one JSON object per line) exactly like
// StatehouseUI, so the UI can show progress per repo instead of waiting.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { json, readBody } from "./routes.mjs";
import { reposRoot } from "./repos-root.mjs";
import {
  allRepoRows, changes, cloneOne, commitOne, diff, discardOne, log, pullOne, pushOne,
  resolveRepo, safeRelPath, timestamp, unknownRepos,
} from "./repos.mjs";
import { defaultProfileDir, profileInfo, profilePicturePath } from "./chrome-profile.mjs";
import { deployRows, getBatch, listBatches, recordBatch, rerunFailed, runDetail } from "./deploys.mjs";


/** Parse { repos: [...] } and refuse anything not in the org. Returns names or null (already responded). */
async function selectedRepos(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const repos = body.repos;
  if (!Array.isArray(repos) || repos.length === 0) { json(res, 400, { error: "no repos selected" }); return null; }
  const unknown = await unknownRepos(repos.map(String));
  if (unknown) { json(res, 400, { error: `not in the org: ${unknown.join(", ")}` }); return null; }
  return { repos: repos.map(String), body };
}

function startStream(res, total) {
  res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  send({ type: "start", total });
  return send;
}

/**
 * Run `fn` over the repos with a small pool, streaming each result and a final
 * tally. `finish(results)` may return extra fields for the done event.
 */
async function streamOp(res, repos, limit, fn, finish) {
  const send = startStream(res, repos.length);
  const tally = {};
  const results = [];
  let next = 0;
  async function worker() {
    while (next < repos.length) {
      const result = await fn(repos[next++], (text) => send({ type: "line", text }));
      tally[result.kind] = (tally[result.kind] ?? 0) + 1;
      results.push(result);
      send({ type: "repo", ...result });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, repos.length) }, worker));
  let extra = {};
  try { extra = finish ? (await finish(results)) ?? {} : {}; }
  catch (e) { send({ type: "line", text: `warning: ${String(e.message || e)}` }); }
  send({ type: "done", tally, ...extra });
  res.end();
}

/** GET /api/repos?refresh=1&signals=0 */
export async function handleRepos(res, url) {
  const refresh = url.searchParams.get("refresh") === "1";
  const signals = url.searchParams.get("signals") !== "0";
  try {
    return json(res, 200, await allRepoRows({ refresh, signals }));
  } catch (e) {
    return json(res, 502, { error: `Could not list the org via gh: ${String(e.message || e)}` });
  }
}

/** POST /api/repos/clone { repos } -> NDJSON */
export async function handleReposClone(req, res) {
  const sel = await selectedRepos(req, res);
  if (!sel) return;
  return streamOp(res, sel.repos, 2, (name) => cloneOne(name));
}

/** POST /api/repos/pull { repos } -> NDJSON */
export async function handleReposPull(req, res) {
  const sel = await selectedRepos(req, res);
  if (!sel) return;
  return streamOp(res, sel.repos, 4, (name) => pullOne(name));
}

/** POST /api/repos/commit { repos, summary, description?, push?, dryRun? } -> NDJSON */
export async function handleReposCommit(req, res) {
  const sel = await selectedRepos(req, res);
  if (!sel) return;
  const { summary, description = "", push = true, dryRun = false } = sel.body;
  if (!summary || !String(summary).trim()) return json(res, 400, { error: "summary is required" });
  const opts = { summary: String(summary).trim(), description: String(description || ""), push: !!push, dryRun: !!dryRun };
  // Serial: commits are chatty in the log and a small N; interleaving would make it unreadable.
  // Every run - dry runs included - is recorded as a batch for the Deploys drawer.
  return streamOp(res, sel.repos, 1, (name, emit) => commitOne(name, opts, emit),
    async (results) => ({ batch: (await recordBatch(opts, results)).id }));
}

/** GET /api/repos/batches - recent commit runs, newest first. */
export function handleReposBatches(res) {
  return json(res, 200, { batches: listBatches() });
}

/** GET /api/repos/batch?id= */
export function handleReposBatch(res, url) {
  const b = getBatch(url.searchParams.get("id"));
  return b ? json(res, 200, b) : json(res, 404, { error: "no such batch" });
}

/** POST /api/repos/deploys { repos } - newest Actions run per repo. */
export async function handleReposDeploys(req, res) {
  const sel = await selectedRepos(req, res);
  if (!sel) return;
  if (sel.repos.length > 100) return json(res, 400, { error: "too many repos in one poll (max 100)" });
  return json(res, 200, { generated: new Date().toISOString(), rows: await deployRows(sel.repos) });
}

async function repoAndRun(res, repoName, runId) {
  const r = await resolveRepo(repoName);
  if (!r) { json(res, 400, { error: "repo is not in the org" }); return null; }
  if (!/^\d{1,15}$/.test(String(runId || ""))) { json(res, 400, { error: "a numeric runId is required" }); return null; }
  return { entry: r.entry, runId: String(runId) };
}

/** GET /api/repos/run-detail?repo=&runId= */
export async function handleReposRunDetail(res, url) {
  const x = await repoAndRun(res, url.searchParams.get("repo"), url.searchParams.get("runId"));
  if (!x) return;
  try { return json(res, 200, await runDetail(x.entry, x.runId)); }
  catch (e) { return json(res, 502, { error: String(e.message || e) }); }
}

/** POST /api/repos/run-rerun { repo, runId } - re-run the failed jobs. */
export async function handleReposRunRerun(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const x = await repoAndRun(res, body.repo, body.runId);
  if (!x) return;
  try { await rerunFailed(x.entry, x.runId); return json(res, 200, { ok: true }); }
  catch (e) { return json(res, 502, { ok: false, error: String(e.message || e) }); }
}

/** POST /api/repos/push { repos } */
export async function handleReposPush(req, res) {
  const sel = await selectedRepos(req, res);
  if (!sel) return;
  const results = [];
  for (const name of sel.repos) results.push(await pushOne(name));
  return json(res, 200, { results });
}

/** POST /api/repos/discard { repos } - stash, never delete */
export async function handleReposDiscard(req, res) {
  const sel = await selectedRepos(req, res);
  if (!sel) return;
  const stamp = timestamp();
  const results = [];
  for (const name of sel.repos) results.push(await discardOne(name, stamp));
  return json(res, 200, { results });
}

/** Resolve ?repo= to a cloned path or respond 400/404. */
async function clonedRepoOr4xx(res, url) {
  const r = await resolveRepo(url.searchParams.get("repo"));
  if (!r) { json(res, 400, { error: "repo is not in the org" }); return null; }
  if (!fs.existsSync(path.join(r.repoPath, ".git"))) { json(res, 404, { error: "repo is not cloned" }); return null; }
  return r;
}

/** GET /api/repos/changes?repo= */
export async function handleReposChanges(res, url) {
  const r = await clonedRepoOr4xx(res, url);
  if (!r) return;
  return json(res, 200, { repo: r.entry.name, files: await changes(r.repoPath) });
}

/** GET /api/repos/diff?repo=&path= */
export async function handleReposDiff(res, url) {
  const r = await clonedRepoOr4xx(res, url);
  if (!r) return;
  const rel = safeRelPath(url.searchParams.get("path"));
  if (!rel) return json(res, 400, { error: "bad path" });
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(await diff(r.repoPath, rel));
}

/** GET /api/repos/log?repo= */
export async function handleReposLog(res, url) {
  const r = await clonedRepoOr4xx(res, url);
  if (!r) return;
  return json(res, 200, { repo: r.entry.name, commits: await log(r.repoPath) });
}

/**
 * POST /api/repos/open { repo?, shell: "explorer" | "cmd" | "powershell" | "code" }
 * No repo means the org root. Opening a window touches nothing, so the
 * only gate is that a named repo must be in the org.
 */
export async function handleReposOpen(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  let cwd = reposRoot();
  if (body.repo) {
    const r = await resolveRepo(body.repo);
    if (!r) return json(res, 400, { error: "repo is not in the org" });
    cwd = r.repoPath;
  }
  if (!fs.existsSync(cwd)) return json(res, 404, { error: `${cwd} does not exist yet - clone first` });

  const fire = (cmd, args, opts = {}) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", ...opts });
    child.on("error", () => {});
    child.unref();
  };
  try {
    if (body.shell === "explorer") fire("explorer.exe", [cwd]);
    else if (body.shell === "code") fire("cmd.exe", ["/c", "start", "", "code", cwd], { cwd, windowsHide: true });
    else fire("cmd.exe", ["/c", "start", "", body.shell === "powershell" ? "powershell.exe" : "cmd.exe"], { cwd, windowsHide: false });
    return json(res, 200, { ok: true, cwd });
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
}

/** GET /api/chrome-profile?dir=  - who the app window is signed in as (read from Chrome's profile store). */
export function handleChromeProfile(res, url) {
  const info = profileInfo(url.searchParams.get("dir"));
  return info ? json(res, 200, info) : json(res, 404, { error: "no Chrome profile found" });
}
/** GET /api/chrome-profile/default - the profile the launcher should pin the window to. */
export function handleChromeProfileDefault(res) {
  const dir = defaultProfileDir();
  return json(res, 200, { dir, ...(dir ? profileInfo(dir) ?? {} : {}) });
}
/** GET /api/chrome-profile/picture?dir=  - the avatar PNG Chrome already downloaded. */
export function handleChromeProfilePicture(res, url) {
  const file = profilePicturePath(url.searchParams.get("dir"));
  if (!file) return json(res, 404, { error: "no picture" });
  res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" });
  fs.createReadStream(file).pipe(res);
}
