// The deploy drawer, ported from StatehouseUI: a non-modal panel pinned to
// the bottom-right that shows what a batch commit did per repo, and where
// each repo's GitHub Actions run stands. It never blocks the page.
//
// Collapsed it is a small pill; a successful pushed commit pops it open
// (RepositoriesTab bumps `openTick`). It polls /api/repos/deploys every
// POLL_MS only while open and only until every row is terminal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchBatch, fetchBatches, fetchDeploys, fetchRunDetail, rerunFailed } from "../repos-api";
import type { Batch, BatchListEntry, DeployRow, RunDetail } from "../types";

const POLL_MS = 20_000;

/** A run is terminal when polling it again cannot change the answer. */
function isTerminal(row: DeployRow): boolean {
  return row.status === "completed" || row.status === "none" || row.status === "error";
}

function deployChip(row: DeployRow | undefined): { cls: string; label: string } {
  if (!row) return { cls: "dp-wait", label: "…" };
  if (row.status === "completed") {
    if (row.conclusion === "success") return { cls: "dp-ok", label: "deployed" };
    return { cls: "dp-bad", label: row.conclusion || "completed" };
  }
  if (row.status === "in_progress") return { cls: "dp-run", label: "deploying" };
  if (row.status === "queued") return { cls: "dp-run", label: "queued" };
  if (row.status === "none") {
    return { cls: "dp-none", label: row.detail?.startsWith("no Actions workflow") ? "no workflow" : "no runs" };
  }
  if (row.status === "error") return { cls: "dp-bad", label: "gh error" };
  return { cls: "dp-none", label: row.status };
}

function commitChip(action: string, detail?: string): { cls: string; label: string } {
  if (action === "committed") return { cls: "dp-ok", label: /and pushed/.test(detail ?? "") ? "pushed" : "committed" };
  if (action === "no-changes") return { cls: "dp-none", label: "no changes" };
  if (action === "would-commit") return { cls: "dp-run", label: "would commit" };
  if (action === "failed") return { cls: "dp-bad", label: "FAILED" };
  return { cls: "dp-none", label: detail ? `${action} — ${detail}` : action };
}

interface Props {
  /** Bumped after a successful pushed commit; each bump opens the drawer on the newest batch. */
  openTick: number;
  /** Same shell/Explorer/VS Code actions as the grid rows. */
  onOpen: (repo: string, shell: "explorer" | "cmd" | "powershell" | "code") => void;
}

