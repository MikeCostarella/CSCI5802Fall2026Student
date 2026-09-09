// The Repositories tab: StatehouseUI's fleet grid, scoped to one GitHub org
// (the course's participants org). The org is the list; C:\projects\<org>\
// is where clones live; the server refuses any repo name not in the org.
//
// Unlike the other tabs this one owns its own state - it has enough of it
// (selection, filters, commit fields, a streaming log) that hoisting it into
// App.tsx would double that file for no benefit.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cloneRepos, commitRepos, discardRepos, fetchRepoChanges, fetchRepoDiff, fetchRepoLog, fetchRepos,
  openRepo, pullRepos, pushRepos,
} from "../repos-api";
import DeployDrawer from "./DeployDrawer";
import type { RepoChange, RepoCommit, RepoEvent, RepoRow, RepoState, ReposResponse } from "../types";

type Filter = "all" | "attention" | "dirty" | "unpushed" | "behind" | "notcloned" | "clean";
type SortKey = "name" | "state" | "branch" | "dirty" | "ahead" | "behind" | "pushedAt";

const STATE_ORDER: Record<RepoState, number> = {
  DIRTY: 0, UNPUSHED: 1, BEHIND: 2, FLAGS: 3, "NOT-CLONED": 4, "NO-GIT": 5, PENDING: 6, clean: 7,
};
const STATE_LABEL: Record<RepoState, string> = {
  clean: "clean", DIRTY: "dirty", UNPUSHED: "unpushed", BEHIND: "behind", FLAGS: "flags",
  "NOT-CLONED": "not cloned", "NO-GIT": "no git", PENDING: "…",
};

