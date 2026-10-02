// Menu > Scheduled jobs: the shared scheduled-jobs panel in two views.
//
//   view=class  every scheduled job in the class org (COURSE.participantsOrg).
//               READ-ONLY here: Live belongs to the team, and enabling,
//               disabling or dispatching it is the Scrum Master's / instructor's
//               call. You see when it breaks; you fix it with a PR.
//   view=forks  the same workflows in YOUR forks of those repos (and your fork
//               of the starter). Yours to enable and run. GitHub turns
//               scheduled workflows OFF in a fork by default - the panel says so.
//
// The logic and the panel are the shared scheduled-jobs library
// (server/vendor/scheduled-jobs, from FleetShareableCodeComponents). This file
// only picks the repos and decides what you may do.
import { COURSE } from "./course.mjs";
import { runGh } from "./gh.mjs";
import { orgRepos } from "./repos.mjs";
import { json, readBody } from "./routes.mjs";
import { readDoc } from "./store.mjs";
import { createScheduledJobs, DEFAULT_TZ, WORKFLOW_FILE_RE } from "./vendor/scheduled-jobs/index.mjs";

const sj = createScheduledJobs({ runGh });
const HANDLE = /^[A-Za-z0-9-]{1,39}$/;

/** Your GitHub handle: the saved profile, else whoever gh is signed in as. */
async function myHandle() {
  const saved = String(readDoc("profile", {}).github || "").trim();
  if (saved) return saved;
  const me = await runGh(["api", "user", "--jq", ".login"]);
  return me.ok ? me.out.trim() : "";
}

/** The class repos: everything in the org that is live (no archived, not your own fork entry). */
export function classTargets(repos) {
  return repos
    .filter((r) => !r.archived && String(r.owner).toLowerCase() === COURSE.participantsOrg.toLowerCase())
    .map((r) => ({
      fullName: r.full_name,
      label: r.name,
      role: "class",
      pagesUrl: r.pagesUrl ?? null,
      repoInfo: { pushedAt: r.pushed_at, private: r.private, fork: r.fork, defaultBranch: r.default_branch },
      can: { toggle: false, run: false, edit: false },
    }));
}

/**
 * Your forks: for each class repo, <you>/<name> if it exists AND is a fork of
 * that repo; plus your starter fork. `info(fullName)` is sj.repoInfo.
 */
export async function forkTargets(repos, handle, info) {
  if (!HANDLE.test(handle || "")) return [];
  const out = [];
  for (const r of repos) {
    if (r.archived) continue;
    const isClass = String(r.owner).toLowerCase() === COURSE.participantsOrg.toLowerCase();
    const isMine = String(r.owner).toLowerCase() === handle.toLowerCase();
    const fullName = isMine ? r.full_name : isClass ? `${handle}/${r.name}` : null;
    if (!fullName) continue;
    const i = await info(fullName);
    if (!i || !i.fork) continue;
    if (isClass && String(i.parent || "").toLowerCase() !== r.full_name.toLowerCase()) continue;
    out.push({
      fullName,
      label: `${r.name} (your fork)`,
      role: "fork",
      repoInfo: i,
      can: { toggle: true, run: true, edit: true },
    });
  }
  return out;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // view -> { at, body, targets }

async function build(view, fresh) {
  const repos = await orgRepos({ refresh: fresh });
  if (view === "class") return { targets: classTargets(repos), scope: `class repos in ${COURSE.participantsOrg}` };
  const handle = await myHandle();
  if (!handle) return { targets: [], scope: "", note: "Set your GitHub handle in Setup (or sign in with gh auth login) to see your forks." };
  return { targets: await forkTargets(repos, handle, sj.repoInfo), scope: `forks owned by ${handle}` };
}

/** GET /api/schedules?view=class|forks[&fresh=1] */
export async function handleSchedules(res, url) {
  const view = url?.searchParams.get("view") === "forks" ? "forks" : "class";
  const fresh = url?.searchParams.get("fresh") === "1";
  const hit = cache.get(view);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return json(res, 200, { ...hit.body, cached: true });
  let built;
  try { built = await build(view, fresh); }
  catch (e) { return json(res, 200, { error: `Could not list ${COURSE.participantsOrg}'s repos: ${e.message || e}` }); }
  if (built.note) return json(res, 200, { error: built.note });
  const { jobs, errors } = await sj.jobsFor(built.targets);
  const body = { generated: new Date().toISOString(), tz: DEFAULT_TZ, scope: built.scope, jobs, errors };
  cache.set(view, { at: Date.now(), body, targets: built.targets });
  return json(res, 200, body);
}

/** Validate { repo: "<you>/<name>", file }: only one of YOUR forks, only a scheduled workflow in it. */
async function target(res, body) {
  if (!WORKFLOW_FILE_RE.test(body.file || "")) { json(res, 400, { error: "bad workflow file name" }); return null; }
  const handle = await myHandle();
  const fullName = String(body.repo || "");
  if (!handle || !fullName.toLowerCase().startsWith(`${handle.toLowerCase()}/`)) {
    json(res, 403, { error: "Only your own forks can be enabled or run from here. Class repos are the team's - ask in Sprints." });
    return null;
  }
  const targets = cache.get("forks")?.targets ?? (await build("forks", false)).targets;
  if (!targets.some((t) => t.fullName.toLowerCase() === fullName.toLowerCase())) {
    json(res, 400, { error: `${fullName} is not one of your forks of a class repo` });
    return null;
  }
  const remote = await sj.remoteWorkflows(fullName);
  if (!remote.workflows.some((w) => w.file === body.file)) {
    json(res, 400, { error: `${fullName} has no scheduled workflow ${body.file}` });
    return null;
  }
  return { fullName, file: body.file };
}

/** POST /api/schedule-toggle { repo: "<you>/<name>", file, enabled } */
export async function handleScheduleToggle(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const t = await target(res, body);
  if (!t) return;
  cache.delete("forks");
  return json(res, 200, await sj.toggle(t.fullName, t.file, !!body.enabled));
}

/** POST /api/schedule-run { repo: "<you>/<name>", file } */
export async function handleScheduleRun(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const t = await target(res, body);
  if (!t) return;
  cache.delete("forks");
  return json(res, 200, await sj.dispatch(t.fullName, t.file));
}
