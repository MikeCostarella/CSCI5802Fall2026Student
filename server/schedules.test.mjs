// The cron / workflow / warning logic is tested where it lives:
// FleetShareableCodeComponents/scheduled-jobs/test. This covers what the
// Student app adds: which repos are "class" (read-only) and which are "yours".
import { test } from "node:test";
import assert from "node:assert/strict";
import { classTargets, forkTargets } from "./schedules.mjs";

const REPOS = [
  { name: "csci5802-api-starter", full_name: "ada/csci5802-api-starter", owner: "ada", fork: true, archived: false, mine: true },
  { name: "Bullpen", full_name: "MyWebSiteParticipants/Bullpen", owner: "MyWebSiteParticipants", fork: false, archived: false, private: false, pushed_at: "2026-10-02T00:00:00Z", default_branch: "main" },
  { name: "Notes", full_name: "MyWebSiteParticipants/Notes", owner: "MyWebSiteParticipants", fork: false, archived: false },
  { name: "Old", full_name: "MyWebSiteParticipants/Old", owner: "MyWebSiteParticipants", archived: true },
];

test("classTargets: live org repos only, and read-only", () => {
  const t = classTargets(REPOS);
  assert.deepEqual(t.map((x) => x.fullName), ["MyWebSiteParticipants/Bullpen", "MyWebSiteParticipants/Notes"]);
  assert.deepEqual(t[0].can, { toggle: false, run: false, edit: false });
});

test("forkTargets: your real forks of class repos (+ starter fork), yours to run", async () => {
  const known = {
    "ada/csci5802-api-starter": { fork: true, parent: "MikeCostarella/csci5802-api-starter" },
    "ada/Bullpen": { fork: true, parent: "MyWebSiteParticipants/Bullpen" },
    "ada/Notes": { fork: false, parent: null }, // same name, not a fork - not shown
  };
  const t = await forkTargets(REPOS, "ada", async (full) => known[full] ?? null);
  assert.deepEqual(t.map((x) => x.fullName), ["ada/csci5802-api-starter", "ada/Bullpen"]);
  assert.equal(t[1].label, "Bullpen (your fork)");
  assert.deepEqual(t[1].can, { toggle: true, run: true, edit: true });
});

test("forkTargets: a fork of something else under the same name is not yours-of-ours", async () => {
  const t = await forkTargets(REPOS, "ada", async (full) => (full === "ada/Bullpen" ? { fork: true, parent: "someone/Bullpen" } : null));
  assert.deepEqual(t, []);
});

test("forkTargets: no handle, no forks", async () => {
  assert.deepEqual(await forkTargets(REPOS, "", async () => ({ fork: true })), []);
});