function matches(r: RepoRow, f: Filter): boolean {
  switch (f) {
    case "all": return true;
    case "attention": return r.state !== "clean";
    case "dirty": return r.state === "DIRTY";
    case "unpushed": return r.ahead > 0;
    case "behind": return r.behind > 0;
    case "notcloned": return !r.cloned;
    case "clean": return r.state === "clean";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props { org: string | null; }

export default function RepositoriesTab({ org }: Props) {
  const [data, setData] = useState<ReposResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [needle, setNeedle] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortAsc, setSortAsc] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [pushAfter, setPushAfter] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // label of the running operation
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [log, setLog] = useState("Ready. Hit Refresh to scan the org.");
  const [expanded, setExpanded] = useState<{ repo: string; view: "changes" | "log" } | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const [logHeight, setLogHeight] = useState(140);
  const [deployTick, setDeployTick] = useState(0); // bumped after a real commit: opens the Deploys drawer

  /** Drag the log's grip up/down; the grid above takes up the slack. Double-click resets. */
  const startLogDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = logHeight;
    const onMove = (ev: MouseEvent) =>
      setLogHeight(Math.min(Math.round(window.innerHeight * 0.7), Math.max(60, startH + (startY - ev.clientY))));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const appendLog = useCallback((line: string) => setLog((prev) => (prev ? prev + "\n" + line : line)), []);
  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log]);

  const scan = useCallback(async (refresh: boolean) => {
    setLoading(true); setError("");
    try {
      const r = await fetchRepos({ refresh });
      setData(r);
      setChecked((prev) => new Set([...prev].filter((n) => r.repos.some((x) => x.name === n))));
      const dirty = r.repos.filter((x) => x.state === "DIRTY").length;
      const missing = r.repos.filter((x) => !x.cloned).length;
      appendLog(`Scanned ${r.org} + your fork: ${r.repos.length} repos · ${dirty} dirty · ${missing} not cloned${r.listError ? ` · (GitHub list stale: ${r.listError})` : ""}`);
    } catch (e) { setError(String((e as Error).message)); }
    finally { setLoading(false); }
  }, [appendLog]);

  useEffect(() => { if (data === null) scan(false); }, [data, scan]);

  const rows = data?.repos ?? [];
  const counts = useMemo(() => ({
    all: rows.length,
    clean: rows.filter((r) => r.state === "clean").length,
    dirty: rows.filter((r) => r.state === "DIRTY").length,
    unpushed: rows.filter((r) => r.ahead > 0).length,
    behind: rows.filter((r) => r.behind > 0).length,
    notcloned: rows.filter((r) => !r.cloned).length,
  }), [rows]);

  const visible = useMemo(() => {
    const q = needle.trim().toLowerCase();
    const list = rows.filter((r) => matches(r, filter) && (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      let d = 0;
      if (sortKey === "state") d = STATE_ORDER[a.state] - STATE_ORDER[b.state];
      else if (sortKey === "name") d = a.name.localeCompare(b.name);
      else if (sortKey === "branch") d = a.branch.localeCompare(b.branch);
      else if (sortKey === "pushedAt") d = (a.pushedAt ?? "").localeCompare(b.pushedAt ?? "");
      else d = a[sortKey] - b[sortKey];
      if (d === 0) d = a.name.localeCompare(b.name);
      return sortAsc ? d : -d;
    });
  }, [rows, filter, needle, sortKey, sortAsc]);

  const sortBy = (k: SortKey) => { if (k === sortKey) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(true); } };
  const arrow = (k: SortKey) => (sortKey === k ? (sortAsc ? " \u25B2" : " \u25BC") : "");

  const visibleNames = visible.map((r) => r.name);
  const allChecked = visibleNames.length > 0 && visibleNames.every((n) => checked.has(n));
  const toggleOne = (n: string) => setChecked((p) => { const s = new Set(p); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const toggleMany = (names: string[], on: boolean) => setChecked((p) => { const s = new Set(p); for (const n of names) { if (on) s.add(n); else s.delete(n); } return s; });
  const selectWhere = (pred: (r: RepoRow) => boolean) => setChecked(new Set(rows.filter(pred).map((r) => r.name)));

  const selectedRows = rows.filter((r) => checked.has(r.name));
  const dirtySelected = selectedRows.filter((r) => r.state === "DIRTY").length;
  const aheadSelected = selectedRows.filter((r) => r.ahead > 0).length;
  const notClonedSelected = selectedRows.filter((r) => !r.cloned).length;
  const canCommit = !busy && dirtySelected > 0 && summary.trim().length > 0;

  /** Feed one streamed event into the log and the progress counter. */
  const onEvent = (label: string) => (e: RepoEvent) => {
    if (e.type === "start") { setProgress({ done: 0, total: e.total }); appendLog(`${label}: ${e.total} repo(s)`); }
    else if (e.type === "line") appendLog(e.text);
    else if (e.type === "repo") { setProgress((p) => (p ? { ...p, done: p.done + 1 } : p)); appendLog(`  ${e.kind.padEnd(8)} ${e.repo}: ${e.detail}`); }
    else if (e.type === "done") appendLog(`${label} done: ${Object.entries(e.tally).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing to do"}`);
  };

  const run = async (label: string, fn: () => Promise<void>, rescan = true) => {
    setBusy(label); setError(""); setProgress(null);
    try { await fn(); } catch (e) { const m = String((e as Error).message); setError(m); appendLog(`${label} failed: ${m}`); }
    finally { setBusy(null); setProgress(null); if (rescan) scan(false); }
  };

  const doClone = (names: string[]) => run("Clone", () => cloneRepos(names, onEvent("Clone")));
  const doPull = (names: string[]) => run("Get latest", () => pullRepos(names, onEvent("Get latest")));
  const doCommit = (dryRun: boolean) => run(dryRun ? "Dry run" : "Commit", async () => {
    const handler = onEvent(dryRun ? "Dry run" : "Commit");
    let committed = false;
    await commitRepos({ repos: selectedRows.filter((r) => r.state === "DIRTY").map((r) => r.name),
      summary: summary.trim(), description, push: pushAfter, dryRun }, (e) => {
        handler(e);
        if (e.type === "repo" && e.kind === "updated") committed = true;
      });
    if (!dryRun) { setSummary(""); setDescription(""); }
    if (!dryRun && committed && pushAfter) setDeployTick((t) => t + 1);
  }, !dryRun);
  const doPush = () => run("Push", async () => {
    const { results } = await pushRepos(selectedRows.filter((r) => r.ahead > 0).map((r) => r.name));
    for (const r of results) appendLog(`  ${r.ok ? "pushed  " : "error   "} ${r.repo}${r.output ? `: ${r.output.split("\n").pop()}` : ""}`);
  });
  const doDiscard = () => {
    const names = selectedRows.filter((r) => r.state === "DIRTY").map((r) => r.name);
    if (!window.confirm(`Stash away ALL changes in ${names.length} repo(s)?\n\n${names.join("\n")}\n\nRecoverable in each repo with: git stash pop`)) return;
    run("Discard", async () => {
      const { results } = await discardRepos(names);
      for (const r of results) appendLog(`  ${r.ok ? "stashed " : "error   "} ${r.repo}: ${r.output}`);
    });
  };
  const open = async (repo: string | null, shell: "explorer" | "cmd" | "powershell" | "code") => {
    try { await openRepo(repo, shell); } catch (e) { setError(String((e as Error).message)); }
  };

  const ghUrl = (r: RepoRow, suffix = "") => `${r.url}${suffix}`;

  return (
    <div className="panel repos">
      <div className="row repos-head">
        <span className="pill all" title="Every repo in the org">{counts.all} all</span>
        <button className={`pill clean${filter === "clean" ? " active" : ""}`} onClick={() => setFilter(filter === "clean" ? "all" : "clean")}>{counts.clean} clean</button>
        <button className={`pill dirty${filter === "dirty" ? " active" : ""}`} onClick={() => setFilter(filter === "dirty" ? "all" : "dirty")}>{counts.dirty} dirty</button>
        <button className={`pill unpushed${filter === "unpushed" ? " active" : ""}`} onClick={() => setFilter(filter === "unpushed" ? "all" : "unpushed")}>{counts.unpushed} unpushed</button>
        <button className={`pill behind${filter === "behind" ? " active" : ""}`} onClick={() => setFilter(filter === "behind" ? "all" : "behind")}>{counts.behind} behind</button>
        <button className={`pill other${filter === "notcloned" ? " active" : ""}`} onClick={() => setFilter(filter === "notcloned" ? "all" : "notcloned")}>{counts.notcloned} not cloned</button>
        <span className="muted" style={{ marginLeft: "auto" }}>
          {org ? <a href={`https://github.com/${org}`} target="_blank" rel="noreferrer">github.com/{org} {"\u2197"}</a> : "org?"}
          {data && <> {"\u00b7"} clones in <span className="mono">{data.root}</span> {"\u00b7"} scanned {new Date(data.generated).toLocaleTimeString()}</>}
        </span>
        <button onClick={() => scan(true)} disabled={loading || !!busy}>{loading ? "Scanning\u2026" : "Refresh"}</button>
      </div>

      <div className="row">
        <input className="repos-filter" placeholder={"Filter by name\u2026"} value={needle} onChange={(e) => setNeedle(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">all</option><option value="attention">needs attention</option>
          <option value="dirty">dirty</option><option value="unpushed">unpushed</option>
          <option value="behind">behind</option><option value="notcloned">not cloned</option><option value="clean">clean</option>
        </select>
        <button onClick={() => selectWhere((r) => r.state === "DIRTY")}>Select dirty</button>
        <button onClick={() => selectWhere((r) => r.state === "DIRTY" || r.ahead > 0)}>Select dirty + unpushed</button>
        <button onClick={() => setChecked(new Set())} disabled={checked.size === 0}>Clear selection</button>
        <button onClick={() => doClone(rows.filter((r) => !r.cloned).map((r) => r.name))} disabled={!!busy || counts.notcloned === 0}
          title="git clone every org repo that is not on this machine yet">Clone missing</button>
        <button onClick={() => doPull(selectedRows.length ? selectedRows.filter((r) => r.cloned).map((r) => r.name) : rows.filter((r) => r.cloned).map((r) => r.name))}
          disabled={!!busy || counts.all === counts.notcloned}
          title="fetch + fast-forward only; dirty repos are skipped untouched">Get latest{checked.size ? ` (${checked.size})` : ""}</button>
        <button onClick={() => open(null, "explorer")} title="Open the org folder in Explorer">{"\uD83D\uDDC0"} Org folder</button>
        <button onClick={() => open(null, "powershell")} title="PowerShell in the org folder">PowerShell</button>
        <span className="muted" style={{ marginLeft: "auto" }}>{checked.size} selected</span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid-wrap">
        <table className="repo-grid">
          <thead><tr>
            <th className="chk"><input type="checkbox" checked={allChecked} onChange={() => toggleMany(visibleNames, !allChecked)} title="Check all (visible)" /></th>
            <th onClick={() => sortBy("name")}>Repository{arrow("name")}</th>
            <th className="shells"></th>
            <th onClick={() => sortBy("state")}>State{arrow("state")}</th>
            <th onClick={() => sortBy("branch")}>Branch{arrow("branch")}</th>
            <th className="num" onClick={() => sortBy("dirty")}>Dirty{arrow("dirty")}</th>
            <th className="num" onClick={() => sortBy("ahead")}>Ahead{arrow("ahead")}</th>
            <th className="num" onClick={() => sortBy("behind")}>Behind{arrow("behind")}</th>
            <th className="num">PRs</th>
            <th>CI</th>
            <th onClick={() => sortBy("pushedAt")}>Last push{arrow("pushedAt")}</th>
            <th>Flags</th>
          </tr></thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td className="empty" colSpan={12}>
                {loading ? "Scanning\u2026" : rows.length === 0 ? "No repos found in the org (or gh is not signed in - try: gh auth status)." : "Nothing matches this filter."}
              </td></tr>
            )}
            {visible.map((r) => (
              <RepoTr key={r.name} r={r}
                checked={checked.has(r.name)} onToggle={() => toggleOne(r.name)}
                expanded={expanded?.repo === r.name ? expanded.view : null}
                onExpand={(view) => setExpanded(expanded?.repo === r.name && expanded.view === view ? null : { repo: r.name, view })}
                onClone={() => doClone([r.name])} onPull={() => doPull([r.name])} onOpen={(shell) => open(r.name, shell)}
                ghUrl={ghUrl} busy={!!busy} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="commit-bar">
        <div className="fields">
          <span className="field-wrap">
            <input className="summary" placeholder="Commit summary (required)" value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape" && summary) setSummary(""); }} />
            {summary && <button className="field-clear" onClick={() => setSummary("")} aria-label="Clear the summary">{"\u2715"}</button>}
          </span>
          <span className="field-wrap">
            <textarea className="description" placeholder="Commit description (optional)" value={description}
              onChange={(e) => setDescription(e.target.value)} />
            {description && <button className="field-clear desc" onClick={() => setDescription("")} aria-label="Clear the description">{"\u2715"}</button>}
          </span>
        </div>
        <div className="actions">
          <label className="pushopt">
            <input type="checkbox" checked={pushAfter} onChange={(e) => setPushAfter(e.target.checked)} />
            push after commit
          </label>
          <button onClick={() => doCommit(true)} disabled={!canCommit} title="List what would be committed - touches nothing">Dry run</button>
          <button className="primary" onClick={() => doCommit(false)} disabled={!canCommit}
            title={dirtySelected ? `git add -A / commit${pushAfter ? " / push" : ""} in ${dirtySelected} dirty repo(s)` : "Check dirty repos and write a summary"}>
            {busy ? (progress ? `${busy}\u2026 ${progress.done}/${progress.total}` : `${busy}\u2026`) : `Commit ${dirtySelected || ""}`}
          </button>
          <button onClick={doPush} disabled={!!busy || aheadSelected === 0} title="git push in the selected repos that are ahead">Push only{aheadSelected ? ` (${aheadSelected})` : ""}</button>
          <button onClick={() => doClone(selectedRows.filter((r) => !r.cloned).map((r) => r.name))} disabled={!!busy || notClonedSelected === 0}>Clone{notClonedSelected ? ` (${notClonedSelected})` : ""}</button>
          <button className="danger" onClick={doDiscard} disabled={!!busy || dirtySelected === 0}
            title="Stash away all changes in the selected dirty repos (recoverable with git stash pop)">Discard{"\u2026"}</button>
        </div>
      </div>

      <div className="log-wrap">
        <div className="log-grip" onMouseDown={startLogDrag} onDoubleClick={() => setLogHeight(140)} title="Drag to resize the log">
          <span className="grip-dots">{"\u2022\u2022\u2022"}</span>
          <div className="log-actions" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => navigator.clipboard.writeText(log).catch(() => {})} disabled={!log}>Copy</button>
            <button onClick={() => setLog("")} disabled={!log}>Clear</button>
          </div>
        </div>
        <pre className="log" ref={logRef} style={{ height: logHeight }}>{log}</pre>
      </div>

      <DeployDrawer openTick={deployTick} onOpen={open} />
    </div>
  );
}

// ---------------------------------------------------------------------------

interface TrProps {
  r: RepoRow; checked: boolean; onToggle: () => void;
  expanded: "changes" | "log" | null; onExpand: (view: "changes" | "log") => void;
  onClone: () => void; onPull: () => void; onOpen: (shell: "explorer" | "cmd" | "powershell" | "code") => void;
  ghUrl: (r: RepoRow, suffix?: string) => string; busy: boolean;
}

function RepoTr({ r, checked, onToggle, expanded, onExpand, onClone, onPull, onOpen, ghUrl, busy }: TrProps) {
  const ext = (href: string) => window.open(href, "_blank", "noopener");
  return (<>
    <tr className={`state-${r.state}${expanded ? " expanded" : ""}`}>
      <td className="chk"><input type="checkbox" checked={checked} onChange={onToggle} /></td>
      <td className="name">
        <button className="linklike" onClick={() => onExpand("changes")} title={r.description || "View changes"} disabled={!r.cloned}>{r.name}</button>
        {r.mine && <span className="chip ok" title="Your fork of the starter"> mine</span>}
        {r.private && <span className="chip" title="private repo"> {"\uD83D\uDD12"}</span>}
        {r.archived && <span className="chip warn">archived</span>}
      </td>
      <td className="shells">
        {r.cloned ? (<>
          <button className="shell-btn" onClick={() => onExpand("changes")} title="View changes">{"\u00b1"}</button>
          <button className="shell-btn" onClick={() => onExpand("log")} title="Recent commits">Log</button>
          <button className="shell-btn" onClick={onPull} disabled={busy} title="fetch + fast-forward this repo">{"\u2193"}</button>
          <button className="shell-btn" onClick={() => onOpen("cmd")} title="Command prompt here">&gt;_</button>
          <button className="shell-btn" onClick={() => onOpen("powershell")} title="PowerShell here">PS</button>
          <button className="shell-btn" onClick={() => onOpen("code")} title="Open in VS Code">VS</button>
          <button className="shell-btn" onClick={() => onOpen("explorer")} title="Show in Explorer">{"\uD83D\uDDC0"}</button>
        </>) : (
          <button className="shell-btn" onClick={onClone} disabled={busy} title="git clone this repo">clone</button>
        )}
        <button className="shell-btn" onClick={() => ext(ghUrl(r))} title="Open on GitHub">GH</button>
        <button className="shell-btn" onClick={() => ext(ghUrl(r, "/pulls"))} title="Pull requests">PR</button>
        <button className="shell-btn" onClick={() => ext(ghUrl(r, "/actions"))} disabled={r.cloned && !r.hasWorkflow} title="Actions">CI</button>
      </td>
      <td><span className={`badge state-${r.state}`}>{STATE_LABEL[r.state]}</span></td>
      <td className="mono">{r.branch || (r.cloned ? "" : <span className="muted">{r.defaultBranch}</span>)}</td>
      <td className="num">{r.dirty || ""}</td>
      <td className="num">{r.ahead || ""}</td>
      <td className="num">{r.behind || ""}</td>
      <td className="num">{r.openPrs === null ? "" : r.openPrs || ""}</td>
      <td>{r.ci === null ? "" : r.ci === "success"
        ? <span className="chip ok">green</span>
        : r.ci === "none" ? <span className="muted">none</span>
        : <span className="chip warn">{r.ci}</span>}</td>
      <td title={r.pushedAt ?? ""}>{fmtDate(r.pushedAt)}</td>
      <td className="flags">{r.flags.join(", ")}</td>
    </tr>
    {expanded && (
      <tr className="changes-row"><td colSpan={12}>
        {expanded === "changes" ? <ChangesPanel repo={r.name} /> : <LogPanel repo={r.name} />}
      </td></tr>
    )}
  </>);
}

function ChangesPanel({ repo }: { repo: string }) {
  const [files, setFiles] = useState<RepoChange[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [diff, setDiff] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { fetchRepoChanges(repo).then((r) => setFiles(r.files)).catch((e) => setErr(String(e.message))); }, [repo]);
  useEffect(() => {
    if (!sel) { setDiff(""); return; }
    fetchRepoDiff(repo, sel).then(setDiff).catch((e) => setDiff(String(e.message)));
  }, [repo, sel]);
  if (err) return <p className="error">{err}</p>;
  if (files === null) return <p className="muted">Loading changes{"\u2026"}</p>;
  if (files.length === 0) return <p className="muted">Working tree clean.</p>;
  return (
    <div className="inline-changes">
      <ul className="change-list">
        {files.map((f) => (
          <li key={f.path} className={sel === f.path ? "active" : ""}>
            <button className="linklike" onClick={() => setSel(sel === f.path ? null : f.path)}>
              <span className={`status s-${f.status.replace(/[^A-Z?]/g, "") || "X"}`}>{f.status}</span> {f.path}
            </button>
          </li>
        ))}
      </ul>
      {sel && <pre className="diff">{diff || "(no diff)"}</pre>}
    </div>
  );
}

function LogPanel({ repo }: { repo: string }) {
  const [commits, setCommits] = useState<RepoCommit[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetchRepoLog(repo).then((r) => setCommits(r.commits)).catch((e) => setErr(String(e.message))); }, [repo]);
  if (err) return <p className="error">{err}</p>;
  if (commits === null) return <p className="muted">Loading log{"\u2026"}</p>;
  return (
    <table className="mini-log">
      <tbody>{commits.map((c) => (
        <tr key={c.sha}><td className="mono">{c.sha}</td><td className="mono">{c.date}</td><td>{c.author}</td><td>{c.subject}</td></tr>
      ))}</tbody>
    </table>
  );
}
