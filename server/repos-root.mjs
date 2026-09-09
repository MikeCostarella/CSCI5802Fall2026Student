// Where this student's clones of the org repos live.
//
// Students do not have C:\projects. The default is a folder under the home
// directory named for the course and the org; the Setup tab can point it
// somewhere else (stored in profile.json, outside the repo, like the rest
// of "who you are"). Read fresh on every call so a change on Setup takes
// effect without a restart.
import os from "node:os";
import path from "node:path";
import { COURSE } from "./course.mjs";
import { readDoc } from "./store.mjs";

export const DEFAULT_REPOS_ROOT = path.join(os.homedir(), "CSCI5802", COURSE.participantsOrg);

export function reposRoot() {
  const chosen = String(readDoc("profile", {}).reposRoot || "").trim();
  return chosen ? path.resolve(chosen) : DEFAULT_REPOS_ROOT;
}
