import { useEffect, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ActivityPage, AutomationsPage, CompetitorsPage, ContentPage, IntegrationsPage, KeywordsPage, OpportunitiesPage, SettingsPage } from "./OtherPages";

type Site = {
  id: Id<"sites">; workspace_id: Id<"workspaces">; domain: string; display_name: string;
  business_facts: Record<string, unknown>; regions: string[]; languages: string[];
  service_radius_km: number | null; source_repo: string | null; ownership_verified: boolean;
};
type Audit = { id: Id<"audits">; status: string; created_at: string; error: string | null; summary: Record<string, unknown> };
type Finding = { id: string; title: string; severity: string; detail: string | null; url: string | null; recommendation: string };

const sections = ["Overview", "Sites", "Audits", "Opportunities", "Content", "Keywords", "Competitors", "Integrations", "Automations", "Activity", "Settings"] as const;
type Section = (typeof sections)[number];
const navigationGroups: { label: string; items: readonly Section[] }[] = [
  { label: "Start", items: ["Overview", "Sites", "Integrations"] },
  { label: "Find work", items: ["Audits", "Opportunities"] },
  { label: "Plan work", items: ["Content", "Keywords", "Competitors"] },
  { label: "Control", items: ["Automations", "Activity", "Settings"] },
];
const pagePurpose: Record<Section, string> = {
  Overview: "See what is known, what was checked, and what to do next.",
  Sites: "Keep each client's business facts accurate before planning content or changes.",
  Audits: "Check public pages and inspect the exact evidence behind each result.",
  Opportunities: "Turn supported findings into prioritized work and track the next task.",
  Content: "Write and save reviewed content briefs. Nothing here is published automatically.",
  Keywords: "Keep a manual list of search ideas while ranking data is unavailable.",
  Competitors: "Record relevant competitors without inventing their traffic or rankings.",
  Integrations: "See which data sources are verified and refresh their real data.",
  Automations: "Set review rules and opt in to daily public checks.",
  Activity: "See recorded jobs and changes for this workspace.",
  Settings: "Manage workspace access to the development MCP endpoint.",
};

function AuthScreen() {
  const { signIn } = useAuthActions();
  const capabilities = useQuery(api.capabilities.get);
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await signIn("password", new FormData(event.currentTarget));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><div className="auth-card">
    <div className="brand-mark">◎</div><p className="eyebrow">DEVELOPMENT PREVIEW</p>
    <h1>OmniVisibility Autopilot</h1>
    <p className="muted">Your workspace for evidence based organic visibility.</p>
    <div className="auth-switch"><button className={flow === "signIn" ? "active" : ""} onClick={() => setFlow("signIn")}>Sign in</button><button className={flow === "signUp" ? "active" : ""} onClick={() => setFlow("signUp")}>Create account</button></div>
    <form onSubmit={submit} className="form-stack">
      <label>Email<input type="email" name="email" autoComplete="email" required /></label>
      <label>Password<input type="password" name="password" autoComplete={flow === "signUp" ? "new-password" : "current-password"} minLength={8} required /></label>
      <input type="hidden" name="flow" value={flow} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : flow === "signUp" ? "Create workspace" : "Sign in"}</button>
    </form>
    {capabilities?.googleSignIn && <button style={{ width: "100%", marginTop: 12 }} onClick={() => void signIn("google").catch(reason => setError((reason as Error).message))}>Continue with Google</button>}
    <p className="notice">Google sign in is available for approved development test accounts. Email verification and password reset are not configured yet.</p>
  </div></main>;
}

