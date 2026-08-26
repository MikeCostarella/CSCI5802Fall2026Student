// The /api endpoints. Each handler does one thing; json()/readBody() shared.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { COURSE } from "./course.mjs";
import { DATA_DIR } from "./config.mjs";
import { readDoc, writeDoc } from "./store.mjs";
import { ghJson, ghStatus } from "./gh.mjs";
import { currentSprintId, daysUntil, myForkSignals, sprintWindows } from "./sprints.mjs";
import { entryFor, fetchDirectory } from "./directory.mjs";
import { teamsLinks } from "./teams.mjs";

export function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e6) reject(new Error("body too large")); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_PROFILE = { name: "", github: "", email: "" };

/**
 * The saved profile, with the gh login standing in for an unset handle so
 * the app works before Setup has ever been saved. Nothing is written here.
 */
async function currentProfile() {
  const profile = { ...EMPTY_PROFILE, ...readDoc("profile", {}) };
  const gh = await ghStatus();
  if (!profile.github && gh.login) { profile.github = gh.login; if (!profile.name && gh.name) profile.name = gh.name; }
  return { profile, gh };
}

/** GET /api/course - identity + host, so the header can say which machine. */
export function handleCourse(res) {
  return json(res, 200, { ...COURSE, host: os.hostname(), dataDir: DATA_DIR });
}

/** GET /api/profile - who you are, plus what gh says about itself. */
export async function handleProfile(res) {
  const { profile, gh } = await currentProfile();
  return json(res, 200, { profile, gh, directoryEntry: entryFor(profile) });
}

/** POST /api/profile {name?, github?, email?} */
export async function handleProfileSave(req, res) {
  const fields = JSON.parse((await readBody(req)) || "{}");
  const profile = { ...EMPTY_PROFILE, ...readDoc("profile", {}) };
  for (const k of Object.keys(EMPTY_PROFILE)) if (k in fields) profile[k] = String(fields[k]).trim();
  profile.github = profile.github.replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
  writeDoc("profile", profile);
  return json(res, 200, { profile, directoryEntry: entryFor(profile) });
}

/** GET /api/sprints */
export function handleSprints(res) {
  const sprints = sprintWindows();
  const t = today();
  return json(res, 200, {
    sprints: sprints.map((s) => ({ ...s, daysLeft: daysUntil(s.due, t) })),
    current: currentSprintId(t),
  });
}

/** GET /api/my-sprint?sprint=<id> - your fork inside that window. */
export async function handleMySprint(res, url) {
  const id = url.searchParams.get("sprint") || currentSprintId(today());
  const sprint = sprintWindows().find((s) => s.id === id);
  if (!sprint) return json(res, 404, { error: `unknown sprint: ${id}` });
  const { profile } = await currentProfile();
  const fork = await myForkSignals(profile.github, sprint);
  return json(res, 200, { sprint: { ...sprint, daysLeft: daysUntil(sprint.due, today()) }, github: profile.github, fork });
}

/** GET /api/directory[?refresh=1] - classmates who opted in, and whether you're among them. */
export async function handleDirectory(res, url) {
  const dir = await fetchDirectory({ force: url.searchParams.has("refresh") });
  const { profile } = await currentProfile();
  const me = profile.github.toLowerCase();
  const entries = (dir.entries ?? []).map((e) => ({ ...e, me: e.github.toLowerCase() === me }));
  const upstream = `https://github.com/${COURSE.owner}/${COURSE.starterRepo}`;
  return json(res, 200, {
    entries, error: dir.error, fetchedAt: dir.at ? new Date(dir.at).toISOString() : null,
    listed: entries.some((e) => e.me),
    directoryUrl: `${upstream}/blob/main/${COURSE.directoryPath}`,
    editUrl: `${upstream}/edit/main/${COURSE.directoryPath}`,
    entry: entryFor(profile),
  });
}

/** GET /api/teams-links?github=a,b&message=... */
export async function handleTeamsLinks(res, url) {
  const wanted = (url.searchParams.get("github") || "").split(",").filter(Boolean).map((g) => g.toLowerCase());
  const dir = await fetchDirectory();
  const people = (dir.entries ?? []).filter((e) => wanted.includes(e.github.toLowerCase()));
  if (!people.length) return json(res, 400, { error: "nobody selected, or they are not in the directory" });
  return json(res, 200, teamsLinks(people, { message: url.searchParams.get("message") || "" }));
}

/** GET /api/upstream - the starter repo's latest activity, so "am I behind?" has a face. */
export async function handleUpstream(res) {
  const repo = `${COURSE.owner}/${COURSE.starterRepo}`;
  const last = await ghJson(["api", `repos/${repo}/commits?per_page=5`,
    "--jq", "[.[] | {sha: .sha[0:7], message: (.commit.message | split(\"\\n\")[0]), date: .commit.author.date, url: .html_url}]"]);
  return json(res, 200, { repo, url: `https://github.com/${repo}`, commits: last ?? [] });
}

/** POST /api/restart - same self-replacement trick as the instructor's app. */
export async function handleRestart(req, res) {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const child = spawn(process.execPath, [path.join(serverDir, "server.mjs")],
    { cwd: path.dirname(serverDir), detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {});
  child.unref();
  json(res, 200, { ok: true });
  setTimeout(() => process.exit(0), 400);
}
