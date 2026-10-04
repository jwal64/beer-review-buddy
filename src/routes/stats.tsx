import { createFileRoute, redirect } from "@tanstack/react-router";

// There used to be a separate static stats site at /stats. Everything it
// showed now lives in the app, so old links and bookmarks land on Insights.
export const Route = createFileRoute("/stats")({
  beforeLoad: () => {
    throw redirect({ to: "/insights" });
  },
});
