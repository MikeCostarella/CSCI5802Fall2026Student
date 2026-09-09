# CSCI5802Fall2026Student

Your desktop panel for **CSCI 5802 — Software Tools and Practices, Fall
2026** at YSU. It shows where you are in the current sprint, how your fork
of [csci5802-api-starter](https://github.com/MikeCostarella/csci5802-api-starter)
looks to the instructor's board (same GitHub signals, no surprises), and
lets you call or chat with classmates in Teams.

It is deliberately small and deliberately the same shape as the
instructor's [CSCI5802Fall2026Management](https://github.com/MikeCostarella/CSCI5802Fall2026Management):
a dependency-free Node server (`server/server.mjs`, port **5182**) serving
both a tiny API and a built React app, opened in an app-mode browser window
by `app\launch.vbs`. Reading it is a fair way to learn how that app works.

## Get it

This repo is a **template**. On GitHub click **Use this template → Create a
new repository** under your own account (private is fine), then:

    git clone https://github.com/<you>/CSCI5802Fall2026Student.git
    cd CSCI5802Fall2026Student
    cd react-app && npm install && npm run build && cd ..
    app\create-shortcut.ps1        # Desktop icon (once)
    app\launch.vbs                 # or double-click the icon

You also need Node 20+ and the [GitHub CLI](https://cli.github.com/), signed
in once with `gh auth login`. Apart from the Repositories tab (which runs
git for you, only in the repos you check), the app reads everything through
`gh` and never writes: it will not open PRs or touch your fork on its own.

To pick up changes the instructor makes to the template (the sprint calendar
lives in `server/course.mjs`), add it as a remote and merge:

    git remote add template https://github.com/MikeCostarella/CSCI5802Fall2026Student.git
    git fetch template && git merge template/main
    cd react-app && npm run build && cd ..     # then Menu > Restart server

## The four tabs

**Sprint** — the current lab (or checkpoint / final), its window and days
left, a link to the spec on the course site, and your fork inside that
window: commits, CI result, open PRs, and how far behind upstream you are
(with the `git fetch upstream && git merge` recipe when you are). This is
exactly what the instructor's sprint board reads for you.

**Classmates** — everyone who opted into the class directory (below), with
Teams chat / call, email, and links to their GitHub and fork. Check several
and **Reach** to start a group chat or call. The app only builds a
`msteams:` deep link; the Teams desktop client does the talking, and screen
sharing is Teams' own Share button.

**Repositories** — the class's shared repos in the
[MyWebSiteParticipants](https://github.com/MyWebSiteParticipants) org, plus
your own fork of the starter, managed the way the instructor's fleet tool
does it: clone the ones you don't have yet, see which are dirty / unpushed /
behind, get latest (fast-forward only — anything with local changes is left
alone), commit and push a batch with one summary, and watch the GitHub
Actions runs those pushes start in the Deploys drawer. **This is the one tab
that writes**: `git add -A` / `commit` / `push` in the repos you check, and
"Discard" is a `git stash` you can pop back. Everything else in the app
stays read-only. Clones go under `%USERPROFILE%\CSCI5802\MyWebSiteParticipants\`
unless you pick another folder on Setup.

**Setup** — is `gh` signed in, who you are (name, GitHub handle, YSU email),
where the Repositories tab clones to, and your copy-paste entry for the
directory.

Your profile is stored in `%LOCALAPPDATA%\Teaching\CSCI5802-Fall2026-Student\`,
outside the repo, so a careless `git add -A` can never publish it.

## The class directory (opt-in)

There is no roster in this app — the instructor's roster is FERPA-protected
and stays with the instructor. Instead, `directory.json` in the upstream
starter repo lists the students who chose to be reachable. Adding yourself
is a pull request against
[csci5802-api-starter](https://github.com/MikeCostarella/csci5802-api-starter)
— a good first PR:

```json
{ "name": "Ann Lee", "github": "alee", "email": "alee@student.ysu.edu" }
```

Leave out `email` if you'd rather not share it; you'll still be listed with
your GitHub links, just not callable. `directory.example.json` here shows
the shape; the Setup tab writes your entry for you.

## Layout

    server/   course.mjs   the ONLY file naming the course, term, and sprints
              config.mjs   port, dist path, profile directory
              store.mjs    JSON documents under the profile directory
              gh.mjs       every GitHub call (read-only, via gh)
              sprints.mjs  sprint windows (pure) + your fork's signals
              directory.mjs the opt-in directory: parse (pure) + fetch/cache
              teams.mjs    Teams deep links (pure)
              repos.mjs    Repositories tab: org list via gh, local git status / clone / pull / commit
              repo-routes.mjs  its /api/repos/* handlers (NDJSON streams for the long ones)
              deploys.mjs  commit history + GitHub Actions status for the Deploys drawer
              repos-root.mjs  where clones live (Setup tab, default under your home folder)
              routes.mjs   the /api handlers
              server.mjs   http + static
    react-app/ Vite + React + TypeScript, no other dependencies
    app/       launch.vbs / launch.ps1 / stop.ps1 / create-shortcut.ps1

Tests (no install needed): `node --test server/*.test.mjs`

## CI

`.github/workflows/ci.yml` runs the server tests and the React typecheck +
build on every push and pull request. It deploys nothing - this is a desktop
app and the release is `git pull` - but the green check on your copy tells
you a template merge didn't break anything, and it is the worked example
for Lab 4.
