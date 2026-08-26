// =====================================================================
// CSCI5802Fall2026Student - server.mjs
// Local API + static server for the student panel. Plain Node stdlib - no
// npm dependencies. Binds to 127.0.0.1 only.
//
//   node server\server.mjs        (from the repo root)
// =====================================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DIST, PORT } from "./config.mjs";
import {
  handleCourse, handleDirectory, handleMySprint, handleProfile, handleProfileSave,
  handleRestart, handleSprints, handleTeamsLinks, handleUpstream, json,
} from "./routes.mjs";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".map": "application/json", ".woff2": "font/woff2",
};

function serveStatic(res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    const index = path.join(DIST, "index.html");
    if (fs.existsSync(index)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(index).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("react-app/dist not found. Run: cd react-app && npm install && npm run build");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname === "/api/course" && req.method === "GET") return handleCourse(res);
    if (url.pathname === "/api/profile" && req.method === "GET") return await handleProfile(res);
    if (url.pathname === "/api/profile" && req.method === "POST") return await handleProfileSave(req, res);
    if (url.pathname === "/api/sprints" && req.method === "GET") return handleSprints(res);
    if (url.pathname === "/api/my-sprint" && req.method === "GET") return await handleMySprint(res, url);
    if (url.pathname === "/api/directory" && req.method === "GET") return await handleDirectory(res, url);
    if (url.pathname === "/api/teams-links" && req.method === "GET") return await handleTeamsLinks(res, url);
    if (url.pathname === "/api/upstream" && req.method === "GET") return await handleUpstream(res);
    if (url.pathname === "/api/restart" && req.method === "POST") return await handleRestart(req, res);
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "unknown endpoint" });
    return serveStatic(res, url.pathname);
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
});

let listenAttempts = 0;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && listenAttempts < 40) {
    listenAttempts++;
    setTimeout(() => server.listen(PORT, "127.0.0.1"), 250);
  } else { console.error(err); process.exit(1); }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CSCI 5802 student server on http://localhost:${PORT}`);
});
