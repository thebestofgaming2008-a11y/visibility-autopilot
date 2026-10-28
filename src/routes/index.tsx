import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { entryTarget } from "@/lib/auth-callback";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Entry,
});

function Entry() {
  useEffect(() => {
    window.location.replace(entryTarget(window.location.search, window.location.hash));
  }, []);
  return (
    <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Opening OmniVisibility…
    </main>
  );
}
