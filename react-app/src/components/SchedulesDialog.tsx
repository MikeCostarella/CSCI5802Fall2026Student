// Menu > Scheduled jobs: the shared scheduled-jobs panel (src/vendor/
// scheduled-jobs, from FleetShareableCodeComponents) in two tabs.
//
//   Class     the class org's scheduled jobs - read-only. When one goes red,
//             Live is broken: say so in Sprints and fix it with a PR.
//   My forks  the same workflows in your forks - yours to enable and run.

import ScheduledJobsDialog from "../vendor/scheduled-jobs/ScheduledJobsDialog";
import { fetchSchedules, runScheduleNow, toggleSchedule } from "../api";
import type { Course } from "../types";

interface Props {
  course: Course;
  onHelp: () => void;
  onClose: () => void;
}

export default function SchedulesDialog({ course, onHelp, onClose }: Props) {
  const org = course.participantsOrg;
  const helpLink = <button className="link-btn" onClick={onHelp} style={{ border: "none", background: "none", padding: 0, color: "var(--accent)", cursor: "pointer", font: "inherit" }}>How scheduled jobs work</button>;
  return (
    <ScheduledJobsDialog
      views={[
        {
          id: "class",
          label: `Class (${org})`,
          load: (fresh) => fetchSchedules("class", fresh),
          note: <>The team's jobs, watching what is <b>Live</b>. Read-only here - a red row means Live needs a fix: raise it in Sprints and fix it with a pull request. {helpLink}</>,
          emptyText: <>No class repo in {org} has a scheduled workflow yet.</>,
        },
        {
          id: "forks",
          label: "My forks",
          load: (fresh) => fetchSchedules("forks", fresh),
          note: <>The same workflows in <b>your</b> forks. GitHub turns schedules <b>off in forks</b> until you enable them, and a job in your fork checks <i>your</i> copy (your Pages site, your issues) - not the class's. {helpLink}</>,
          emptyText: <>None of your forks of {org}'s repos has a scheduled workflow (or you have not forked one yet). If you have, open the fork's <b>Actions</b> tab on GitHub once - GitHub asks before it shows a fork's workflows.</>,
        },
      ]}
      onToggle={(job, enabled) => toggleSchedule(job.fullName, job.file, enabled)}
      onRun={(job) => runScheduleNow(job.fullName, job.file)}
      onClose={onClose}
    />
  );
}
