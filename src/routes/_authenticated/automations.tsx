import { createFileRoute } from "@tanstack/react-router";
import { AutomationsPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/automations")({ component: AutomationsPage });
