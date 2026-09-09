// Which Google account is the app window signed in as?
//
// A web page cannot ask Chrome that. But this server runs on the same
// machine, and Chrome keeps a per-profile record in
//   %LOCALAPPDATA%\Google\Chrome\User Data\Local State   (profile.info_cache)
// with the account name/email and the downloaded avatar
//   %LOCALAPPDATA%\Google\Chrome\User Data\<profile dir>\Google Profile Picture.png
//
// Which profile the window is in: app/launch.ps1 pins one with
// --profile-directory and passes it as ?profile=<dir> so the page can ask
// for exactly that one. Without the hint we fall back to profile.last_used,
// which is the profile an unpinned --app window would have landed in.
//
// Read-only: nothing here writes to Chrome's files. CSCI5802_STUDENT_CHROME_USER_DATA
// overrides the location (tests, or a portable Chrome).
import fs from "node:fs";
import path from "node:path";

export function userDataDir() {
  return process.env.CSCI5802_STUDENT_CHROME_USER_DATA
    || path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data");
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

const SAFE_DIR = /^[A-Za-z0-9 _.-]{1,64}$/; // "Default", "Profile 3", ...

/** Resolve a manifest's name, following Chrome's __MSG_key__ localization. */
function extensionName(extVersionDir, manifest) {
  const raw = String(manifest?.name ?? "");
  const m = raw.match(/^__MSG_(.+)__$/);
  if (!m) return raw;
  const key = m[1].toLowerCase();
  let locales = [];
  try { locales = fs.readdirSync(path.join(extVersionDir, "_locales")); } catch { return raw; }
  locales.sort((a, b) => (b.startsWith("en") ? 1 : 0) - (a.startsWith("en") ? 1 : 0));
  for (const loc of locales) {
    const messages = readJsonSafe(path.join(extVersionDir, "_locales", loc, "messages.json"));
    if (!messages) continue;
    for (const [k, v] of Object.entries(messages)) if (k.toLowerCase() === key && v?.message) return String(v.message);
  }
  return raw;
}

/** Does this profile directory carry an extension whose name says Claude? */
function hasClaudeExtension(dir) {
  const extRoot = path.join(userDataDir(), dir, "Extensions");
  let ids = [];
  try { ids = fs.readdirSync(extRoot); } catch { return false; }
  for (const id of ids) {
    let versions = [];
    try { versions = fs.readdirSync(path.join(extRoot, id)); } catch { continue; }
    for (const v of versions) {
      const vDir = path.join(extRoot, id, v);
      const manifest = readJsonSafe(path.join(vDir, "manifest.json"));
      if (manifest && /claude/i.test(extensionName(vDir, manifest))) return true;
    }
  }
  return false;
}

/**
 * Which profile the app window should open in: the one carrying the Claude
 * extension (most recently active if several), same rule as StatehouseUI,
 * so this app and everything it opens live in the browser family Claude
 * uses - which is also the one signed in to GitHub. Falls back to Chrome's
 * last-used profile. Signed-out throwaway profiles never win.
 */
export function defaultProfileDir() {
  if (process.env.CSCI5802_STUDENT_CHROME_PROFILE) return process.env.CSCI5802_STUDENT_CHROME_PROFILE;
  const ls = readJsonSafe(path.join(userDataDir(), "Local State"));
  const cache = ls?.profile?.info_cache ?? {};
  const carriers = Object.entries(cache)
    .filter(([dir]) => SAFE_DIR.test(dir) && hasClaudeExtension(dir))
    .sort((a, b) => (b[1]?.active_time ?? 0) - (a[1]?.active_time ?? 0));
  if (carriers.length > 0) return carriers[0][0];
  // Otherwise: the most recently active SIGNED-IN profile, then last_used.
  const signedIn = Object.entries(cache)
    .filter(([dir, info]) => SAFE_DIR.test(dir) && info?.user_name)
    .sort((a, b) => (b[1]?.active_time ?? 0) - (a[1]?.active_time ?? 0));
  if (signedIn.length > 0) return signedIn[0][0];
  return ls?.profile?.last_used ?? null;
}

/** Everything the header needs about one profile, or null if it is unknown. */
export function profileInfo(dir) {
  const ls = readJsonSafe(path.join(userDataDir(), "Local State"));
  const cache = ls?.profile?.info_cache ?? {};
  const wanted = dir && SAFE_DIR.test(dir) && cache[dir] ? dir : (ls?.profile?.last_used ?? null);
  const info = wanted ? cache[wanted] : null;
  if (!info) return null;

  const pictureFile = info.gaia_picture_file_name
    ? path.join(userDataDir(), wanted, String(info.gaia_picture_file_name))
    : null;
  return {
    dir: wanted,
    pinned: wanted === dir,                       // false = guessed from last_used
    name: info.gaia_name || info.name || wanted,  // "Mike Costarella" or the local profile label
    email: info.user_name || null,                // signed-in Google account, or null for a local profile
    hasPicture: !!(pictureFile && fs.existsSync(pictureFile)),
  };
}

/** Absolute path of the avatar PNG, or null. */
export function profilePicturePath(dir) {
  const info = profileInfo(dir);
  if (!info?.hasPicture) return null;
  const ls = readJsonSafe(path.join(userDataDir(), "Local State"));
  const file = ls?.profile?.info_cache?.[info.dir]?.gaia_picture_file_name;
  return file ? path.join(userDataDir(), info.dir, String(file)) : null;
}
