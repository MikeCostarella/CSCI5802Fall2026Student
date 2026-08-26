// Call or chat with classmates in Teams. This app builds the deep link;
// the Teams desktop client does the talking (and screen sharing).
import { useEffect, useState } from "react";
import { fetchTeamsLinks } from "../api";
import type { Classmate, TeamsLinks } from "../types";

interface Props { people: Classmate[]; onClose: () => void; }

function openInTeams(url: string) { window.location.assign(url); }

export default function TeamsDialog({ people, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<TeamsLinks | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchTeamsLinks(people.map((p) => p.github), message).then(setLinks).catch((e) => setError(String((e as Error).message)));
    }, 200);
    return () => clearTimeout(t);
  }, [people, message]);

  const reachable = people.filter((p) => !links?.missing.includes(p.github));

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="teams-dialog-title">
        <div className="dialog-head">
          <h2 id="teams-dialog-title">{people.length === 1 ? `Reach ${people[0].name}` : `Reach ${people.length} classmates`}</h2>
          <button className="icon-btn dialog-close" title="Close (Esc)" onClick={onClose}>{"✕"}</button>
        </div>
        {error && <p className="error">{error}</p>}
        <dl className="dialog-facts">
          <dt>Who</dt>
          <dd>
            {reachable.map((p) => <span key={p.github} className="chip attendee">{p.name}</span>)}
            {links?.missing.map((g) => <span key={g} className="chip warn" title="No email in the directory">{people.find((p) => p.github === g)?.name ?? g} (no email)</span>)}
          </dd>
        </dl>
        <label className="field">First message (optional, for chat)
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Want to pair on lab 3 tonight?" />
        </label>
        <div className="row">
          <button className="primary" disabled={!links || links.emails.length === 0} onClick={() => links && openInTeams(links.chat.app)}>{"💬"} Chat</button>
          <button disabled={!links || links.emails.length === 0} onClick={() => links && openInTeams(links.call.app)}>{"📞"} Call now</button>
          {links?.mailto && <a className="dialog-link" href={links.mailto}>Email instead {"↗"}</a>}
        </div>
        <details className="meet-fallback">
          <summary className="muted">If Teams doesn't open</summary>
          <p className="muted">The desktop client isn't registered for <code>msteams:</code> links here. The web versions offer to hand off to the app:</p>
          <div className="row">
            <button disabled={!links} onClick={() => links && window.open(links.chat.web, "_blank")}>Chat (web)</button>
            <button disabled={!links} onClick={() => links && window.open(links.call.web, "_blank")}>Call (web)</button>
          </div>
        </details>
      </div>
    </div>
  );
}
