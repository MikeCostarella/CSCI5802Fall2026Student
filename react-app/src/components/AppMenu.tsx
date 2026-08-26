// The accordion menu in the title bar - same pattern as the instructor's
// app. Link sections come from /api/course + your profile, so course.mjs
// stays the only place the course is named.
import { useEffect, useRef, useState } from "react";
import type { Course, Profile } from "../types";

interface MenuLink { label: string; href: string; note?: string; }
interface MenuSection { title: string; links: MenuLink[]; }

function sectionsFor(course: Course, profile: Profile | null): MenuSection[] {
  const gh = (owner: string, repo: string) => `https://github.com/${owner}/${repo}`;
  const mine = profile?.github ? gh(profile.github, course.starterRepo) : "";
  const myApp = profile?.github ? gh(profile.github, course.studentRepo) : "";
  const upstream = gh(course.owner, course.starterRepo);
  const template = gh(course.owner, course.studentRepo);
  return [
    { title: "Course", links: [
      { label: "Course site", href: course.courseSiteUrl, note: "modules, labs, specs" },
      { label: `${course.institution} Blackboard`, href: course.lmsUrl, note: "submissions and grades" },
    ] },
    { title: "My repos", links: mine ? [
      { label: `${profile!.github}/${course.starterRepo}`, href: mine, note: "your fork - your work" },
      { label: "Pull requests", href: `${mine}/pulls` },
      { label: "Actions (CI)", href: `${mine}/actions`, note: "is the build green?" },
      { label: `${profile!.github}/${course.studentRepo}`, href: myApp, note: "your copy of this app" },
    ] : [{ label: "Set your GitHub handle on the Setup tab", href: "#" }] },
    { title: "Instructor's repos", links: [
      { label: course.starterRepo, href: upstream, note: "the original you forked" },
      { label: "Pull requests", href: `${upstream}/pulls`, note: "your directory PR waits here" },
      { label: "Actions", href: `${upstream}/actions` },
      { label: course.directoryPath, href: `${upstream}/blob/main/${course.directoryPath}`, note: "class directory (opt-in)" },
      { label: course.studentRepo, href: template, note: "this app's template - merge updates from it" },
      { label: course.courseSiteRepo, href: gh(course.owner, course.courseSiteRepo), note: "course site source" },
    ] },
  ];
}

interface Props { course: Course | null; profile: Profile | null; onRestartServer: () => void; }

export default function AppMenu({ course, profile, onRestartServer }: Props) {
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["Course", "My repos"]));
  const anchorRef = useRef<HTMLDivElement>(null);

  const toggleSection = (t: string) => setOpenSections((prev) => {
    const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n;
  });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="menu-anchor" ref={anchorRef}>
      <button className={`menu-btn ${open ? "open" : ""}`} disabled={!course}
        title={course ? "" : "Links come from the server, which looks offline"} onClick={() => setOpen((o) => !o)}>
        &#9776; Menu
      </button>
      {open && course && (
        <div className="menu-dropdown">
          {sectionsFor(course, profile).map((section) => (
            <div key={section.title} className="menu-section">
              <button className="menu-header" onClick={() => toggleSection(section.title)}>
                <span className={`chevron ${openSections.has(section.title) ? "open" : ""}`}>&#9656;</span>
                {section.title}
              </button>
              {openSections.has(section.title) && (
                <div className="menu-links">
                  {section.links.map((link) => (
                    <a key={link.label} href={link.href} target={link.href === "#" ? undefined : "_blank"} rel="noreferrer" onClick={() => setOpen(false)}>
                      {link.label}
                      {link.note && <span className="menu-note">{link.note}</span>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="menu-section">
            <button className="menu-header" onClick={() => toggleSection("Server")}>
              <span className={`chevron ${openSections.has("Server") ? "open" : ""}`}>&#9656;</span>
              Server
            </button>
            {openSections.has("Server") && (
              <div className="menu-links">
                <button className="menu-action" onClick={() => { setOpen(false); onRestartServer(); }}>
                  Restart server
                  <span className="menu-note">after a git pull that changed server/</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
