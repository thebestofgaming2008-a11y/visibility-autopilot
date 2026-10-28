import { createFileRoute } from "@tanstack/react-router";
import { OpportunitiesPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/opportunities")({
  component: OpportunitiesPage,
});