function SiteForm({ workspaceId, site, onDone }: { workspaceId: Id<"workspaces">; site: Site | undefined; onDone: () => void }) {
  const addSite = useMutation(api.workspace.addSite);
  const updateSite = useMutation(api.workspace.updateSite);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const common = {
      displayName: String(data.get("name") ?? ""), description: String(data.get("description") ?? ""),
      regions: String(data.get("regions") ?? "").split(",").map(s => s.trim()).filter(Boolean),
      languages: String(data.get("languages") ?? "").split(",").map(s => s.trim()).filter(Boolean),
      ...(Number(data.get("radius") || 0) ? { serviceRadiusKm: Number(data.get("radius")) } : {}),
      ...(String(data.get("repo") ?? "").trim() ? { sourceRepo: String(data.get("repo")).trim() } : {}),
    };
    try {
      if (site) await updateSite({ siteId: site.id, ...common });
      else await addSite({ workspaceId, domain: String(data.get("domain") ?? ""), ...common });
      onDone();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="panel form-stack" onSubmit={submit}>
    <h3>{site ? "Edit site facts" : "Add a site"}</h3>
    <p className="muted">Only add facts you can verify. Ownership and publishing access start unverified.</p>
    {!site && <label>Domain<input name="domain" placeholder="example.com" required /></label>}
    <label>Display name<input name="name" defaultValue={site?.display_name} required /></label>
    <label>Business facts<textarea name="description" defaultValue={String(site?.business_facts?.["description"] ?? "")} placeholder="What this business offers, to whom, and where" required /></label>
    <div className="form-grid"><label>Regions, comma separated<input name="regions" defaultValue={site?.regions.join(", ")} /></label><label>Languages, comma separated<input name="languages" defaultValue={site?.languages.join(", ") ?? "en"} required /></label></div>
    <div className="form-grid"><label>Service radius (km)<input name="radius" type="number" min="0" defaultValue={site?.service_radius_km ?? ""} /></label><label>Source repository (optional)<input name="repo" defaultValue={site?.source_repo ?? ""} /></label></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save site"}</button><button type="button" onClick={onDone}>Cancel</button></div>
  </form>;
}

function Dashboard() {
  const { signOut } = useAuthActions();
  const bootstrap = useMutation(api.workspace.bootstrap);
  const viewer = useQuery(api.workspace.viewer);
  const sites = useQuery(api.workspace.listSites) as Site[] | undefined;
  const memberships = useQuery(api.workspace.listMemberships) as { workspace_id: Id<"workspaces"> }[] | undefined;
  const [section, setSection] = useState<Section>("Overview");
  const [siteId, setSiteId] = useState<Id<"sites"> | null>(null);
  const [editSite, setEditSite] = useState<Site | "new" | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Id<"audits"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const runAudit = useAction(api.publicAudit.run);
  useEffect(() => { void bootstrap().catch(e => setError((e as Error).message)); }, [bootstrap]);
  useEffect(() => { if (sites?.length && !sites.some(s => s.id === siteId)) setSiteId(sites[0]!.id); }, [sites, siteId]);
  const site = sites?.find(s => s.id === siteId);
  const activeWorkspaceId = site?.workspace_id ?? memberships?.[0]?.workspace_id ?? null;
  const audits = useQuery(api.workspace.listAudits, siteId ? { siteId } : "skip") as Audit[] | undefined;
  const jobs = useQuery(api.workspace.listJobs, siteId ? { siteId } : "skip") as { id: string; status: string }[] | undefined;
  const gsc = useQuery(api.gsc.status, siteId ? { siteId } : "skip");
  const ga4 = useQuery(api.ga4.status, siteId ? { siteId } : "skip");
  const activeAuditId = selectedAudit ?? audits?.[0]?.id;
  const findings = useQuery(api.workspace.listAuditFindings, activeAuditId ? { auditId: activeAuditId } : "skip") as Finding[] | undefined;
  const latestFindings = useQuery(api.workspace.listAuditFindings, audits?.[0]?.id ? { auditId: audits[0].id } : "skip") as Finding[] | undefined;
  const pages = useQuery(api.workspace.listAuditPages, activeAuditId ? { auditId: activeAuditId } : "skip") as { id: string; kind: string; url: string; http_status: number | null; error: string | null }[] | undefined;
  const latestAudit = audits?.[0];
  const overviewLoading = sites === undefined || (site && (audits === undefined || (latestAudit && latestFindings === undefined)));
  const metrics: { label: string; value: number | null | undefined; connected: boolean; empty: string }[] = [
    { label: "Search clicks", value: gsc?.clicks, connected: !!gsc?.connected, empty: "No data yet" },
    { label: "Impressions", value: gsc?.impressions, connected: !!gsc?.connected, empty: "No data yet" },
    { label: "Average position", value: gsc?.position, connected: !!gsc?.connected, empty: "No data yet" },
    { label: "Active users", value: ga4?.activeUsers, connected: !!ga4?.connected, empty: "No data yet" },
    { label: "Sessions", value: ga4?.sessions, connected: !!ga4?.connected, empty: "No data yet" },
    { label: "Key events", value: ga4?.keyEvents, connected: !!ga4?.connected, empty: "No data yet" },
    { label: "Business conversions", value: null, connected: false, empty: "Not configured" },
  ];
  async function launchAudit() {
    if (!siteId) return;
    setBusy(true); setError("");
    try { const result = await runAudit({ siteId }); setSelectedAudit(result.auditId); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">◎</span><div>OmniVisibility<small>Autopilot · dev</small></div></div>
      <label className="site-select-label">SITE<select value={siteId ?? ""} onChange={e => { setSiteId(e.target.value as Id<"sites">); setSelectedAudit(null); }}>{sites?.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}</select></label>
      <nav aria-label="Main navigation">{navigationGroups.map(group => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.items.map(item => <button key={item} className={section === item ? "active" : ""} aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}>{item}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><span>{viewer?.email ?? "Dev account"}</span><button onClick={() => void signOut()}>Sign out</button></div>
    </aside>
    <main className="main"><header><div><p className="eyebrow">OMNIVISIBILITY / {section.toUpperCase()}</p><h1>{section === "Overview" ? "Your visibility workspace" : section}</h1><p className="muted">{site ? `${site.display_name} · ${site.domain}` : "Setting up workspace…"}</p><p className="page-purpose">{pagePurpose[section]}</p></div><div className="row"><span className="dev-badge">{jobs?.filter(j => j.status === "running").length ?? 0} running jobs</span><span className="dev-badge">Development</span></div></header>
      {section !== "Overview" && section !== "Integrations" && <div className="banner">{gsc?.connected || ga4?.connected ? <>Verified data sources: {gsc?.connected && <strong>Search Console </strong>}{ga4?.connected && <strong>Analytics </strong>}. View their date ranges on Overview.</> : <>Search and traffic data are <strong>not connected</strong>. Open Integrations to set them up.</>}</div>}
      {error && <p className="error panel" role="alert">{error}</p>}
      {section === "Overview" && <>
        <section className="panel overview-intro" aria-labelledby="overview-title"><p className="eyebrow">WHAT THIS APP IS FOR</p><h2 id="overview-title">Make your sites easier to find, one verified step at a time.</h2><p>Connect real search and traffic data. Check public pages for issues. Review the evidence and organize improvements for each client site.</p><p className="muted">This development app never changes or publishes a client's website on its own.</p></section>
        <section className="panel next-step" aria-labelledby="next-step-title"><div><p className="eyebrow">RECOMMENDED NEXT STEP</p><h2 id="next-step-title">{overviewLoading ? "Loading your next step" : !site ? "Add your first site" : !latestAudit ? "Run your first public check" : latestAudit.status === "failed" ? "Review the failed check" : latestFindings?.length ? "Review the issues found" : "Review what the last check covered"}</h2><p className="muted">{overviewLoading ? "Checking this site's saved runs and findings." : !site ? "Start with a domain and verified business facts." : !latestAudit ? "The check reads the homepage, robots.txt and sitemap. It does not edit the site." : latestAudit.status === "failed" ? "The result includes the actual error, so you can decide whether to retry." : latestFindings?.length ? `${latestFindings.length} finding${latestFindings.length === 1 ? "" : "s"} recorded. Open the evidence before planning a fix.` : "No issues were recorded in this limited check. Open the run to see which pages were fetched."}</p></div><button className="primary" disabled={!!overviewLoading} onClick={() => { if (!site) { setSection("Sites"); setEditSite("new"); } else setSection("Audits"); }}>{!site ? "Add site" : "Open audits"}</button></section>
        <section aria-labelledby="workflow-title"><h2 id="workflow-title" className="section-title">How to use this workspace</h2><div className="journey-grid"><div className="panel journey-card"><span className="step-number">1</span><h3>Understand</h3><p>Check real Google data and confirm the site's business facts.</p><button onClick={() => setSection(gsc?.connected || ga4?.connected ? "Integrations" : "Sites")}>View sources</button></div><div className="panel journey-card"><span className="step-number">2</span><h3>Check</h3><p>Run a read-only public audit, then inspect its pages and evidence.</p><button onClick={() => setSection("Audits")}>View checks</button></div><div className="panel journey-card"><span className="step-number">3</span><h3>Plan</h3><p>Review supported issues, create tasks, and write content briefs for human review.</p><button onClick={() => setSection("Opportunities")}>View work</button></div></div></section>
        <section aria-labelledby="signals-title"><div className="row space section-heading"><div><h2 id="signals-title">Verified signals</h2><p className="muted">These are source measurements, not a visibility score or a promise of rankings.</p></div><button onClick={() => setSection("Integrations")}>Manage sources</button></div><div className="metric-grid">{metrics.map(metric => <div className="panel metric" key={metric.label}><span>{metric.label}</span><strong>{typeof metric.value === "number" ? metric.label === "Average position" ? metric.value.toFixed(1) : metric.value.toLocaleString() : metric.connected ? metric.empty : metric.label === "Business conversions" ? metric.empty : "Not connected"}</strong></div>)}</div>{gsc?.periodStart && <p className="muted data-period">Search Console: {gsc.periodStart} to {gsc.periodEnd}.</p>}{ga4?.periodStart && <p className="muted data-period">Analytics: {ga4.periodStart} to {ga4.periodEnd}. Key events are not confirmed business conversions.</p>}</section>
      </>}
      {section === "Sites" && <><div className="row top-row"><p className="muted">Site facts stay editable. Publishing requires separately verified access.</p><button className="primary" onClick={() => setEditSite("new")}>Add site</button></div>{editSite && activeWorkspaceId && <SiteForm workspaceId={activeWorkspaceId} site={editSite === "new" ? undefined : editSite} onDone={() => setEditSite(null)} />}{sites?.map(s => <div className="panel" key={s.id}><div className="row space"><div><h2>{s.display_name}</h2><p className="muted">{s.domain} · {s.regions.join(", ")} · {s.languages.join(", ")}</p></div><button onClick={() => setEditSite(s)}>Edit facts</button></div><p>{String(s.business_facts["description"] ?? s.business_facts["offering"] ?? "No description yet")}</p><p className="muted">Ownership: {s.ownership_verified ? "Verified" : "Not verified"} · Source repo: {s.source_repo ?? "Not connected"}</p></div>)}</>}
      {section === "Audits" && <><div className="row top-row"><p className="muted">A read-only check of the homepage, robots.txt and sitemap. It cannot inspect the site's private code or every page. Runs are limited to one per site every two minutes.</p><button className="primary" disabled={busy || !site} onClick={() => void launchAudit()}>{busy ? "Running…" : "Run public check"}</button></div><div className="two-col"><div className="panel"><h2>Runs</h2>{audits?.length ? audits.map(a => <button className={`list-item ${activeAuditId === a.id ? "selected" : ""}`} key={a.id} onClick={() => setSelectedAudit(a.id)}><strong>{a.status}</strong><small>{new Date(a.created_at).toLocaleString()}</small></button>) : <p className="muted">No audit runs yet. Start a check to see which public pages can be read.</p>}</div><div className="panel"><h2>Run details</h2>{audits?.find(a => a.id === activeAuditId) ? <><p>Status: <strong>{audits.find(a => a.id === activeAuditId)?.status}</strong></p>{audits.find(a => a.id === activeAuditId)?.error && <p className="error">{audits.find(a => a.id === activeAuditId)?.error}</p>}<h3>Fetched pages</h3>{pages?.map(p => <p className="detail-line" key={p.id}><span>{p.kind}</span><span>{p.http_status ?? p.error ?? "Skipped"}</span><a href={p.url} target="_blank" rel="noreferrer">{p.url}</a></p>)}<h3>Findings</h3>{findings?.length ? findings.map(f => <div className="finding" key={f.id}><strong>{f.title}</strong><small>{f.severity}</small><p>{f.detail ?? f.recommendation}</p></div>) : <p className="muted">No issues were recorded in the checks completed. This is not a full-site or ranking audit.</p>}</> : <p className="muted">Select a run to see its pages and evidence.</p>}</div></div></>}
      {section === "Opportunities" && <OpportunitiesPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Content" && <ContentPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Keywords" && <KeywordsPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Competitors" && <CompetitorsPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Integrations" && <IntegrationsPage siteId={siteId} />}
      {section === "Automations" && <AutomationsPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Activity" && <ActivityPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Settings" && <SettingsPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
    </main>
  </div>;
}

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <main className="loading">Loading workspace…</main>;
  return isAuthenticated ? <Dashboard /> : <AuthScreen />;
}
