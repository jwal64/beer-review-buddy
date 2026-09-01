import { createFileRoute, redirect } from "@tanstack/react-router";

// The full analytics site — charts, maps, the passport, the want-to-try
// scorecard — is a static page in public/stats/, not a React route. It moved
// here whole from jwal64/JWAL-BEER-REVIEW and still runs with no build step.
//
// This route only exists so the bare /stats URL works everywhere: a static
// host that resolves directory indexes serves /stats/index.html before the
// router ever sees the request, and anything that does fall through to the
// router is bounced to the file explicitly.
export const Route = createFileRoute("/stats")({
  beforeLoad: () => {
    throw redirect({ href: "/stats/index.html" });
  },
});
