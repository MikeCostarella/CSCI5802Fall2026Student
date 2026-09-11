import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeClassmates, normalizeClassmate, removeClassmate, upsertClassmate } from "./classmates.mjs";

test("normalizes a hand-typed entry", () => {
  assert.deepEqual(normalizeClassmate({ name: " Ann Lee ", github: "https://github.com/alee/", email: " a@x " }),
    { name: "Ann Lee", github: "alee", email: "a@x" });
  assert.deepEqual(normalizeClassmate({ github: "@bray" }), { name: "bray", github: "bray", email: "" });
  assert.throws(() => normalizeClassmate({ name: "Nobody" }), /handle is required/);
  assert.throws(() => normalizeClassmate({ github: "not a handle!" }), /not a GitHub handle/);
  assert.throws(() => normalizeClassmate({ github: "alee", email: "nope" }), /not an email/);
});

test("upsert replaces by handle, case-insensitively, and keeps the list sorted", () => {
  let list = upsertClassmate([], { name: "Zed", github: "zed", email: "" });
  list = upsertClassmate(list, { name: "Ann Lee", github: "alee", email: "" });
  list = upsertClassmate(list, { name: "Zed Ray", github: "ZED", email: "z@x" });
  assert.deepEqual(list, [{ name: "Ann Lee", github: "alee", email: "" }, { name: "Zed Ray", github: "ZED", email: "z@x" }]);
  assert.deepEqual(removeClassmate(list, "@Zed"), [{ name: "Ann Lee", github: "alee", email: "" }]);
});

test("merge: directory wins, yours fills gaps, source says which", () => {
  const dir = [{ name: "Ann Lee", github: "alee", email: "" }, { name: "Bob Ray", github: "bray", email: "b@x" }];
  const mine = [{ name: "Annie", github: "ALEE", email: "ann@x" }, { name: "Cy Dee", github: "cdee", email: "" }];
  assert.deepEqual(mergeClassmates(dir, mine), [
    { name: "Ann Lee", github: "alee", email: "ann@x", source: "both" },
    { name: "Bob Ray", github: "bray", email: "b@x", source: "directory" },
    { name: "Cy Dee", github: "cdee", email: "", source: "mine" },
  ]);
  assert.deepEqual(mergeClassmates(null, []), []);
});
