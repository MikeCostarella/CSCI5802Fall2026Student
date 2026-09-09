// The avatar in the title bar: which Google account the app window is
// signed in as. launch.ps1 pins the Chrome profile and passes it as
// ?profile=<dir>; the server reads Chrome's own profile store and serves the
// picture. Hover for name + email; a plain initial when there is no photo.

import { useEffect, useState } from "react";
import { fetchChromeProfile, chromeProfilePictureUrl } from "../api";
import type { ChromeProfile as Info } from "../types";

export default function ChromeProfile() {
  const [info, setInfo] = useState<Info | null | undefined>(undefined); // undefined = loading
  const dir = new URLSearchParams(window.location.search).get("profile");

  useEffect(() => {
    fetchChromeProfile(dir).then(setInfo).catch(() => setInfo(null));
  }, [dir]);

  if (!info) return null; // no Chrome profile store on this machine, or an older server

  const who = info.email ? `${info.name} · ${info.email}` : info.name;
  const title = `${info.pinned ? "Chrome profile" : "Chrome profile (last used - launcher did not pin one)"}: ${who} [${info.dir}]`;
  return (
    <span className="chrome-profile" title={title}>
      {info.hasPicture
        ? <img src={chromeProfilePictureUrl(info.dir)} alt={info.name} />
        : <span className="initial">{(info.name || "?").trim()[0]?.toUpperCase()}</span>}
      {!info.pinned && <span className="unpinned" aria-hidden="true">?</span>}
    </span>
  );
}
