// Microsoft Teams deep links - this app organizes, the Teams client talks.
// `msteams:` goes straight to the desktop client; the https form is the web
// fallback that offers to open the app. Both documented at
// https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/deep-link-workflow
import { COURSE } from "./course.mjs";

const WEB = "https://teams.microsoft.com";
const APP = "msteams:";

export function splitByEmail(people) {
  const ok = [], missing = [];
  for (const p of people) (p.email && p.email.includes("@") ? ok : missing).push(p);
  return { ok, missing };
}

/**
 * Links for a set of classmates: call (rings them now), chat (opens a 1:1
 * or group chat with an optional first message), and a mailto.
 */
export function teamsLinks(people, { subject = "", message = "" } = {}) {
  const { ok, missing } = splitByEmail(people);
  const emails = ok.map((p) => p.email.trim());
  const users = encodeURIComponent(emails.join(","));
  const topic = subject || `${COURSE.code} · ${ok.map((p) => p.name).join(", ")}`;
  const callQ = `l/call/0/0?users=${users}&withVideo=true`;
  const chatQ = `l/chat/0/0?users=${users}`
    + (emails.length > 1 ? `&topicName=${encodeURIComponent(topic)}` : "")
    + (message ? `&message=${encodeURIComponent(message)}` : "");
  return {
    emails, missing: missing.map((p) => p.github), subject: topic,
    call: { app: `${APP}/${callQ}`, web: `${WEB}/${callQ}` },
    chat: { app: `${APP}/${chatQ}`, web: `${WEB}/${chatQ}` },
    mailto: emails.length ? `mailto:${emails.join(";")}?subject=${encodeURIComponent(topic)}` : "",
  };
}
