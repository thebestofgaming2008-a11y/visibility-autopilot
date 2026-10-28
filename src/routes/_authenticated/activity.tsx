import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/activity")({ component: ActivityPage });
