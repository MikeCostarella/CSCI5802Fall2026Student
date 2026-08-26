// Sprint windows (pure) and what YOUR fork looks like inside the current
// one - the same signals the instructor's board reads, so what you see is
// what they see.
import { COURSE, SPRINTS, specUrl } from "./course.mjs";
import { ghJson } from "./gh.mjs";

/** Each sprint with its window: start = latest earlier due date, else term start. */
export function sprintWindows(sprints = SPRINTS, termStart = COURSE.termStart) {
  const dues = [...new Set(sprints.map((s) => s.due))].sort();
  return sprints.map((s) => {
    const prior = dues.filter((d) => d < s.due).pop();
    return { ...s, start: prior ?? termStart, spec: specUrl(s) };
  });
}

/** The sprint whose window contains today: first item due today or later. */
export function currentSprintId(todayIso, sprints = SPRINTS) {
  const byDue = [...sprints].sort((a, b) => a.due.localeCompare(b.due));
  return (byDue.find((s) => s.due >= todayIso) ?? byDue[byDue.length - 1]).id;
}

/** Days from today to a due date; negative when past. */
export function daysUntil(dueIso, todayIso) {
  return Math.round((Date.parse(dueIso) - Date.parse(todayIso)) / 86400000);
}

/** Your fork inside one window. All read-only gh calls; null = couldn't ask. */
export async function myForkSignals(github, sprint) {
  if (!github) return { exists: false };
  const repo = `${github}/${COURSE.starterRepo}`;
  const info = await ghJson(["api", `repos/${repo}`, "--jq", "{default_branch, pushed_at, html_url}"]);
  if (!info) return { exists: false };
  const { start, due } = sprint;
  const commits = await ghJson(["api",
    `repos/${repo}/commits?since=${start}T00:00:00Z&until=${due}T23:59:59Z&per_page=100`,
    "--jq", "[.[] | .sha] | length"]);
  const prs = await ghJson(["api", `repos/${repo}/pulls?state=open&per_page=20`,
    "--jq", "[.[] | {number, title, html_url, created_at}]"]);
  const run = await ghJson(["api", `repos/${repo}/actions/runs?per_page=1`,
    "--jq", "{conclusion: (.workflow_runs[0].conclusion // \"none\"), url: (.workflow_runs[0].html_url // \"\"), status: (.workflow_runs[0].status // \"\")}"]);
  const cmp = await ghJson(["api", `repos/${repo}/compare/${COURSE.owner}:${info.default_branch}...${info.default_branch}`,
    "--jq", "{behind: .behind_by, ahead: .ahead_by}"]);
  return {
    exists: true, url: info.html_url, pushedAt: info.pushed_at, branch: info.default_branch,
    commits, prsOpen: prs ?? [],
    ci: run ? { conclusion: run.conclusion, status: run.status, url: run.url } : null,
    behind: cmp?.behind ?? null, ahead: cmp?.ahead ?? null,
  };
}
