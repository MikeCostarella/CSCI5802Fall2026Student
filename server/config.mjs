// Where everything lives. Env overrides are mainly for testing.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COURSE } from "./course.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.CSCI5802_STUDENT_PORT || 5182); // 5181 = the instructor's management app
export const DIST = path.join(__dirname, "..", "react-app", "dist");

/**
 * Your profile (GitHub handle, email) - deliberately OUTSIDE the repo, so a
 * careless `git add -A` can never publish it. Same rule the instructor's
 * app follows for the roster.
 */
export const DATA_DIR = process.env.CSCI5802_STUDENT_DATA_DIR
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".config"),
               "Teaching", COURSE.dataFolder);
