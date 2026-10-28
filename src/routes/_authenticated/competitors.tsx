import { createFileRoute } from "@tanstack/react-router";
import { CompetitorsPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/competitors")({ component: CompetitorsPage });