export default function DeployDrawer({ openTick, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<BatchListEntry[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [deploys, setDeploys] = useState<Map<string, DeployRow>>(new Map());
  const [polledAt, setPolledAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ repo: string; loading: boolean; detail: RunDetail | null } | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // The repos whose deploys are worth watching: the ones this batch pushed.
  const watched = useMemo(
    () => (batch ? batch.results.filter((r) => r.action === "committed" && /and pushed/.test(r.detail ?? "")).map((r) => r.repo) : []),
    [batch],
  );

  const loadBatchList = useCallback(async (selectNewest: boolean) => {
    try {
      const r = await fetchBatches();
      setBatches(r.batches ?? []);
      if (selectNewest && r.batches?.length) {
        setBatch(await fetchBatch(r.batches[0].id)); setDeploys(new Map()); setError(null);
      }
    } catch (e) { setError(String((e as Error).message)); }
  }, []);

  const selectBatch = useCallback(async (id: string) => {
    try { setBatch(await fetchBatch(id)); setDeploys(new Map()); setError(null); }
    catch (e) { setError(String((e as Error).message)); }
  }, []);

  // A successful commit opens the drawer on the newest batch.
  useEffect(() => { if (openTick > 0) { setOpen(true); loadBatchList(true); } }, [openTick, loadBatchList]);
  // Opening by hand loads the list (and newest batch) once.
  useEffect(() => { if (open && !batch) loadBatchList(true); }, [open, batch, loadBatchList]);

  const poll = useCallback(async () => {
    if (watched.length === 0) return;
    try {
      const r = await fetchDeploys(watched);
      setError(null);
      setDeploys(new Map((r.rows ?? []).map((row) => [row.repo, row])));
      setPolledAt(new Date().toLocaleTimeString());
    } catch (e) { setError(String((e as Error).message)); }
  }, [watched]);

  // Poll while open, stopping for good once every watched row is terminal.
  const allTerminal = watched.length > 0 && watched.every((n) => { const row = deploys.get(n); return row ? isTerminal(row) : false; });
  useEffect(() => {
    if (!open || watched.length === 0) return;
    poll();
    if (allTerminal) return;
    timer.current = window.setInterval(poll, POLL_MS);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [open, watched, allTerminal, poll]);

  const toggleDetail = useCallback(async (repo: string, runId: number) => {
    if (expanded?.repo === repo) { setExpanded(null); return; }
    setExpanded({ repo, loading: true, detail: null });
    try { setExpanded({ repo, loading: false, detail: await fetchRunDetail(repo, runId) }); }
    catch (e) { setError(String((e as Error).message)); setExpanded(null); }
  }, [expanded]);

  const doRerun = useCallback(async (repo: string, runId: number) => {
    if (!window.confirm(`Re-run the failed jobs of ${repo}'s last workflow run?`)) return;
    setRerunning(repo);
    try { await rerunFailed(repo, runId); setExpanded(null); await poll(); }
    catch (e) { setError(String((e as Error).message)); }
    finally { setRerunning(null); }
  }, [poll]);

  const tally = useMemo(() => {
    let ok = 0, bad = 0, running = 0, none = 0;
    for (const name of watched) {
      const row = deploys.get(name);
      if (!row) continue;
      if (row.status === "completed" && row.conclusion === "success") ok++;
      else if (row.status === "error" || (row.status === "completed" && row.conclusion !== "success")) bad++;
      else if (row.status === "in_progress" || row.status === "queued") running++;
      else if (row.status === "none") none++;
    }
    return { ok, bad, running, total: watched.length - none };
  }, [watched, deploys]);

  if (!open) {
    return (
      <button className="deploy-pill" onClick={() => setOpen(true)} title="Show deploy status for recent commits">
        {"▲"} Deploys
      </button>
    );
  }

  return (
    <div className="deploy-drawer" role="complementary" aria-label="Deploy status">
      <div className="deploy-head">
        <select className="deploy-select" value={batch?.id ?? ""} onChange={(e) => selectBatch(e.target.value)} title="Pick a commit run">
          {batches.length === 0 && <option value="">(no commits recorded yet)</option>}
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {(b.dryRun ? "[dry run] " : "") + new Date(b.applied).toLocaleString() + " — " + b.summary + ` (${b.repoCount})`}
            </option>
          ))}
        </select>
        <span className="deploy-tally">
          {watched.length > 0 && (<>
            <b className="dp-ok-text">{tally.ok}</b>/{tally.total} deployed
            {tally.running > 0 && <> {"·"} {tally.running} running</>}
            {tally.bad > 0 && <b className="dp-bad-text"> {"·"} {tally.bad} failed</b>}
          </>)}
        </span>
        <button className="deploy-tool" onClick={poll} title="Poll GitHub Actions now" disabled={watched.length === 0}>{"↻"}</button>
        <button className="deploy-tool" onClick={() => setOpen(false)} aria-label="Collapse">{"▼"}</button>
      </div>

      {error && <div className="deploy-error">{error}</div>}

      <div className="deploy-body">
        {!batch && !error && <div className="deploy-empty">{batches.length === 0 ? "No commit runs yet. Commit from the bar above and the drawer fills in." : "Loading…"}</div>}
        {batch && batch.results.length === 0 && <div className="deploy-empty">This run touched no repos.</div>}
        {batch && batch.results.map((r) => {
          const row = watched.includes(r.repo) ? deploys.get(r.repo) : undefined;
          const commit = commitChip(r.action, r.detail);
          const deploy = watched.includes(r.repo) ? deployChip(row) : null;
          const failed = !!row && row.status === "completed" && row.conclusion !== "success";
          const isOpen = expanded?.repo === r.repo;
          return (
            <div key={r.repo}>
              <div className={"deploy-row" + (isOpen ? " open" : "")}>
                <span className="deploy-repo" title={r.detail ?? r.repo}>{r.repo}</span>
                <span className="deploy-actions">
                  {r.repoUrl && <a className="deploy-ibtn" href={r.repoUrl} target="_blank" rel="noreferrer" title="Open the repository on GitHub">GH</a>}
                  {row?.runId != null && (
                    <button className={"deploy-ibtn" + (isOpen ? " active" : "")} onClick={() => toggleDetail(r.repo, row.runId as number)}
                      title="Run details (and the error lines, when it failed)">i</button>
                  )}
                  {failed && row?.runId != null && (
                    <button className="deploy-ibtn rerun" onClick={() => doRerun(r.repo, row.runId as number)} disabled={rerunning === r.repo}
                      title="Re-run the failed jobs">{rerunning === r.repo ? "…" : "⟲"}</button>
                  )}
                  {row?.url && <a className="deploy-ibtn" href={row.url} target="_blank" rel="noreferrer" title="Open the Actions run on GitHub">CI</a>}
                  {row?.pagesUrl && row.status === "completed" && row.conclusion === "success" && (
                    <a className="deploy-ibtn" href={row.pagesUrl} target="_blank" rel="noreferrer" title="Open the live site">site</a>
                  )}
                  <button className="deploy-ibtn" onClick={() => onOpen(r.repo, "powershell")} title={`PowerShell in ${r.repo}`}>PS</button>
                  <button className="deploy-ibtn" onClick={() => onOpen(r.repo, "code")} title={`Open ${r.repo} in VS Code`}>VS</button>
                  <button className="deploy-ibtn" onClick={() => onOpen(r.repo, "explorer")} title={`Explorer in ${r.repo}`}>{"🗀"}</button>
                </span>
                <span className={`deploy-chip ${commit.cls}`}>{commit.label}</span>
                {deploy && <span className={`deploy-chip ${deploy.cls}`} title={row?.title || row?.detail || ""}>{deploy.label}</span>}
              </div>
              {isOpen && (
                <div className="deploy-detail">
                  {expanded.loading && <div className="deploy-empty">Fetching run detail{"…"}</div>}
                  {expanded.detail && (<>
                    <div className="deploy-detail-head">
                      {expanded.detail.name} {"·"} {expanded.detail.event} {"·"} {expanded.detail.headSha}
                      {expanded.detail.updatedAt ? ` · ${new Date(expanded.detail.updatedAt).toLocaleTimeString()}` : ""}
                      {" · "}
                      {expanded.detail.jobs.map((j) => `${j.name}: ${j.conclusion ?? j.status}`).join(" · ")}
                    </div>
                    {expanded.detail.failedLog && <pre className="deploy-faillog">{expanded.detail.failedLog}</pre>}
                  </>)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="deploy-foot">
        {allTerminal
          ? "All runs finished — polling stopped."
          : watched.length > 0
            ? `Polling GitHub Actions every ${POLL_MS / 1000}s${polledAt ? ` · last ${polledAt}` : ""}`
            : batch ? "Nothing was pushed in this run — nothing to watch." : ""}
      </div>
    </div>
  );
}
