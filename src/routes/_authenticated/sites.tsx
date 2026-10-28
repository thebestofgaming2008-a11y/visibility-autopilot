import { createFileRoute } from "@tanstack/react-router";
import { SitesPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/sites")({ component: SitesPage });
