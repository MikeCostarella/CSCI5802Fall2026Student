// The class directory: an opt-in JSON list in the starter repo that each
// student adds themselves to by pull request. This app only READS it
// (through gh, so a private repo works too) and caches for ten minutes.
//
// Shape of directory.json:  [{ "name": "Ann Lee", "github": "alee", "email": "alee@student.ysu.edu" }]
// Anything else in an entry is ignored; entries without a github handle are
// dropped. Pure parsing here so it can be tested without GitHub.
import { COURSE } from "./course.mjs";
import { runGh } from "./gh.mjs";

/** Raw file text -> clean entries, sorted by name. Throws on malformed JSON. */
export function parseDirectory(text) {
  const raw = JSON.parse(String(text || "[]"));
  if (!Array.isArray(raw)) throw new Error("directory.json must be a JSON array");
  return raw
    .filter((e) => e && typeof e === "object" && typeof e.github === "string" && e.github.trim())
    .map((e) => ({
      name: String(e.name ?? e.github).trim(),
      github: e.github.trim().replace(/^@/, ""),
      email: typeof e.email === "string" ? e.email.trim() : "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The entry a student should add for themselves - shown as copyable JSON. */
export function entryFor(profile) {
  return { name: profile.name || "", github: profile.github || "", email: profile.email || "" };
}

let cache = { at: 0, entries: null, error: null };

export async function fetchDirectory({ force = false } = {}) {
  if (!force && cache.entries && Date.now() - cache.at < 10 * 60 * 1000) return cache;
  const r = await runGh(["api", `repos/${COURSE.owner}/${COURSE.starterRepo}/contents/${COURSE.directoryPath}`,
    "-H", "Accept: application/vnd.github.raw"]);
  if (!r.ok) {
    const error = /404/.test(r.err) ? `no ${COURSE.directoryPath} in ${COURSE.starterRepo} yet` : (r.err.trim() || "gh failed");
    cache = { at: Date.now(), entries: cache.entries, error };
    return cache;
  }
  try { cache = { at: Date.now(), entries: parseDirectory(r.out), error: null }; }
  catch (e) { cache = { at: Date.now(), entries: cache.entries, error: String(e.message) }; }
  return cache;
}
