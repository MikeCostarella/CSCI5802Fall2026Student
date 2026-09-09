// Deploy monitoring for the Repositories tab, ported from StatehouseUI's
// deploys.mjs: which batch commits happened, and where each repo's GitHub
// Actions run stands.
//
// One difference from StatehouseUI: commits here run through plain git in
// repos.mjs, so there are no commit.ps1 result files to read. The commit
// endpoint records each batch itself (recordBatch) into the app's data
// folder as `repobatches.json` - operational history, not student data,
// but it lives beside the roster because that folder is already outside
// every git tree.
//
// Read-only toward GitHub except run-rerun. gh is already authenticated on
// this machine; there is no token to manage.
import fs from "node:fs";
import path from "node:path";
import { runGh } from "./gh.mjs";
import { reposRoot } from "./repos-root.mjs";
import { readDoc, writeDoc } from "./store.mjs";
import { mapPool, orgRepos, resolveRepo, timestamp } from "./repos.mjs";

const DOC = "repobatches";
const KEEP = 50;

// ---- batch history -------------------------------------------------------

/**
 * Record one commit run. `results` are commitOne()'s { repo, kind, detail }.
 * Returns the stored batch (with its id) so the stream can hand it to the UI.
 */
export async function recordBatch({ summary, description, push, dryRun }, results) {
  // The org list is only for the GH links; recording the batch must not fail without it.
  let byName = new Map();
  try { byName = new Map((await orgRepos()).map((r) => [r.name, r])); } catch { /* links stay null */ }
  const rows = results.map((r) => ({
    repo: r.repo,
    action: actionFor(r, dryRun),
    detail: r.detail,
    repoUrl: byName.get(r.repo)?.html_url ?? null,
  }));
  const batch = {
    id: `ui-${timestamp()}`,
    applied: new Date().toISOString(),
    dryRun: !!dryRun,
    summary,
    description: description || "",
    push: !!push,
    results: rows,
  };
  const doc = readDoc(DOC, { batches: [] });
  doc.batches = [batch, ...(doc.batches || [])].slice(0, KEEP);
  writeDoc(DOC, doc);
  return batch;
}

/** commitOne's kind vocabulary -> the drawer's action vocabulary. */
function actionFor(r, dryRun) {
  if (r.kind === "updated") return "committed";          // detail says "and pushed" / "(not pushed)"
  if (r.kind === "current") return "no-changes";
  if (r.kind === "error") return "failed";
  if (dryRun && /^dry run/.test(r.detail || "")) return "would-commit";
  return "skipped";
}

export function listBatches() {
  const doc = readDoc(DOC, { batches: [] });
  return (doc.batches || []).map((b) => ({
    id: b.id, applied: b.applied, dryRun: b.dryRun, summary: b.summary, repoCount: b.results.length,
  }));
}

export function getBatch(id) {
  const doc = readDoc(DOC, { batches: [] });
  return (doc.batches || []).find((b) => b.id === id) ?? null;
}

// ---- newest Actions run per repo ------------------------------------------

function hasWorkflow(repoPath) {
  try {
    return fs.readdirSync(path.join(repoPath, ".github", "workflows")).some((f) => /\.ya?ml$/.test(f));
  } catch { return false; }
}

// Cached briefly so a drawer polling every 20s does not stack gh calls when
// two clients (or a refresh) overlap.
const CACHE_TTL_MS = 15_000;
const runCache = new Map(); // repo name -> { at, row }

export async function latestRun(entry) {
  const cached = runCache.get(entry.name);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.row;

  const base = { repo: entry.name, pagesUrl: entry.pagesUrl ?? null };
  const repoPath = path.join(reposRoot(), entry.name);
  let row;
  if (fs.existsSync(path.join(repoPath, ".git")) && !hasWorkflow(repoPath)) {
    // Nothing deploys from a push here. Asking gh would turn up no runs and
    // the drawer would count that against the batch.
    row = { ...base, status: "none", detail: "no Actions workflow in this repo - nothing to deploy" };
  } else {
    const r = await runGh([
      "run", "list", "-R", entry.full_name, "--limit", "1",
      "--json", "databaseId,status,conclusion,displayTitle,updatedAt,url,workflowName",
    ]);
    if (!r.ok) {
      row = { ...base, status: "error", detail: (r.err || r.out).trim().split("\n")[0] || "gh failed" };
    } else {
      let runs = [];
      try { runs = JSON.parse(r.out); } catch { /* fall through to none */ }
      if (!Array.isArray(runs) || runs.length === 0) {
        row = { ...base, status: "none", detail: "no workflow runs" };
      } else {
        const run = runs[0];
        row = {
          ...base,
          runId: run.databaseId ?? null,
          status: run.status || "unknown",          // completed | in_progress | queued | ...
          conclusion: run.conclusion || null,       // success | failure | cancelled | null while running
          title: run.displayTitle || "",
          workflow: run.workflowName || "",
          updatedAt: run.updatedAt || null,
          url: run.url || null,
        };
      }
    }
  }
  runCache.set(entry.name, { at: Date.now(), row });
  return row;
}

export async function deployRows(names) {
  const entries = [];
  for (const n of names) {
    const r = await resolveRepo(n);
    if (r) entries.push(r.entry);
  }
  return mapPool(entries, 4, latestRun);
}

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

/** One run's summary plus, for a failed run, the tail of its failed-step log. */
export async function runDetail(entry, runId) {
  const r = await runGh([
    "run", "view", runId, "-R", entry.full_name,
    "--json", "name,displayTitle,status,conclusion,event,createdAt,updatedAt,headSha,url,jobs",
  ]);
  if (!r.ok) throw new Error((r.err || r.out).trim().split("\n")[0] || "gh run view failed");
  let run;
  try { run = JSON.parse(r.out); } catch { throw new Error("gh returned unparseable run JSON"); }

  const detail = {
    repo: entry.name,
    runId: Number(runId),
    name: run.name ?? "",
    title: run.displayTitle ?? "",
    status: run.status ?? "",
    conclusion: run.conclusion ?? null,
    event: run.event ?? "",
    createdAt: run.createdAt ?? null,
    updatedAt: run.updatedAt ?? null,
    headSha: (run.headSha ?? "").slice(0, 7),
    url: run.url ?? null,
    jobs: Array.isArray(run.jobs) ? run.jobs.map((j) => ({ name: j.name, status: j.status, conclusion: j.conclusion ?? null })) : [],
    failedLog: null,
  };
  if (detail.conclusion && detail.conclusion !== "success") {
    // Only the failed steps' log, and only its tail - the error is at the end.
    const lg = await runGh(["run", "view", runId, "-R", entry.full_name, "--log-failed"]);
    const lines = stripAnsi(lg.out || lg.err || "").split("\n").filter((l) => l.trim());
    detail.failedLog = lines.slice(-40).join("\n") || "(no failed-step log available)";
  }
  return detail;
}

/** Re-run a run's FAILED jobs; drops the status cache so the next poll sees the retry. */
export async function rerunFailed(entry, runId) {
  const r = await runGh(["run", "rerun", runId, "-R", entry.full_name, "--failed"]);
  runCache.delete(entry.name);
  if (!r.ok) throw new Error((r.err || r.out).trim().split("\n")[0] || "gh run rerun failed");
}
