import { createFileRoute } from "@tanstack/react-router";
import { KeywordsPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/keywords")({ component: KeywordsPage });
