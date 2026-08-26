// Deployment honesty, same pattern as the course site's BuildStamp: the
// build embeds its own timestamp via a Vite define, so "which build are you
// on?" answers itself. Eastern time with AM/PM; hover shows the raw UTC ISO
// stamp. (Under `npm run dev` the stamp is the dev server's start time -
// the define is evaluated when the Vite config loads and HMR never
// re-evaluates it.)
export default function BuildStamp() {
  const t = new Date(__BUILD_TIME__);
  const stamp = t.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return (
    <span className="build-stamp" title={__BUILD_TIME__}>
      build {stamp}
    </span>
  );
}
