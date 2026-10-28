import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSite, logEvent, sevClass } from "@/lib/app";
import { runPublicAudit } from "@/lib/audit/audit.functions";
import { priorityScore } from "@/lib/audit/rules";
import { normalizeDomain } from "@/lib/audit/ssrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Site = Tables["sites"]["Row"];
const stamp = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";
const split = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function Page({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded border bg-muted/40 p-3 text-sm text-muted-foreground">{children}</p>;
}
function State({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error?: Error | null;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading) return <Notice>Loading verified data…</Notice>;
  if (error) return <Notice>Could not load data: {error.message}</Notice>;
  if (empty) return <Notice>No records yet.</Notice>;
  return <>{children}</>;
}
function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  hint?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Message({ value }: { value: string | null }) {
  return (
    value && (
      <p role="status" className="text-sm text-accent-foreground">
        {value}
      </p>
    )
  );
}
type SiteTable =
  | "audits"
  | "opportunities"
  | "job_runs"
  | "findings"
  | "content_briefs"
  | "keywords"
  | "competitor_sites"
  | "integration_connections";
function useRows<T extends SiteTable>(table: T, siteId?: string | null) {
  return useQuery({
    queryKey: [table, siteId],
    enabled: siteId !== null,
    queryFn: async () => {
      const query = supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const { data, error } = siteId ? await query.eq("site_id" as never, siteId) : await query;
      if (error) throw error;
      return data;
    },
  });
}

export function OverviewPage() {
  const { site, siteId, sites } = useSite();
  const audits = useRows("audits", siteId);
  const opportunities = useRows("opportunities", siteId);
  const jobs = useRows("job_runs", siteId);
  return (
    <Page title="Overview" description="Verified site activity and the next work to review.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["Organic traffic", "Search rankings", "Conversions", "AI citations"].map((x) => (
          <Panel key={x}>
            <p className="text-xs text-muted-foreground">{x}</p>
            <p className="mt-2 text-lg font-semibold">Not connected</p>
          </Panel>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Site status">
          <State loading={sites.isLoading} error={sites.error} empty={!site}>
            <p className="font-medium">{site?.display_name}</p>
            <p className="text-muted-foreground">{site?.domain}</p>
            <p className="mt-2 text-xs">
              {site?.ownership_verified ? "Ownership verified" : "Ownership not verified"} ·{" "}
              {site?.write_access_verified ? "Write access verified" : "Read-only public access"}
            </p>
          </State>
          <Link to="/sites" className="mt-3 inline-block text-sm text-accent-foreground underline">
            Manage sites
          </Link>
        </Panel>
        <Panel title="Recent audit">
          <State loading={audits.isLoading} error={audits.error} empty={!audits.data?.length}>
            <p className="font-medium">{audits.data?.[0]?.status}</p>
            <p className="text-xs text-muted-foreground">{stamp(audits.data?.[0]?.started_at)}</p>
            <p className="mt-2 text-sm">{audits.data?.[0]?.error}</p>
          </State>
          <Link to="/audits" className="mt-3 inline-block text-sm text-accent-foreground underline">
            View audits
          </Link>
        </Panel>
        <Panel title="Open opportunities">
          <State
            loading={opportunities.isLoading}
            error={opportunities.error}
            empty={!opportunities.data?.length}
          >
            {opportunities.data
              ?.filter((o) => !["verified", "dismissed", "rolled_back"].includes(o.status))
              .slice(0, 5)
              .map((o) => (
                <p key={o.id} className="border-t py-2 first:border-0">
                  {o.title} <span className="text-xs text-muted-foreground">· {o.status}</span>
                </p>
              ))}
          </State>
        </Panel>
        <Panel title="Recent jobs">
          <State loading={jobs.isLoading} error={jobs.error} empty={!jobs.data?.length}>
            {jobs.data?.slice(0, 5).map((j) => (
              <p key={j.id} className="border-t py-2 first:border-0">
                {j.kind} · {j.status}{" "}
                <span className="text-xs text-muted-foreground">{stamp(j.started_at)}</span>
              </p>
            ))}
          </State>
        </Panel>
      </div>
    </Page>
  );
}

export function SitesPage() {
  const { sites, setSiteId } = useSite();
  const qc = useQueryClient();
  const memberships = useQuery({
    queryKey: ["memberships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("memberships").select("*");
      if (error) throw error;
      return data;
    },
  });
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<Site | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [facts, setFacts] = useState("");
  const [regions, setRegions] = useState("");
  const [langs, setLangs] = useState("fr-BE, nl-BE, en");
  const [radius, setRadius] = useState("");
  const [repo, setRepo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function edit(s: Site) {
    setEditing(s);
    setName(s.display_name);
    setDomain(s.domain);
    setFacts(
      typeof s.business_facts === "string"
        ? s.business_facts
        : typeof s.business_facts === "object" &&
            s.business_facts &&
            !Array.isArray(s.business_facts) &&
            typeof s.business_facts["description"] === "string"
          ? s.business_facts["description"]
          : JSON.stringify(s.business_facts, null, 2),
    );
    setRegions(s.regions.join(", "));
    setLangs(s.languages.join(", "));
    setRadius(String(s.service_radius_km ?? ""));
    setRepo(s.source_repo ?? "");
    setStep(0);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const normalized = normalizeDomain(domain);
      const workspace_id = editing?.workspace_id ?? memberships.data?.[0]?.workspace_id;
      if (!workspace_id)
        throw new Error(
          "No workspace membership is available. Complete sign-up or contact support.",
        );
      if (
        radius &&
        (!Number.isFinite(Number(radius)) || Number(radius) < 0 || Number(radius) > 500)
      )
        throw new Error("Service radius must be between 0 and 500 km.");
      const oldFacts = editing?.business_facts;
      const business_facts = {
        ...(oldFacts && typeof oldFacts === "object" && !Array.isArray(oldFacts) ? oldFacts : {}),
        description: facts.trim(),
      };
      const values = {
        display_name: name.trim(),
        domain: normalized,
        business_facts,
        regions: split(regions),
        languages: split(langs),
        service_radius_km: radius ? Number(radius) : null,
        source_repo: repo.trim() || null,
        allow_location_pages: false,
      };
      if (!values.display_name || !facts.trim() || !values.languages.length)
        throw new Error("Name, business facts and at least one language are required.");
      if (editing) {
        const { error } = await supabase.from("sites").update(values).eq("id", editing.id);
        if (error) throw error;
        await logEvent(workspace_id, "site", editing.id, "site_updated");
      } else {
        const { data, error } = await supabase
          .from("sites")
          .insert({ ...values, workspace_id })
          .select()
          .single();
        if (error) throw error;
        setSiteId(data.id);
        await logEvent(workspace_id, "site", data.id, "site_created");
      }
      await qc.invalidateQueries({ queryKey: ["sites"] });
      setMsg(
        editing ? "Site updated." : "Site added. Ownership and write access remain unverified.",
      );
      setEditing(null);
      setStep(0);
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Sites"
      description="Manage truthful site facts and permission boundaries."
      action={
        <Button
          variant="outline"
          onClick={() => {
            setEditing(null);
            setName("");
            setDomain("");
            setFacts("");
            setRegions("");
            setLangs("fr-BE, nl-BE, en");
            setRadius("");
            setRepo("");
            setStep(0);
          }}
        >
          Add site
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Your sites">
          <State loading={sites.isLoading} error={sites.error} empty={!sites.data?.length}>
            {sites.data?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 border-t py-3 first:border-0"
              >
                <div>
                  <p className="font-medium">{s.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.domain} · {s.ownership_verified ? "Verified" : "Ownership unverified"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => edit(s)}>
                  Edit
                </Button>
              </div>
            ))}
          </State>
        </Panel>
        <Panel title={editing ? "Edit site facts" : "Site onboarding"}>
          <p className="mb-3 text-xs text-muted-foreground">
            Step {step + 1} of 3 · {["Domain", "Business facts", "Regions and permissions"][step]}
          </p>
          <form onSubmit={save} className="space-y-3">
            {step === 0 && (
              <>
                <Field label="Site name" value={name} onChange={setName} required />
                <Field
                  label="Domain"
                  value={domain}
                  onChange={setDomain}
                  required
                  hint="HTTPS public domain only. No ownership is assumed."
                />
              </>
            )}
            {step === 1 && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="business-facts">Verified business facts</Label>
                  <Textarea
                    id="business-facts"
                    value={facts}
                    onChange={(e) => setFacts(e.target.value)}
                    required
                    rows={6}
                    placeholder="Describe only facts confirmed by the client."
                  />
                </div>
                <Notice>
                  For Yabi Location: monthly commercial utility van rentals around Brussels and
                  Vilvoorde; no fixed customer-facing garage. Add other details only after
                  verification.
                </Notice>
              </>
            )}
            {step === 2 && (
              <>
                <Field
                  label="Regions"
                  value={regions}
                  onChange={setRegions}
                  hint="Comma-separated verified service regions; do not create doorway pages."
                />
                <Field
                  label="Languages"
                  value={langs}
                  onChange={setLangs}
                  required
                  hint="Comma-separated, priority order."
                />
                <Field
                  label="Service radius km"
                  value={radius}
                  onChange={setRadius}
                  type="number"
                />
                <Field
                  label="Source repository"
                  value={repo}
                  onChange={setRepo}
                  hint="Optional. Listing a repo does not grant write access."
                />
                <Notice>
                  Public audits are read-only. Production writes require separately verified access
                  and approval.
                </Notice>
              </>
            )}
            <Message value={msg} />
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button type="button" onClick={() => setStep(step + 1)}>
                  Continue
                </Button>
              ) : (
                <Button disabled={busy}>
                  {busy ? "Saving…" : editing ? "Save changes" : "Add site"}
                </Button>
              )}
            </div>
          </form>
        </Panel>
      </div>
    </Page>
  );
}

