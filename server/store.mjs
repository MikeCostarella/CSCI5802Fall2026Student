// JSON persistence under DATA_DIR. Small on purpose: named documents,
// atomic writes (tmp + rename), no partial files on a crash.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.mjs";

function fileFor(name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`bad store name: ${name}`);
  return path.join(DATA_DIR, `${name}.json`);
}

export function readDoc(name, fallback) {
  try { return JSON.parse(fs.readFileSync(fileFor(name), "utf8")); }
  catch { return fallback; }
}

export function writeDoc(name, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = fileFor(name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file); // atomic on the same volume
  return value;
}
