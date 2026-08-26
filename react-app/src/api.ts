// All fetch/JSON plumbing in one place.
import type { Course, DirectoryView, MySprint, Profile, ProfileView, Sprint, TeamsLinks, Upstream } from "./types";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
  return r.json();
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
  return r.json();
}

export const fetchCourse = () => get<Course>("/api/course");
export const fetchProfile = () => get<ProfileView>("/api/profile");
export const saveProfile = (fields: Partial<Profile>) => post<{ profile: Profile }>("/api/profile", fields);
export const fetchSprints = () => get<{ sprints: Sprint[]; current: string }>("/api/sprints");
export const fetchMySprint = (id: string) => get<MySprint>(`/api/my-sprint?sprint=${encodeURIComponent(id)}`);
export const fetchDirectory = (refresh = false) => get<DirectoryView>(`/api/directory${refresh ? "?refresh=1" : ""}`);
export const fetchTeamsLinks = (github: string[], message = "") =>
  get<TeamsLinks>(`/api/teams-links?github=${encodeURIComponent(github.join(","))}&message=${encodeURIComponent(message)}`);
export const fetchUpstream = () => get<Upstream>("/api/upstream");

/** Ask the server to restart itself, then poll until the new process answers. */
export async function restartServer(): Promise<boolean> {
  try { await fetch("/api/restart", { method: "POST" }); } catch { /* old process may die first */ }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { if ((await fetch("/api/course", { cache: "no-store" })).ok) return true; } catch { /* still down */ }
  }
  return false;
}