export function AuditsPage() {
  const { siteId } = useSite();
  const qc = useQueryClient();
  const audits = useRows("audits", siteId);
  const findings = useRows("findings", siteId);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async () => {
      if (!siteId) throw new Error("Select a site first.");
      return runPublicAudit({ data: { siteId } });
    },
    onSuccess: async (result) => {
      setMsg(
        result.status === "failed"
          ? `Audit failed: ${JSON.stringify(result.summary)}`
          : `Audit ${result.status}.`,
      );
      setSelected(result.auditId);
      await qc.invalidateQueries();
    },
    onError: (e) => setMsg(e.message),
  });
  const current = selected ?? audits.data?.[0]?.id;
  return (
    <Page
      title="Audits"
      description="Public read-only checks with recorded evidence and real job status."
      action={
        <Button disabled={!siteId || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Running audit…" : "Run audit"}
        </Button>
      }
    >
      <Message value={msg} />
      <Notice>
        Checks fetch robots.txt, the homepage and sitemap. A failed or blocked check stays explicit.
        Reruns are limited to one per site every two minutes.
      </Notice>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Panel title="Runs">
          <State loading={audits.isLoading} error={audits.error} empty={!audits.data?.length}>
            {audits.data?.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`block w-full border-t py-2 text-left first:border-0 ${current === a.id ? "text-accent-foreground" : ""}`}
              >
                <span className="font-medium capitalize">{a.status}</span>
                <span className="block text-xs text-muted-foreground">{stamp(a.started_at)}</span>
                {a.error && <span className="block text-xs text-destructive">{a.error}</span>}
              </button>
            ))}
          </State>
        </Panel>
        <Panel title="Findings and evidence">
          <State
            loading={findings.isLoading}
            error={findings.error}
            empty={!findings.data?.some((f) => f.audit_id === current)}
          >
            {findings.data
              ?.filter((f) => f.audit_id === current)
              .map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
          </State>
        </Panel>
      </div>
    </Page>
  );
}
function FindingCard({ finding: f }: { finding: Tables["findings"]["Row"] }) {
  const evidence = useQuery({
    queryKey: ["evidence", f.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("evidence").select("*").eq("finding_id", f.id);
      if (error) throw error;
      return data;
    },
  });
  return (
    <article className="border-t py-3 first:border-0">
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-xs ${sevClass[f.severity] ?? "bg-muted"}`}>
          {f.severity}
        </span>
        <h3 className="font-medium">{f.title}</h3>
      </div>
      <p className="mt-1 text-sm">{f.recommendation}</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">{f.url}</p>
      {evidence.data?.map((e) => (
        <details key={e.id} className="mt-2 text-xs">
          <summary className="cursor-pointer">
            Evidence · {stamp(e.observed_at)} · HTTP {e.http_status ?? "unavailable"}
          </summary>
          <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">
            {e.snippet || "No source snippet recorded"}
          </pre>
        </details>
      ))}
    </article>
  );
}

export function OpportunitiesPage() {
  const { siteId, site } = useSite();
  const qc = useQueryClient();
  const rows = useRows("opportunities", siteId);
  const [msg, setMsg] = useState<string | null>(null);
  const tasks = useQuery({
    queryKey: ["tasks", site?.workspace_id],
    enabled: !!site,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", site!.workspace_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  async function change(o: Tables["opportunities"]["Row"], status: string) {
    const { error } = await supabase
      .from("opportunities")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    if (error) {
      setMsg(error.message);
      return;
    }
    await logEvent(o.workspace_id, "opportunity", o.id, `status_${status}`);
    await qc.invalidateQueries({ queryKey: ["opportunities"] });
    setMsg("Status saved.");
  }
  async function task(o: Tables["opportunities"]["Row"]) {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: o.workspace_id,
        opportunity_id: o.id,
        title: o.next_action || o.title,
      })
      .select()
      .single();
    if (error) {
      setMsg(error.message);
      return;
    }
    await logEvent(o.workspace_id, "task", data.id, "task_created");
    await qc.invalidateQueries({ queryKey: ["tasks"] });
    setMsg("Task created.");
  }
  async function taskStatus(t: Tables["tasks"]["Row"], status: string) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) return setMsg(error.message);
    await logEvent(t.workspace_id, "task", t.id, `status_${status}`);
    await qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  return (
    <Page
      title="Opportunities"
      description="Evidence-linked work ranked by impact × confidence ÷ effort."
    >
      <Message value={msg} />
      <State loading={rows.isLoading} error={rows.error} empty={!rows.data?.length}>
        <div className="space-y-3">
          {rows.data &&
            [...rows.data]
              .sort(
                (a, b) =>
                  priorityScore(b.impact, b.confidence, b.effort) -
                  priorityScore(a.impact, a.confidence, a.effort),
              )
              .map((o) => (
                <Panel key={o.id}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{o.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>
                      <p className="mt-2 text-xs">
                        Priority {priorityScore(o.impact, o.confidence, o.effort)} · {o.status} ·
                        owner: {o.owner} · risk: {o.risk}
                      </p>
                      <p className="mt-1 text-xs">Next: {o.next_action ?? "Review evidence"}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <label className="sr-only" htmlFor={`status-${o.id}`}>
                        Status for {o.title}
                      </label>
                      <select
                        id={`status-${o.id}`}
                        className="rounded border bg-background p-1 text-xs"
                        value={o.status}
                        onChange={(e) => change(o, e.target.value)}
                      >
                        {[
                          "discovered",
                          "triaged",
                          "approved",
                          "in_progress",
                          "verified",
                          "failed",
                          "rolled_back",
                          "dismissed",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" onClick={() => task(o)}>
                        Create task
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))}
        </div>
      </State>
      <Panel title="Tasks">
        <State loading={tasks.isLoading} error={tasks.error} empty={!tasks.data?.length}>
          {tasks.data?.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 border-t py-2 first:border-0"
            >
              <span>{t.title}</span>
              <label className="sr-only" htmlFor={`task-${t.id}`}>
                Status for {t.title}
              </label>
              <select
                id={`task-${t.id}`}
                className="rounded border bg-background p-1 text-xs"
                value={t.status}
                onChange={(e) => taskStatus(t, e.target.value)}
              >
                {["todo", "doing", "blocked", "done"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          ))}
        </State>
      </Panel>
    </Page>
  );
}

export function ContentPage() {
  const { site, siteId } = useSite();
  const qc = useQueryClient();
  const rows = useRows("content_briefs", siteId);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("");
  const [language, setLanguage] = useState("fr-BE");
  const [type, setType] = useState("service");
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  function edit(b: Tables["content_briefs"]["Row"]) {
    setEditingId(b.id);
    setTitle(b.title);
    setQuery(b.target_query ?? "");
    setIntent(b.search_intent ?? "");
    setLanguage(b.language);
    setType(b.page_type);
    setDraft(b.draft ?? "");
    setSource(Array.isArray(b.sources) && typeof b.sources[0] === "string" ? b.sources[0] : "");
  }
  function reset() {
    setEditingId(null);
    setTitle("");
    setQuery("");
    setIntent("");
    setLanguage("fr-BE");
    setType("service");
    setDraft("");
    setSource("");
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!site) return;
    const values = {
      title,
      target_query: query || null,
      search_intent: intent || null,
      language,
      page_type: type,
      draft: draft || null,
      applicability: site.regions.join(", "),
      sources: source ? [source] : [],
      ai_generated: false,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await supabase.from("content_briefs").update(values).eq("id", editingId);
      if (error) return setMsg(error.message);
      await logEvent(site.workspace_id, "content_brief", editingId, "brief_updated");
    } else {
      const { data, error } = await supabase
        .from("content_briefs")
        .insert({ ...values, workspace_id: site.workspace_id, site_id: site.id })
        .select()
        .single();
      if (error) return setMsg(error.message);
      await logEvent(site.workspace_id, "content_brief", data.id, "brief_created");
    }
    reset();
    setMsg("Draft brief saved.");
    qc.invalidateQueries({ queryKey: ["content_briefs"] });
  }
  async function remove(id: string) {
    if (!site || !window.confirm("Delete this draft brief?")) return;
    const { error } = await supabase.from("content_briefs").delete().eq("id", id);
    if (error) return setMsg(error.message);
    await logEvent(site.workspace_id, "content_brief", id, "brief_deleted");
    qc.invalidateQueries({ queryKey: ["content_briefs"] });
  }
  return (
    <Page
      title="Content"
      description="Human-edited briefs grounded in verified facts and cited sources."
    >
      <Notice>
        AI generation is not configured. Drafts are editable templates and are never marked
        published automatically.
      </Notice>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title={editingId ? "Edit brief" : "New brief"}>
          <form onSubmit={create} className="space-y-3">
            <Field label="Brief title" value={title} onChange={setTitle} required />
            <Field label="Target query" value={query} onChange={setQuery} />
            <Field label="Search intent" value={intent} onChange={setIntent} />
            <Field label="Language" value={language} onChange={setLanguage} />
            <div className="space-y-1">
              <Label htmlFor="page-type">Page type</Label>
              <select
                id="page-type"
                className="w-full rounded border bg-background p-2"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {["service", "product", "faq", "blog"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <Field label="Verified source URL" value={source} onChange={setSource} type="url" />
            <div>
              <Label htmlFor="draft">Outline or draft</Label>
              <Textarea
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder="Include facts, audience, and sources. Avoid unverified claims and duplicate location pages."
              />
            </div>
            <Button disabled={!siteId}>Save brief</Button>
            {editingId && (
              <Button type="button" variant="outline" className="ml-2" onClick={reset}>
                Cancel
              </Button>
            )}
            <Message value={msg} />
          </form>
        </Panel>
        <Panel title="Briefs">
          <State loading={rows.isLoading} error={rows.error} empty={!rows.data?.length}>
            {rows.data?.map((b) => (
              <div key={b.id} className="border-t py-3 first:border-0">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.language} · {b.page_type} · {b.status}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => edit(b)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(b.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{b.draft}</p>
              </div>
            ))}
          </State>
        </Panel>
      </div>
    </Page>
  );
}

export function KeywordsPage() {
  const { site } = useSite();
  const qc = useQueryClient();
  const rows = useRows("keywords", site?.id ?? null);
  const [term, setTerm] = useState("");
  const [language, setLanguage] = useState("fr-BE");
  const [intent, setIntent] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!site) return;
    const { data, error } = await supabase
      .from("keywords")
      .insert({
        workspace_id: site.workspace_id,
        site_id: site.id,
        term,
        language,
        intent: intent || null,
        source: "manual",
      })
      .select()
      .single();
    if (error) return setMsg(error.message);
    await logEvent(site.workspace_id, "keyword", data.id, "keyword_created");
    setTerm("");
    qc.invalidateQueries({ queryKey: ["keywords"] });
  }
  async function remove(id: string) {
    if (!site) return;
    const { error } = await supabase.from("keywords").delete().eq("id", id);
    if (error) return setMsg(error.message);
    await logEvent(site.workspace_id, "keyword", id, "keyword_deleted");
    qc.invalidateQueries({ queryKey: ["keywords"] });
  }
  return (
    <Page
      title="Keywords"
      description="A manual research list; rankings require a connected source."
    >
      <Panel title="Add keyword">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Keyword" value={term} onChange={setTerm} required />
          <Field label="Language" value={language} onChange={setLanguage} />
          <Field label="Intent" value={intent} onChange={setIntent} />
          <Button disabled={!site}>Add</Button>
        </form>
        <Message value={msg} />
      </Panel>
      <Panel title="Tracked ideas">
        <State loading={rows.isLoading} error={rows.error} empty={!rows.data?.length}>
          {rows.data?.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between border-t py-2 first:border-0"
            >
              <span>
                {k.term}{" "}
                <small className="text-muted-foreground">
                  {k.language} · {k.intent || "Intent not set"} · Rankings not connected
                </small>
              </span>
              <Button variant="outline" size="sm" onClick={() => remove(k.id)}>
                Remove
              </Button>
            </div>
          ))}
        </State>
      </Panel>
    </Page>
  );
}

export function CompetitorsPage() {
  const { site } = useSite();
  const qc = useQueryClient();
  const rows = useRows("competitor_sites", site?.id ?? null);
  const [domain, setDomain] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!site) return;
    try {
      const value = normalizeDomain(domain);
      const { data, error } = await supabase
        .from("competitor_sites")
        .insert({
          workspace_id: site.workspace_id,
          site_id: site.id,
          domain: value,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      await logEvent(site.workspace_id, "competitor", data.id, "competitor_created");
      setDomain("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["competitor_sites"] });
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function remove(id: string) {
    if (!site) return;
    const { error } = await supabase.from("competitor_sites").delete().eq("id", id);
    if (error) return setMsg(error.message);
    await logEvent(site.workspace_id, "competitor", id, "competitor_deleted");
    qc.invalidateQueries({ queryKey: ["competitor_sites"] });
  }
  return (
    <Page
      title="Competitors"
      description="Curated public domains. Competitive metrics await verified data."
    >
      <Panel title="Add competitor">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <Field label="Competitor domain" value={domain} onChange={setDomain} required />
          <Field label="Notes" value={notes} onChange={setNotes} />
          <Button disabled={!site}>Add</Button>
        </form>
        <Message value={msg} />
      </Panel>
      <Panel title="Domains">
        <State loading={rows.isLoading} error={rows.error} empty={!rows.data?.length}>
          {rows.data?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border-t py-2 first:border-0"
            >
              <span>
                {c.domain} <small className="text-muted-foreground">{c.notes}</small>
              </span>
              <Button variant="outline" size="sm" onClick={() => remove(c.id)}>
                Remove
              </Button>
            </div>
          ))}
        </State>
      </Panel>
    </Page>
  );
}

const providers = [
  [
    "Google Search Console",
    "Register an OAuth app in Google Cloud, configure a secure callback and request read-only Search Console scope. Verify property access before enabling data.",
  ],
  [
    "Google Analytics 4",
    "Register Google OAuth credentials and request read-only Analytics scope. Select and verify the GA4 property.",
  ],
  [
    "Bing Webmaster",
    "Register an app with Microsoft, configure OAuth/API credentials server-side, then verify the site.",
  ],
  [
    "GitHub",
    "Install a scoped GitHub app on the authorized repository. Verify write permission separately before proposing code changes.",
  ],
  [
    "Semrush",
    "Optional: configure an API subscription and store its token in server-side secret management.",
  ],
  [
    "Google Business Profile",
    "Only for eligible verified profiles. Configure OAuth and confirm the business is eligible before requesting access.",
  ],
] as const;
export function IntegrationsPage() {
  const { siteId } = useSite();
  const rows = useRows("integration_connections", siteId);
  return (
    <Page
      title="Integrations"
      description="Provider access remains disconnected until authenticated and verified."
    >
      <Notice>
        Register provider clients and secure server-side credentials before enabling OAuth. Never
        paste secrets into chat or a content field.
      </Notice>
      <div className="grid gap-3 md:grid-cols-2">
        {providers.map(([name, steps]) => (
          <Panel key={name}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{name}</h2>
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {rows.data?.find(
                  (r) => r.provider.toLowerCase() === name.toLowerCase() && r.verified_at,
                )?.status ?? "Disconnected"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{steps}</p>
            <p className="mt-2 text-xs">Setup pending · no credentials configured</p>
          </Panel>
        ))}
      </div>
    </Page>
  );
}

const risks = [
  ["Public read-only audit", "Low", "Runs with rate and network limits"],
  ["Draft brief or proposed change", "Low", "Creates a reviewable draft"],
  ["Production code or site publish", "High", "Explicit consent, tests, monitoring and rollback"],
  ["Public posting, GBP edit or reply", "High", "Explicit consent for each action"],
  ["Bulk links, fake reviews or locations", "Prohibited", "Never automated"],
];
export function AutomationsPage() {
  const { site } = useSite();
  const qc = useQueryClient();
  const ws = useQuery({
    queryKey: ["workspace", site?.workspace_id],
    enabled: !!site,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", site!.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [msg, setMsg] = useState<string | null>(null);
  async function setMode(mode: string) {
    if (!site) return;
    const { error } = await supabase
      .from("workspaces")
      .update({ autopilot_mode: mode })
      .eq("id", site.workspace_id);
    if (error) return setMsg(error.message);
    await logEvent(site.workspace_id, "workspace", site.workspace_id, `mode_${mode}`);
    qc.invalidateQueries({ queryKey: ["workspace"] });
    setMsg(`${mode} mode saved.`);
  }
  return (
    <Page
      title="Automations"
      description="Operational policy and approval boundaries for this workspace."
    >
      <Notice>Scheduling is not active. Public audits run when you select Run audit.</Notice>
      <Panel title="Autopilot mode">
        <State loading={ws.isLoading} error={ws.error} empty={!ws.data}>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                ["manual", "Manual", "Review and initiate every action."],
                [
                  "guarded",
                  "Guarded",
                  "Prepare proposals and tests; never publish without consent.",
                ],
                [
                  "advanced",
                  "Advanced",
                  "Only explicitly authorized low-risk changes with tests and rollback.",
                ],
              ] as const
            ).map(([value, title, copy]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`rounded border p-3 text-left ${ws.data?.autopilot_mode === value ? "border-teal bg-accent" : ""}`}
              >
                <strong>{title}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">{copy}</span>
              </button>
            ))}
          </div>
        </State>
        <Message value={msg} />
      </Panel>
      <Panel title="Action risk matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="pb-2">Action</th>
                <th>Risk</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {risks.map(([action, risk, rule]) => (
                <tr key={action} className="border-t">
                  <td className="py-2">{action}</td>
                  <td>{risk}</td>
                  <td>{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}

export function ActivityPage() {
  const { site } = useSite();
  const jobs = useRows("job_runs", site?.id ?? null);
  const events = useQuery({
    queryKey: ["change_events", site?.workspace_id],
    enabled: !!site,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_events")
        .select("*")
        .eq("workspace_id", site!.workspace_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  return (
    <Page title="Activity" description="Actual job timestamps and append-only change history.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Jobs">
          <State loading={jobs.isLoading} error={jobs.error} empty={!jobs.data?.length}>
            {jobs.data?.map((j) => (
              <div key={j.id} className="border-t py-2 first:border-0">
                <p className="font-medium">
                  {j.kind} · {j.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {stamp(j.started_at)} · finished {stamp(j.finished_at)}
                </p>
                {j.error && <p className="text-xs text-destructive">{j.error}</p>}
              </div>
            ))}
          </State>
        </Panel>
        <Panel title="Change events">
          <State loading={events.isLoading} error={events.error} empty={!events.data?.length}>
            {events.data?.map((e) => (
              <div key={e.id} className="border-t py-2 first:border-0">
                <p className="font-medium">{e.action}</p>
                <p className="text-xs text-muted-foreground">
                  {e.entity} · {stamp(e.created_at)}
                </p>
              </div>
            ))}
          </State>
        </Panel>
      </div>
    </Page>
  );
}

export function SettingsPage() {
  const { site } = useSite();
  const ws = useQuery({
    queryKey: ["workspace", site?.workspace_id],
    enabled: !!site,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", site!.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const membership = useQuery({
    queryKey: ["my-membership", site?.workspace_id],
    enabled: !!site,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("workspace_id", site!.workspace_id)
        .eq("user_id", auth.user?.id ?? "")
        .single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <Page
      title="Settings"
      description="Workspace access, connection status and planned interfaces."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Workspace">
          <State loading={ws.isLoading} error={ws.error} empty={!ws.data}>
            <p>{ws.data?.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Autopilot mode: {ws.data?.autopilot_mode}
            </p>
            <p className="text-xs text-muted-foreground">
              Your role: {membership.data?.role ?? "Loading…"}
            </p>
          </State>
        </Panel>
        <Panel title="MCP / ChatGPT">
          <p className="font-medium text-destructive">Not online</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A secure remote Streamable HTTP server with user OAuth is planned. No endpoint or
            connection is active.
          </p>
          <p className="mt-2 text-xs">
            Planned tools: list_sites, get_site, run_public_audit, list_findings, list_tasks,
            propose_fix, get_job_status, update_task_status. Approval rules will apply to write
            actions.
          </p>
        </Panel>
      </div>
    </Page>
  );
}
