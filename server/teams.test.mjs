import assert from "node:assert/strict";
import { test } from "node:test";
import { teamsLinks } from "./teams.mjs";

const ann = { name: "Ann Lee", github: "alee", email: "alee@student.ysu.edu" };
const bob = { name: "Bob Ray", github: "bray", email: "bray@student.ysu.edu" };
const cy = { name: "Cy Qi", github: "cqi", email: "" };

test("call and chat links, app and web, for a group", () => {
  const l = teamsLinks([ann, bob], { message: "lab 3?" });
  const users = encodeURIComponent("alee@student.ysu.edu,bray@student.ysu.edu");
  assert.equal(l.call.app, `msteams:/l/call/0/0?users=${users}&withVideo=true`);
  assert.ok(l.chat.web.startsWith(`https://teams.cloud.microsoft/l/chat/0/0?users=${users}&topicName=`));
  assert.ok(l.chat.app.endsWith("&message=lab%203%3F"));
  assert.equal(l.subject, "CSCI 5802 · Ann Lee, Bob Ray");
  assert.ok(l.mailto.startsWith("mailto:alee@student.ysu.edu;bray@student.ysu.edu?subject="));
});

test("a 1:1 chat has no topic; missing emails are reported", () => {
  const l = teamsLinks([ann, cy]);
  assert.ok(!l.chat.app.includes("topicName"));
  assert.deepEqual(l.missing, ["cqi"]);
  assert.deepEqual(l.emails, ["alee@student.ysu.edu"]);
});
