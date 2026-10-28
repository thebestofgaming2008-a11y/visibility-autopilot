import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteProvider, useSite } from "@/lib/app";
import { Toaster } from "@/components/ui/sonner";
import { Activity, BarChart3, Bot, FileText, Globe, KeyRound, LayoutDashboard, Lightbulb, Plug, Settings, Swords, ScanSearch, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const NAV = [
  ["/overview", "Overview", LayoutDashboard], ["/sites", "Sites", Globe], ["/audits", "Audits", ScanSearch],
  ["/opportunities", "Opportunities", Lightbulb], ["/content", "Content", FileText], ["/keywords", "Keywords", KeyRound],
  ["/competitors", "Competitors", Swords], ["/integrations", "Integrations", Plug], ["/automations", "Automations", Bot],
  ["/activity", "Activity", Activity], ["/settings", "Settings", Settings],
] as const;

function Shell() {
  return <SiteProvider><Layout /><Toaster /></SiteProvider>;
}

function Layout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { site, sites, siteId, setSiteId } = useSite();
  const running = useQuery({
    queryKey: ["jobs-running"], refetchInterval: 5000,
    queryFn: async () => (await supabase.from("job_runs").select("id", { count: "exact", head: true }).eq("status", "running")).count ?? 0,
  });
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-52 shrink-0 bg-sidebar text-sidebar-foreground flex md:flex-col">
        <div className="hidden md:flex items-center gap-2 px-4 h-12 border-b border-sidebar-border">
          <BarChart3 className="h-4 w-4 text-sidebar-primary" /><span className="font-semibold text-sidebar-accent-foreground text-sm">OmniVisibility</span>
        </div>
        <nav className="flex md:flex-col overflow-x-auto p-2 gap-0.5 flex-1">
          {NAV.map(([to, label, Icon]) => (
            <Link key={to} to={to} className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[13px] whitespace-nowrap hover:bg-sidebar-accent ${path.startsWith(to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))} className="hidden md:flex items-center gap-2 px-4 py-3 text-xs border-t border-sidebar-border hover:text-sidebar-accent-foreground"><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 border-b bg-card flex items-center gap-3 px-4">
          <label className="sr-only" htmlFor="site-switch">Site</label>
          <select id="site-switch" className="h-8 rounded border bg-background px-2 text-sm" value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value)}>
            {(sites.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.domain}</option>)}
          </select>
          {site && <span className="hidden sm:inline text-xs text-muted-foreground">{site.ownership_verified ? "Ownership verified" : "Ownership not verified"}</span>}
          <div className="ml-auto text-xs flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${running.data ? "bg-warning animate-pulse" : "bg-success"}`} />
            {running.data ? `${running.data} job(s) running` : "No jobs running"}
          </div>
        </header>
        <div className="border-b bg-accent text-accent-foreground text-xs px-4 py-1.5">
          No data sources connected. Rankings, traffic, conversions and AI citations show “Not connected” until a provider is verified. <Link to="/integrations" className="underline">Integrations</Link>
        </div>
        <main className="p-4 md:p-6 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
