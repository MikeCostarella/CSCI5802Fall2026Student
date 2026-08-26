import assert from "node:assert/strict";
import { test } from "node:test";
import { entryFor, parseDirectory } from "./directory.mjs";

test("parses, cleans, sorts, and drops entries without a handle", () => {
  const d = parseDirectory(JSON.stringify([
    { name: "Bob Ray", github: "@bray", email: " bray@student.ysu.edu " },
    { name: "Ann Lee", github: "alee" },
    { name: "Nobody" },
    { github: "zed" },
    "junk", null,
  ]));
  assert.deepEqual(d, [
    { name: "Ann Lee", github: "alee", email: "" },
    { name: "Bob Ray", github: "bray", email: "bray@student.ysu.edu" },
    { name: "zed", github: "zed", email: "" },
  ]);
});

test("rejects a non-array and malformed JSON", () => {
  assert.throws(() => parseDirectory("{}"), /array/);
  assert.throws(() => parseDirectory("[oops"), SyntaxError);
  assert.deepEqual(parseDirectory(""), []);
});

test("entry for the copy-me snippet", () => {
  assert.deepEqual(entryFor({ name: "Ann Lee", github: "alee", email: "a@x" }), { name: "Ann Lee", github: "alee", email: "a@x" });
  assert.deepEqual(entryFor({}), { name: "", github: "", email: "" });
});
