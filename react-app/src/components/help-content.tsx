// The help text, one topic per tab plus a getting-started page. Kept as JSX
// in its own file so the words can change without touching the dialog or
// App.tsx. Course names come in through `course`, so course.mjs stays the
// only place the course is named.
import type { Course } from "../types";

export type HelpTopic = "start" | "sprint" | "classmates" | "repos" | "setup" | "menu";

export const HELP_TOPICS: { id: HelpTopic; title: string }[] = [
  { id: "start", title: "Getting started" },
  { id: "sprint", title: "Sprint" },
  { id: "classmates", title: "Classmates" },
  { id: "repos", title: "Repositories" },
  { id: "setup", title: "Setup" },
  { id: "menu", title: "Menu & shortcuts" },
];

/** Which topic a tab opens to. */
export const TOPIC_FOR_TAB: Record<string, HelpTopic> = { sprint: "sprint", classmates: "classmates", repos: "repos", setup: "setup" };

export function HelpBody({ topic, course }: { topic: HelpTopic; course: Course | null }) {
  const starter = course?.starterRepo ?? "the starter repo";
  const owner = course?.owner ?? "the instructor";
  const org = course?.participantsOrg ?? "the participants org";
  const directory = course?.directoryPath ?? "directory.json";
  const dataDir = course?.dataDir ?? "your data folder";

  switch (topic) {
    case "start": return (<>
      <h3>What this app is</h3>
      <p>
        Your companion for {course?.code ?? "the course"}: where you are in the current sprint, how your fork looks to the
        instructor, who your classmates are, and the class repositories on this machine. It reads GitHub through the{" "}
        <code>gh</code> command-line tool signed in as you - nothing here is hidden from you on GitHub itself.
      </p>
      <h3>First run, in order</h3>
      <ol>
        <li><strong>Setup tab, step 1</strong> - make sure <code>gh</code> is installed and signed in. Everything else depends on it.</li>
        <li><strong>Setup tab, step 2</strong> - your name, GitHub handle, and YSU email. Save.</li>
        <li><strong>Fork the starter</strong> - <code>{owner}/{starter}</code> on GitHub, if you haven't. The Sprint tab watches that fork.</li>
        <li><strong>Optional</strong> - add yourself to the class directory (Setup, step 4) so classmates can reach you in Teams.</li>
      </ol>
      <h3>What stays on this machine</h3>
      <p>
        Your profile and your own classmates list live in <code>{dataDir}</code> - outside the repo, so a careless{" "}
        <code>git add -A</code> can never publish them. Nothing in this app is sent anywhere except to GitHub (through gh) and,
        when you press a Teams button, to Teams.
      </p>
      <h3>Read-only, with one exception</h3>
      <p>
        Sprint, Classmates and Setup never change anything on GitHub. The <strong>Repositories</strong> tab is the one that
        writes: clone, pull, commit and push in the repos you check - and it tells you before it does.
      </p>
    </>);

    case "sprint": return (<>
      <h3>Where am I?</h3>
      <p>
        Pick a sprint (labs, checkpoints, the final) and the panel shows its window, days left, and a link to the spec on the
        course site. Below that is your fork inside that window - the same signals the instructor's sprint board reads for
        you, so there are no surprises at grading time.
      </p>
      <dl>
        <dt>Commits in window</dt><dd>Commits on your fork between the sprint's start and due dates. "none yet" is the nudge.</dd>
        <dt>CI</dt><dd>The latest GitHub Actions run on your fork - green means the tests pass. Click through to the run when it's red.</dd>
        <dt>Upstream</dt><dd>How far your fork is behind <code>{owner}/{starter}</code>. When you're behind, the exact <code>git fetch upstream &amp;&amp; git merge</code> recipe appears here.</dd>
        <dt>Open PRs</dt><dd>Pull requests you've opened from the fork.</dd>
      </dl>
      <h3>If it says "no fork found"</h3>
      <p>
        Either you haven't forked <code>{owner}/{starter}</code> yet (there's a link right there), or the GitHub handle on the
        Setup tab isn't the account that owns the fork.
      </p>
      <p><strong>Refresh</strong> asks GitHub again; results are otherwise cached for a few minutes.</p>
    </>);

    case "classmates": return (<>
      <h3>Two lists, one table</h3>
      <p>
        The <strong>class directory</strong> is <code>{directory}</code> in <code>{owner}/{starter}</code> - students who chose to be
        reachable, added by pull request. Rows from it carry a <em>directory</em> tag and can only be changed there.
      </p>
      <p>
        <strong>Add classmate…</strong> is your own list: a name, a GitHub handle (required) and an email (optional, for
        Teams). It's stored in <code>classmates.json</code> in <code>{dataDir}</code>, on this machine only - never in the shared
        directory. Your rows have edit (✎) and remove (✕). Saving the same handle again updates the entry.
      </p>
      <p>
        When someone is in both, the directory's name and email win (they chose them); your entry only fills in an email
        the directory lacks. Removing them drops just your copy.
      </p>
      <h3>Reaching people</h3>
      <p>
        The row icons: 💬 Teams chat, ✉ email, ⎇ their GitHub, ⑂ their fork. Check several rows and press{" "}
        <strong>Reach</strong> for a group chat or call. The app only builds a Teams link - the Teams web client (or the
        installed PWA) does the talking; screen sharing is Teams' own Share button. Anyone without an email is shown in the
        dialog and left out of the link, never silently dropped.
      </p>
      <h3>Not in the directory yet?</h3>
      <p>Classmates can't reach <em>you</em> until you add yourself - Setup tab, step 4 writes the entry for you.</p>
    </>);

    case "repos": return (<>
      <h3>The class repos, on this machine</h3>
      <p>
        Every repo in the <code>{org}</code> org plus your own fork of the starter, with its local state: <em>clean</em>,{" "}
        <em>dirty</em> (uncommitted changes), <em>unpushed</em> (commits not on GitHub), <em>behind</em> (GitHub has newer
        commits), or <em>not cloned</em>. The pills at the top filter; click a repo name to see its changes.
      </p>
      <h3>This tab writes</h3>
      <p>
        It's the one place in the app that runs git for real, and only in the repos you check:
      </p>
      <dl>
        <dt>Clone missing</dt><dd><code>git clone</code> every org repo you don't have yet, under the repos folder set on Setup.</dd>
        <dt>Get latest</dt><dd>fetch + fast-forward only. A repo with local changes is skipped untouched - it never merges over your work.</dd>
        <dt>Commit &amp; push</dt><dd>One summary (and optional description) across the checked repos: <code>git add -A</code>, commit, push. <strong>Dry run</strong> lists what would be committed and touches nothing.</dd>
        <dt>Push only</dt><dd>Push repos that are ahead without committing anything new.</dd>
        <dt>Discard…</dt><dd>A <code>git stash</code> of the checked dirty repos - recoverable with <code>git stash pop</code>, not a delete.</dd>
      </dl>
      <p>
        Per row: ± changes, Log, ↓ pull this one, and shortcuts into a command prompt, PowerShell, VS Code, Explorer, or the
        repo on GitHub (GH / PR / CI).
      </p>
      <h3>Deploys drawer</h3>
      <p>
        After a commit run, the drawer at the bottom follows the GitHub Actions runs those pushes started - status per repo,
        the failing lines when one goes red, a re-run button, and the live site link for repos that publish to Pages.
      </p>
    </>);

    case "setup": return (<>
      <h3>1. GitHub CLI</h3>
      <p>
        Everything is read through <code>gh</code>. If it isn't installed, get it from cli.github.com; then{" "}
        <code>gh auth login</code> in a terminal, and Menu › Server › Restart server so the app notices.
      </p>
      <h3>2. Who you are</h3>
      <p>
        Name (as classmates should see it), GitHub handle, YSU email (what Teams calls you by), and the folder the
        Repositories tab clones into (blank = the default under your home folder). Saved to <code>{dataDir}</code>, outside
        the repo. Until you save, the handle falls back to whoever <code>gh</code> is signed in as.
      </p>
      <h3>3. Your fork</h3>
      <p>The Sprint tab watches <code>&lt;your handle&gt;/{starter}</code>. If the handle is wrong, so is everything on Sprint.</p>
      <h3>4. The class directory (optional)</h3>
      <p>
        Classmates can only chat or call you if you're listed in <code>{directory}</code>. The tab shows your entry ready to
        copy; <strong>Edit on GitHub</strong> opens the file and GitHub will fork-and-PR for you. Leave out the email if you'd
        rather not share it - you'll still be listed with your GitHub links. This is a good first pull request.
      </p>
    </>);

    case "menu": return (<>
      <h3>Menu</h3>
      <dl>
        <dt>Course</dt><dd>The course site (modules, labs, specs) and Blackboard (submissions and grades).</dd>
        <dt>My repos</dt><dd>Your fork, its pull requests and Actions, and your copy of this app.</dd>
        <dt>Instructor's repos</dt><dd>The starter you forked, its pull requests (your directory PR waits there), the class directory, this app's template, and the course site source.</dd>
        <dt>Server</dt><dd><strong>Restart server</strong> - after a <code>git pull</code> that changed <code>server/</code>, or after signing in to <code>gh</code>.</dd>
        <dt>Help</dt><dd>This window.</dd>
      </dl>
      <h3>Keyboard</h3>
      <dl>
        <dt><kbd>F1</kbd> or <kbd>?</kbd></dt><dd>Help for the tab you're on (not while typing in a field).</dd>
        <dt><kbd>Esc</kbd></dt><dd>Close any dialog.</dd>
      </dl>
      <h3>Header</h3>
      <p>
        The chips name the machine this app is running on and your GitHub handle; the build stamp says which build you're on
        (hover for the exact time). The avatar is the Chrome profile the window runs in.
      </p>
      <h3>Updating the app</h3>
      <p>
        This app is your copy of <code>{owner}/{course?.studentRepo ?? "the student app"}</code>. To pick up changes, merge from
        that template, then <code>npm run build</code> in <code>react-app</code> and Menu › Server › Restart server.
      </p>
    </>);
  }
}
