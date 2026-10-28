import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "OmniVisibility Autopilot" },
    { name: "description", content: "Agency command center for organic search and AI visibility." },
    { property: "og:title", content: "OmniVisibility Autopilot" },
    { property: "og:description", content: "Agency command center for organic search and AI visibility." },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/overview" }); },
});
