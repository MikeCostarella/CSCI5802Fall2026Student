// Everything that talks to GitHub goes through `gh`, which you sign in to
// once (`gh auth login`). Read-only: this app never pushes, never opens PRs
// for you - it just reports. windowsHide keeps the headless server from
// flashing a console per call.
import { spawn } from "node:child_process";

export function runGh(args) {
  return new Promise((resolve) => {
    const p = spawn("gh", args, { shell: false, windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ ok: code === 0, out, err }));
    p.on("error", (e) => resolve({ ok: false, out: "", err: String(e) }));
  });
}

export async function ghJson(args) {
  const r = await runGh(args);
  if (!r.ok) return null;
  try { return JSON.parse(r.out); } catch { return null; }
}

/** Is gh installed and signed in? Who as? */
export async function ghStatus() {
  const version = await runGh(["--version"]);
  if (!version.ok) return { installed: false, authed: false, login: null };
  const user = await ghJson(["api", "user", "--jq", "{login: .login, name: .name}"]);
  return { installed: true, authed: Boolean(user), login: user?.login ?? null, name: user?.name ?? null };
}
