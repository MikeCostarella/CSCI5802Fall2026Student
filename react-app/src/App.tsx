// Three views: Sprint (where am I in the current lab and how does my fork
// look), Classmates (the opt-in directory, with Teams call/chat), and Setup
// (gh, handle, email, directory entry). The instructor's board reads the
// same GitHub signals this app shows you, so there are no surprises.
import { useCallback, useEffect, useState } from "react";
import { fetchCourse, fetchDirectory, fetchMySprint, fetchProfile, fetchSprints, fetchUpstream, restartServer, saveProfile } from "./api";
import AppMenu from "./components/AppMenu";
import BuildStamp from "./components/BuildStamp";
import TeamsDialog from "./components/TeamsDialog";
import type { Classmate, Course, DirectoryView, MySprint, Profile, ProfileView, Sprint, Upstream } from "./types";

type Tab = "sprint" | "classmates" | "setup";

export default function App() {
  const [course, setCourse] = useState<Course | null>(null);
  const [tab, setTab] = useState<Tab>("sprint");
  const [pv, setPv] = useState<ProfileView | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintId, setSprintId] = useState("");
  const [mine, setMine] = useState<MySprint | null>(null);
  const [mineLoading, setMineLoading] = useState(false);
  const [upstream, setUpstream] = useState<Upstream | null>(null);
  const [dir, setDir] = useState<DirectoryView | null>(null);
  const [dirLoading, setDirLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reach, setReach] = useState<Classmate[] | null>(null);
  const [form, setForm] = useState<Profile>({ name: "", github: "", email: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(""), 4000); };

  const loadProfile = useCallback(() => fetchProfile().then((p) => { setPv(p); setForm(p.profile); }).catch((e) => setError(String((e as Error).message))), []);

  const loadMine = useCallback(async (id: string) => {
    setMineLoading(true);
    try { setMine(await fetchMySprint(id)); } catch (e) { setError(String((e as Error).message)); }
    finally { setMineLoading(false); }
  }, []);

  const loadDir = useCallback(async (refresh = false) => {
    setDirLoading(true);
    try { setDir(await fetchDirectory(refresh)); } catch (e) { setError(String((e as Error).message)); }
    finally { setDirLoading(false); }
  }, []);

  useEffect(() => {
    fetchCourse().then(setCourse).catch(() => setCourse(null));
    loadProfile();
    fetchSprints().then((r) => { setSprints(r.sprints); setSprintId(r.current); loadMine(r.current); });
    fetchUpstream().then(setUpstream).catch(() => {});
  }, [loadProfile, loadMine]);

  const save = async () => {
    setError("");
    try { await saveProfile(form); await loadProfile(); flash("Saved."); if (sprintId) loadMine(sprintId); setDir(null); }
    catch (e) { setError(String((e as Error).message)); }
  };

  const doRestart = async () => {
    setNotice("Restarting server…");
    const back = await restartServer();
    if (back) { flash("Server is back."); fetchCourse().then(setCourse).catch(() => setCourse(null)); loadProfile(); }
    else setNotice("Server did not come back within 30s - start it manually: app\\launch.vbs");
  };

  const profile = pv?.profile ?? null;
  const daysWord = (n: number) => n < 0 ? `${-n} day${-n === 1 ? "" : "s"} overdue` : n === 0 ? "due today" : `${n} day${n === 1 ? "" : "s"} left`;
  const ciChip = (ci: NonNullable<MySprint["fork"]["ci"]>) =>
    ci.status && ci.status !== "completed" ? <span className="chip attendee">{ci.status}</span>
    : ci.conclusion === "success" ? <span className="chip ok">green</span>
    : ci.conclusion === "none" ? <span className="muted">no runs yet</span>
    : <span className="chip warn">{ci.conclusion}</span>;

  return (
    <div className="app">
      <header>
        <AppMenu course={course} profile={profile} onRestartServer={doRestart} />
        <h1>{course?.code ?? "CSCI 5802"} <span className="sub">- Student</span></h1>
        {profile?.github && <span className="host" title="Your GitHub handle (Setup tab)">@{profile.github}</span>}
        <span className="term">{course ? `${course.term} · ${course.title}` : "server offline?"}</span>
        <BuildStamp />
      </header>

      <nav>
        {(["sprint", "classmates", "setup"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => { setTab(t); if (t === "classmates" && dir === null) loadDir(); }}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
      {notice && <p className="muted">{notice}</p>}
      {pv && !pv.gh.authed && tab !== "setup" && (
        <p className="error">GitHub CLI isn't signed in, so nothing about your fork can be shown - see the Setup tab.</p>
      )}

      {tab === "sprint" && (
        <div className="panel">
          <div className="row">
            <select value={sprintId} onChange={(e) => { setSprintId(e.target.value); loadMine(e.target.value); }}>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.kind === "lab" ? "" : "★ "}{s.title} (due {s.due})</option>)}
            </select>
            <button onClick={() => loadMine(sprintId)} disabled={mineLoading}>{mineLoading ? "Asking GitHub…" : "Refresh"}</button>
            {mine && <span className="muted">window {mine.sprint.start} {"→"} {mine.sprint.due} · <strong>{daysWord(mine.sprint.daysLeft)}</strong></span>}
            {mine?.sprint.spec && <a href={mine.sprint.spec} target="_blank" rel="noreferrer" title="Open this sprint's spec on the course site">{mine.sprint.kind === "lab" ? "lab spec" : "module page"} {"↗"}</a>}
          </div>

          {mine && !mine.github && <p className="muted">Set your GitHub handle on the Setup tab and this fills in.</p>}
          {mine && mine.github && !mine.fork.exists && (
            <p className="error">
              No fork found at github.com/{mine.github}/{course?.starterRepo}. Fork{" "}
              <a href={`https://github.com/${course?.owner}/${course?.starterRepo}/fork`} target="_blank" rel="noreferrer">the starter</a>, or fix the handle on Setup.
            </p>
          )}
          {mine && mine.fork.exists && (
            <dl className="dialog-facts sprint-facts">
              <dt>Fork</dt><dd><a href={mine.fork.url} target="_blank" rel="noreferrer">{mine.github}/{course?.starterRepo}</a> <span className="muted">last push {mine.fork.pushedAt ? new Date(mine.fork.pushedAt).toLocaleString() : "—"}</span></dd>
              <dt>Commits in window</dt><dd>{mine.fork.commits ?? "—"}{mine.fork.commits === 0 && <span className="chip warn">none yet</span>}</dd>
              <dt>CI</dt><dd>{mine.fork.ci ? <>{ciChip(mine.fork.ci)} {mine.fork.ci.url && <a href={mine.fork.ci.url} target="_blank" rel="noreferrer">latest run {"↗"}</a>}</> : "—"}</dd>
              <dt>Upstream</dt>
              <dd>
                {mine.fork.behind === null || mine.fork.behind === undefined ? "—"
                  : mine.fork.behind === 0 ? <span className="chip ok">current</span>
                  : <span className="chip warn">{mine.fork.behind} behind</span>}
                {typeof mine.fork.ahead === "number" && mine.fork.ahead > 0 && <span className="muted"> · {mine.fork.ahead} ahead</span>}
                {(mine.fork.behind ?? 0) > 0 && (
                  <div className="muted sync-hint">
                    To catch up: <code>git fetch upstream && git merge upstream/{mine.fork.branch} && git push</code>
                    {" "}(add the remote once: <code>git remote add upstream https://github.com/{course?.owner}/{course?.starterRepo}.git</code>)
                  </div>
                )}
              </dd>
              <dt>Open PRs</dt>
              <dd>{mine.fork.prsOpen && mine.fork.prsOpen.length
                ? mine.fork.prsOpen.map((p) => <div key={p.number}><a href={p.html_url} target="_blank" rel="noreferrer">#{p.number} {p.title}</a></div>)
                : <span className="muted">none</span>}</dd>
            </dl>
          )}

          {upstream && upstream.commits.length > 0 && (
            <details className="upstream">
              <summary className="muted">Latest on {upstream.repo}</summary>
              <ul className="commits">{upstream.commits.map((c) => (
                <li key={c.sha}><span className="mono">{c.sha}</span> <a href={c.url} target="_blank" rel="noreferrer">{c.message}</a> <span className="muted">{c.date.slice(0, 10)}</span></li>
              ))}</ul>
            </details>
          )}
        </div>
      )}

      {tab === "classmates" && (
        <div className="panel classmates">
          <div className="row">
            <span className="muted">Classmates who added themselves to {course?.directoryPath} (opt-in; see Setup to add yourself).</span>
            <button onClick={() => loadDir(true)} disabled={dirLoading}>{dirLoading ? "Loading…" : "Refresh"}</button>
            <button style={{ marginLeft: "auto" }} disabled={selected.size === 0}
              onClick={() => dir && setReach(dir.entries.filter((e) => selected.has(e.github)))}>
              {"💬"} Reach {selected.size === 0 ? "…" : `${selected.size} selected`}
            </button>
          </div>
          {dir?.error && <p className="error">{dir.error}</p>}
          {dir && !dir.listed && profile?.github && <p className="muted">You're not in the directory yet - classmates can't reach you until you add yourself (Setup tab).</p>}
          <table>
            <thead><tr>
              <th className="select-col"><input type="checkbox" checked={!!dir && dir.entries.some((e) => !e.me) && dir.entries.filter((e) => !e.me).every((e) => selected.has(e.github))}
                onChange={(e) => setSelected(e.target.checked && dir ? new Set(dir.entries.filter((x) => !x.me).map((x) => x.github)) : new Set())} /></th>
              <th className="actions-col"></th><th>Name</th><th>GitHub</th><th>Email</th>
            </tr></thead>
            <tbody>{(dir?.entries ?? []).map((c) => (
              <tr key={c.github} className={c.me ? "me" : ""}>
                <td className="select-col">{!c.me && <input type="checkbox" checked={selected.has(c.github)}
                  onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(c.github); else n.delete(c.github); return n; })} />}</td>
                <td className="actions-col">
                  {c.email && !c.me
                    ? <button className="icon-btn" title={`Teams chat with ${c.name}`} onClick={() => setReach([c])}>{"💬"}</button>
                    : <span className="icon-btn off" title={c.me ? "That's you" : "No email in the directory"}>{"💬"}</span>}
                  {c.email && !c.me
                    ? <a className="icon-btn" title={`Email ${c.email}`} href={`mailto:${c.email}`}>{"✉"}</a>
                    : <span className="icon-btn off" title="No email">{"✉"}</span>}
                  <a className="icon-btn" title={`GitHub: ${c.github}`} href={`https://github.com/${c.github}`} target="_blank" rel="noreferrer">{"⎇"}</a>
                  <a className="icon-btn" title={`Fork: ${c.github}/${course?.starterRepo}`} href={`https://github.com/${c.github}/${course?.starterRepo}`} target="_blank" rel="noreferrer">{"⑂"}</a>
                </td>
                <td>{c.name} {c.me && <span className="chip attendee">you</span>}</td>
                <td className="mono">{c.github}</td>
                <td>{c.email || <span className="muted">not shared</span>}</td>
              </tr>
            ))}</tbody>
          </table>
          {dir && dir.entries.length === 0 && !dir.error && <p className="muted">Nobody yet. Be the first - Setup tab.</p>}
          {dir === null && dirLoading && <p className="muted">Loading…</p>}
          {reach && <TeamsDialog key={reach.map((p) => p.github).join(",")} people={reach} onClose={() => setReach(null)} />}
        </div>
      )}

      {tab === "setup" && pv && (
        <div className="panel setup">
          <h3>1. GitHub CLI</h3>
          <p>
            {!pv.gh.installed ? <span className="chip warn">not installed</span>
              : !pv.gh.authed ? <span className="chip warn">not signed in</span>
              : <span className="chip ok">signed in as {pv.gh.login}</span>}
            {" "}
            <span className="muted">
              {!pv.gh.installed ? <>Install from <a href="https://cli.github.com/" target="_blank" rel="noreferrer">cli.github.com</a>, then run <code>gh auth login</code> in a terminal and Menu {">"} Restart server.</>
                : !pv.gh.authed ? <>Run <code>gh auth login</code> in a terminal, then Menu {">"} Restart server.</>
                : "Everything on the Sprint tab is read through gh - it never pushes or changes anything."}
            </span>
          </p>

          <h3>2. Who you are</h3>
          <p className="muted">Stored in <span className="mono">{course?.dataDir}</span>, outside the repo, so it can't be committed by accident.</p>
          <label className="field">Name (as you'd like classmates to see it)
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ann Lee" />
          </label>
          <label className="field">GitHub handle
            <input value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} placeholder="octocat" spellCheck={false} />
          </label>
          <label className="field">YSU email (what Teams calls you by)
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@student.ysu.edu" />
          </label>
          <div className="row"><button className="primary" onClick={save}>Save</button></div>

          <h3>3. Your fork</h3>
          <p className="muted">
            Your work lives in your fork of <a href={`https://github.com/${course?.owner}/${course?.starterRepo}`} target="_blank" rel="noreferrer">{course?.owner}/{course?.starterRepo}</a>.
            {profile?.github && <> The Sprint tab checks <a href={`https://github.com/${profile.github}/${course?.starterRepo}`} target="_blank" rel="noreferrer">github.com/{profile.github}/{course?.starterRepo}</a>.</>}
          </p>

          <h3>4. Add yourself to the class directory (optional)</h3>
          <p className="muted">
            Classmates can only call or chat with you if you're listed. Add this entry to <span className="mono">{course?.directoryPath}</span> in the
            upstream repo by pull request - your first PR of the term - and leave out the email if you'd rather not share it.
          </p>
          <pre className="entry">{JSON.stringify(pv.directoryEntry, null, 2)}</pre>
          <div className="row">
            <button onClick={() => navigator.clipboard.writeText(JSON.stringify(pv.directoryEntry, null, 2)).then(() => flash("Copied."))}>Copy entry</button>
            <a href={`https://github.com/${course?.owner}/${course?.starterRepo}/edit/main/${course?.directoryPath}`} target="_blank" rel="noreferrer">
              <button>Edit {course?.directoryPath} on GitHub {"↗"}</button>
            </a>
            <span className="muted">GitHub will fork-and-PR for you if you can't push upstream.</span>
          </div>
        </div>
      )}
    </div>
  );
}
