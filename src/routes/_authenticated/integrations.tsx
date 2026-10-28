import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
});
