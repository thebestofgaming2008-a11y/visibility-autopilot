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

function AuthScreen() {
  const { signIn } = useAuthActions();
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
    <p className="notice">Dev accounts use email and password. Email verification, password reset, and Google sign in are being configured for this new stack.</p>
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
  const activeAuditId = selectedAudit ?? audits?.[0]?.id;
  const findings = useQuery(api.workspace.listAuditFindings, activeAuditId ? { auditId: activeAuditId } : "skip") as Finding[] | undefined;
  const pages = useQuery(api.workspace.listAuditPages, activeAuditId ? { auditId: activeAuditId } : "skip") as { id: string; kind: string; url: string; http_status: number | null; error: string | null }[] | undefined;
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
      <nav>{sections.map(item => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>)}</nav>
      <div className="sidebar-bottom"><span>{viewer?.email ?? "Dev account"}</span><button onClick={() => void signOut()}>Sign out</button></div>
    </aside>
    <main className="main"><header><div><p className="eyebrow">OMNIVISIBILITY / {section.toUpperCase()}</p><h1>{section}</h1><p className="muted">{site ? `${site.display_name} · ${site.domain}` : "Setting up workspace…"}</p></div><div className="row"><span className="dev-badge">{jobs?.filter(j => j.status === "running").length ?? 0} running jobs</span><span className="dev-badge">Development</span></div></header>
      <div className="banner">No data sources connected. Search and traffic metrics: <strong>Not connected</strong>.</div>
      {error && <p className="error panel" role="alert">{error}</p>}
      {section === "Overview" && <><div className="metric-grid">{["Search clicks", "Impressions", "Average position", "Conversions"].map(label => <div className="panel metric" key={label}><span>{label}</span><strong>Not connected</strong></div>)}</div><div className="panel"><h2>Public site checks</h2><p className="muted">{audits?.[0] ? `Latest audit: ${audits[0].status} · ${new Date(audits[0].created_at).toLocaleString()}` : "No audits yet."}</p><button className="primary" onClick={() => setSection("Audits")}>Open audits</button></div></>}
      {section === "Sites" && <><div className="row top-row"><p className="muted">Site facts stay editable. Publishing requires separately verified access.</p><button className="primary" onClick={() => setEditSite("new")}>Add site</button></div>{editSite && activeWorkspaceId && <SiteForm workspaceId={activeWorkspaceId} site={editSite === "new" ? undefined : editSite} onDone={() => setEditSite(null)} />}{sites?.map(s => <div className="panel" key={s.id}><div className="row space"><div><h2>{s.display_name}</h2><p className="muted">{s.domain} · {s.regions.join(", ")} · {s.languages.join(", ")}</p></div><button onClick={() => setEditSite(s)}>Edit facts</button></div><p>{String(s.business_facts["description"] ?? s.business_facts["offering"] ?? "No description yet")}</p><p className="muted">Ownership: {s.ownership_verified ? "Verified" : "Not verified"} · Source repo: {s.source_repo ?? "Not connected"}</p></div>)}</>}
      {section === "Audits" && <><div className="row top-row"><p className="muted">Read only public checks. Runs are limited to one per site every two minutes.</p><button className="primary" disabled={busy || !site} onClick={() => void launchAudit()}>{busy ? "Running…" : "Run audit"}</button></div><div className="two-col"><div className="panel"><h2>Runs</h2>{audits?.length ? audits.map(a => <button className={`list-item ${activeAuditId === a.id ? "selected" : ""}`} key={a.id} onClick={() => setSelectedAudit(a.id)}><strong>{a.status}</strong><small>{new Date(a.created_at).toLocaleString()}</small></button>) : <p className="muted">No audit runs yet.</p>}</div><div className="panel"><h2>Run details</h2>{audits?.find(a => a.id === activeAuditId) ? <><p>Status: <strong>{audits.find(a => a.id === activeAuditId)?.status}</strong></p>{audits.find(a => a.id === activeAuditId)?.error && <p className="error">{audits.find(a => a.id === activeAuditId)?.error}</p>}<h3>Fetched pages</h3>{pages?.map(p => <p className="detail-line" key={p.id}><span>{p.kind}</span><span>{p.http_status ?? p.error ?? "Skipped"}</span><a href={p.url} target="_blank" rel="noreferrer">{p.url}</a></p>)}<h3>Findings</h3>{findings?.length ? findings.map(f => <div className="finding" key={f.id}><strong>{f.title}</strong><small>{f.severity}</small><p>{f.detail ?? f.recommendation}</p></div>) : <p className="muted">No findings recorded for this site.</p>}</> : <p className="muted">Select a run to see evidence.</p>}</div></div></>}
      {section === "Opportunities" && <OpportunitiesPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Content" && <ContentPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Keywords" && <KeywordsPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Competitors" && <CompetitorsPage siteId={siteId} workspaceId={activeWorkspaceId} regions={site?.regions ?? []} />}
      {section === "Integrations" && <IntegrationsPage />}
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
