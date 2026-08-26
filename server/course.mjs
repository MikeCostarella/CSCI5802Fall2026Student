// The ONLY file that names this course and term. Kept identical in shape to
// CSCI5802Fall2026Management/server/course.mjs - when the sprint calendar
// changes there, it changes here (the instructor pushes; you `git pull`).
export const COURSE = {
  code: "CSCI 5802",
  title: "Software Tools and Practices",
  term: "Fall 2026",
  institution: "YSU",
  owner: "MikeCostarella",             // the GitHub account that owns the repos below
  starterRepo: "csci5802-api-starter", // you forked this; your work lives in your fork
  courseSiteRepo: "MyWebSiteDevelopmentCourse",
  studentRepo: "CSCI5802Fall2026Student", // this app (a template - you made your own copy)
  courseSiteUrl: "https://mikecostarella.github.io/MyWebSiteDevelopmentCourse/",
  lmsUrl: "https://ysu.blackboard.com/",
  // The opt-in class directory: a JSON file in the starter repo that each
  // student adds themselves to by pull request. See README.
  directoryPath: "directory.json",
  dataFolder: "CSCI5802-Fall2026-Student",
  termStart: "2026-08-24",
};

// The sprint calendar - one per lab, checkpoints and the final as milestones.
// `module` is the course-site module whose page carries the spec.
export const SPRINTS = [
  { id: "lab-1",  kind: "lab",        module: "m01", title: "Lab 1 - Two Working Environments on Every Machine", due: "2026-08-31" },
  { id: "lab-2",  kind: "lab",        module: "m02", title: "Lab 2 - Git: The Object Model and History Discipline", due: "2026-09-09" },
  { id: "lab-3",  kind: "lab",        module: "m03", title: "Lab 3 - Build and Make Systems", due: "2026-09-21" },
  { id: "lab-4",  kind: "lab",        module: "m04", title: "Lab 4 - CI with GitHub Actions", due: "2026-09-28" },
  { id: "lab-5",  kind: "lab",        module: "m05", title: "Lab 5 - Driving a Debugger Through Real Defects", due: "2026-10-05" },
  { id: "lab-6",  kind: "lab",        module: "m06", title: "Lab 6 - Unit Testing with Vitest", due: "2026-10-12" },
  { id: "lab-7",  kind: "lab",        module: "m07", title: "Lab 7 - Test Design: Partitions, Boundaries, and Coverage", due: "2026-10-19" },
  { id: "lab-8",  kind: "lab",        module: "m08", title: "Lab 8 - Integration and End-to-End Testing", due: "2026-10-26" },
  { id: "cp-1",   kind: "checkpoint", module: "m08", title: "Checkpoint 1 - Test Suite for the Adopted App", due: "2026-10-26" },
  { id: "lab-9",  kind: "lab",        module: "m09", title: "Lab 9 - Static Analysis: TypeScript Strict Mode and ESLint", due: "2026-11-02" },
  { id: "lab-10", kind: "lab",        module: "m10", title: "Lab 10 - Dynamic Analysis: Profiling a Shipped PWA", due: "2026-11-09" },
  { id: "cp-2",   kind: "checkpoint", module: "m10", title: "Checkpoint 2 - Static & Dynamic Analysis Report", due: "2026-11-09" },
  { id: "lab-11", kind: "lab",        module: "m11", title: "Lab 11 - Architecture Decision Record (ADR)", due: "2026-11-16" },
  { id: "lab-12", kind: "lab",        module: "m12", title: "Lab 12 - Design Patterns in Shipped TypeScript", due: "2026-11-23" },
  { id: "lab-13", kind: "lab",        module: "m13", title: "Lab 13 - Maintenance: Refactoring with a Safety Net", due: "2026-11-30" },
  { id: "final",  kind: "final",      module: "m14", title: "Final Project + Presentation - The Toolsmith's Retrospective", due: "2026-12-09" },
];

/** Where a sprint's spec lives on the course site. */
export function specUrl(sprint) {
  if (!sprint?.module) return "";
  return `${COURSE.courseSiteUrl}#/m/${sprint.module}${sprint.kind === "lab" ? "/lab" : ""}`;
}
