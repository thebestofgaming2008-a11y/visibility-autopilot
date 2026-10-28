import { createFileRoute } from "@tanstack/react-router";
import { AuditsPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/audits")({ component: AuditsPage });
