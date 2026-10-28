import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

const Ctx = createContext<{ siteId: string | null; setSiteId: (s: string) => void }>({
  siteId: null,
  setSiteId: () => {},
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const sites = useSites();
  const [siteId, setSiteIdState] = useState<string | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("ov_site");
    const list = sites.data ?? [];
    if (!list.length) return;
    setSiteIdState(list.find((s) => s.id === saved)?.id ?? list[0]?.id ?? null);
  }, [sites.data]);
  const setSiteId = (s: string) => {
    localStorage.setItem("ov_site", s);
    setSiteIdState(s);
  };
  return <Ctx.Provider value={{ siteId, setSiteId }}>{children}</Ctx.Provider>;
}
export const useSite = () => {
  const { siteId, setSiteId } = useContext(Ctx);
  const sites = useSites();
  return { siteId, setSiteId, site: sites.data?.find((s) => s.id === siteId) ?? null, sites };
};

export async function logEvent(
  workspace_id: string,
  entity: string,
  entity_id: string | null,
  action: string,
  detail: object = {},
) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("change_events").insert({
    workspace_id,
    entity,
    entity_id,
    action,
    detail: detail as never,
    actor: data.user?.id ?? null,
  });
}

export const sevClass: Record<string, string> = {
  critical: "bg-sev-critical text-primary-foreground",
  high: "bg-sev-high text-primary-foreground",
  medium: "bg-sev-medium text-foreground",
  low: "bg-sev-low text-primary-foreground",
  info: "bg-muted text-muted-foreground",
};
