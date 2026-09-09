import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRelPath, timestamp } from "./repos.mjs";

test("safeRelPath accepts ordinary relative paths and normalizes backslashes", () => {
  assert.equal(safeRelPath("src/index.ts"), "src/index.ts");
  assert.equal(safeRelPath("src\\index.ts"), "src/index.ts");
  assert.equal(safeRelPath("a/../b"), null);
  assert.equal(safeRelPath(".."), null);
});

test("safeRelPath rejects absolute paths on both platforms", () => {
  assert.equal(safeRelPath("/etc/passwd"), null);
  assert.equal(safeRelPath("C:\\Windows"), null);
  assert.equal(safeRelPath("c:/x"), null);
  assert.equal(safeRelPath(""), null);
  assert.equal(safeRelPath(undefined), null);
});

test("timestamp is sortable and filename-safe", () => {
  const t = timestamp();
  assert.match(t, /^\d{8}T\d{6}Z$/);
});
