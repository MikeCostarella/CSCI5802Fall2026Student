import assert from "node:assert/strict";
import { test } from "node:test";
import { currentSprintId, daysUntil, sprintWindows } from "./sprints.mjs";

const S = [
  { id: "lab-1", kind: "lab", module: "m01", due: "2026-08-31" },
  { id: "lab-2", kind: "lab", module: "m02", due: "2026-09-09" },
  { id: "cp-1",  kind: "checkpoint", module: "m08", due: "2026-10-26" },
];

test("windows start at term start, then at the previous due date", () => {
  const w = Object.fromEntries(sprintWindows(S, "2026-08-24").map((s) => [s.id, s]));
  assert.equal(w["lab-1"].start, "2026-08-24");
  assert.equal(w["lab-2"].start, "2026-08-31");
  assert.ok(w["lab-1"].spec.endsWith("#/m/m01/lab"));
  assert.ok(w["cp-1"].spec.endsWith("#/m/m08"));
});

test("current sprint is the first not yet due; past term end, the last", () => {
  assert.equal(currentSprintId("2026-08-31", S), "lab-1");
  assert.equal(currentSprintId("2026-09-01", S), "lab-2");
  assert.equal(currentSprintId("2026-12-25", S), "cp-1");
});

test("days until", () => {
  assert.equal(daysUntil("2026-08-31", "2026-08-25"), 6);
  assert.equal(daysUntil("2026-08-31", "2026-09-02"), -2);
});
