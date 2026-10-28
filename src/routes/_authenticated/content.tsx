import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/content")({ component: ContentPage });
