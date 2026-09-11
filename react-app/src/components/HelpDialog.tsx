// The help window: topic list on the left, the topic on the right. Opened
// from Menu > Help, the ? button in the header, or F1 / ? on the keyboard,
// each landing on the topic for the tab you're on.
import { useEffect } from "react";
import type { Course } from "../types";
import { HELP_TOPICS, HelpBody, type HelpTopic } from "./help-content";

interface Props { topic: HelpTopic; course: Course | null; onTopic: (t: HelpTopic) => void; onClose: () => void; }

export default function HelpDialog({ topic, course, onTopic, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = HELP_TOPICS.find((t) => t.id === topic) ?? HELP_TOPICS[0];

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="dialog-head">
          <h2 id="help-title">Help <span className="muted">· {current.title}</span></h2>
          <button className="icon-btn dialog-close" title="Close (Esc)" onClick={onClose}>{"✕"}</button>
        </div>
        <div className="help-body">
          <nav className="help-nav" aria-label="Help topics">
            {HELP_TOPICS.map((t) => (
              <button key={t.id} className={t.id === topic ? "active" : ""} onClick={() => onTopic(t.id)}>{t.title}</button>
            ))}
          </nav>
          <div className="help-text"><HelpBody topic={topic} course={course} /></div>
        </div>
      </div>
    </div>
  );
}
