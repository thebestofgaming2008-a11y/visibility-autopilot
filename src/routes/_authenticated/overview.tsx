import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/overview")({ component: OverviewPage });
