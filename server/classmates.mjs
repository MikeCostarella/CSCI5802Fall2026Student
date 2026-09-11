// Your own classmates list: people you add by hand, stored locally in
// classmates.json under DATA_DIR (next to profile.json - outside the repo).
// The opt-in directory in the starter repo is what everyone shares; this is
// the private complement for classmates who haven't added themselves there
// (or a study group you want reachable regardless). Pure functions here so
// the merge rules can be tested without GitHub or a disk.
//
// Shape of classmates.json: [{ "name": "Ann Lee", "github": "alee", "email": "alee@student.ysu.edu" }]
import { readDoc, writeDoc } from "./store.mjs";

const DOC = "classmates";

export function cleanHandle(github) {
  return String(github ?? "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
}

/** Form fields -> one clean entry. Throws when there's no GitHub handle. */
export function normalizeClassmate(fields) {
  const github = cleanHandle(fields?.github);
  if (!github) throw new Error("a GitHub handle is required");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(github)) throw new Error(`not a GitHub handle: ${github}`);
  const email = String(fields?.email ?? "").trim();
  if (email && !email.includes("@")) throw new Error(`not an email address: ${email}`);
  return { name: String(fields?.name ?? "").trim() || github, github, email };
}

/** Add or replace (by handle, case-insensitive); returns the new list, sorted by name. */
export function upsertClassmate(list, entry) {
  const key = entry.github.toLowerCase();
  return [...(list ?? []).filter((c) => c.github.toLowerCase() !== key), entry]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function removeClassmate(list, github) {
  const key = cleanHandle(github).toLowerCase();
  return (list ?? []).filter((c) => c.github.toLowerCase() !== key);
}

/**
 * Directory entries + your own, one row per handle. Where both know someone
 * the directory's name and email win (they chose them), except that your
 * email fills a gap the directory left. `source` says where a row came from.
 */
export function mergeClassmates(directory, mine) {
  const rows = new Map();
  for (const e of directory ?? []) rows.set(e.github.toLowerCase(), { ...e, source: "directory" });
  for (const m of mine ?? []) {
    const key = m.github.toLowerCase();
    const d = rows.get(key);
    rows.set(key, d
      ? { ...d, email: d.email || m.email, source: "both" }
      : { name: m.name, github: m.github, email: m.email, source: "mine" });
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---- disk ----
export function readClassmates() {
  const raw = readDoc(DOC, []);
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) { try { out.push(normalizeClassmate(e)); } catch { /* skip a hand-edited bad row */ } }
  return out;
}
export function writeClassmates(list) { return writeDoc(DOC, list); }
