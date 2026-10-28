import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type SiteContext = { siteId: Id<"sites"> | null; workspaceId: Id<"workspaces"> | null; regions: string[] };
type Brief = { id: Id<"content_briefs">; title: string; language: string; page_type: "service" | "product" | "faq" | "blog" | "supporting"; target_query: string | null; search_intent: string | null; draft: string | null; sources: string[]; status: string };
type Keyword = { id: string; term: string; language: string; intent: string | null };
type Competitor = { id: string; domain: string; notes: string | null };
type Opportunity = { id: Id<"opportunities">; title: string; status: string; impact: number; confidence: number; effort: number; next_action: string | null };
type Task = { id: Id<"tasks">; opportunity_id: Id<"opportunities">; title: string; status: "todo" | "doing" | "done" | "blocked" };

export function OpportunitiesPage({ siteId, workspaceId }: SiteContext) {
  const opportunities = useQuery(api.workspace.listOpportunities, siteId ? { siteId } : "skip") as Opportunity[] | undefined;
  const tasks = useQuery(api.workspace.listTasks, workspaceId ? { workspaceId } : "skip") as Task[] | undefined;
  const setStatus = useMutation(api.workspace.setOpportunityStatus);
  const addTask = useMutation(api.workspace.addTask);
  const setTaskStatus = useMutation(api.workspace.setTaskStatus);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, opportunityId: Id<"opportunities">) {
    event.preventDefault(); const form = event.currentTarget; const title = String(new FormData(form).get("title") ?? "");
    try { await addTask({ opportunityId, title }); form.reset(); setError(""); } catch (reason) { setError((reason as Error).message); }
  }
  return <div className="panel"><h2>Ranked opportunities and tasks</h2><p className="muted">Score = Impact × Confidence ÷ Effort. Evidence is collected by public audits.</p>{error && <p className="error">{error}</p>}{opportunities?.length ? opportunities.map(o => <div className="opportunity" key={o.id}><div className="row space"><h3>{o.title}</h3><strong>{Math.round(o.impact * o.confidence / Math.max(o.effort, 1) * 10) / 10}</strong></div><p className="muted">Impact {o.impact} × Confidence {o.confidence} ÷ Effort {o.effort}</p><p>{o.next_action}</p><label>Status <select value={o.status} onChange={e => void setStatus({ opportunityId: o.id, status: e.target.value as "discovered" | "triaged" | "approved" | "in_progress" | "verified" | "failed" | "rolled_back" | "dismissed" }).catch(reason => setError((reason as Error).message))}>{["discovered", "triaged", "approved", "in_progress", "verified", "failed", "rolled_back", "dismissed"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label><h3>Tasks</h3>{tasks?.filter(t => t.opportunity_id === o.id).map(t => <div className="row space" key={t.id}><span>{t.title}</span><select className="inline-select" value={t.status} onChange={e => void setTaskStatus({ taskId: t.id, status: e.target.value as Task["status"] }).catch(reason => setError((reason as Error).message))}>{["todo", "doing", "done", "blocked"].map(s => <option key={s}>{s}</option>)}</select></div>)}<form className="row" onSubmit={e => void submit(e, o.id)}><input name="title" placeholder="Add next task" required /><button>Add task</button></form></div>) : <p className="muted">No opportunities yet. Run an audit to collect evidence.</p>}</div>;
}

export function ContentPage({ siteId }: SiteContext) {
  const rows = useQuery(api.workspace.listContent, siteId ? { siteId } : "skip") as Brief[] | undefined;
  const save = useMutation(api.workspace.saveContent);
  const [editing, setEditing] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formKey, setFormKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!siteId) return;
    const data = new FormData(event.currentTarget);
    try {
      await save({ siteId, ...(editing ? { briefId: editing.id } : {}), title: String(data.get("title")), language: String(data.get("language")), pageType: String(data.get("type")) as Brief["page_type"], targetQuery: String(data.get("query") ?? ""), searchIntent: String(data.get("intent") ?? ""), draft: String(data.get("draft") ?? ""), sourceUrl: String(data.get("source") ?? "") });
      setEditing(null); setFormKey(k => k + 1); setError(""); setNotice("Brief saved.");
    } catch (reason) { setError((reason as Error).message); }
  }
  return <><div className="banner">Human edited drafts only. AI generation and publishing are not connected.</div><div className="two-col"><form key={`${editing?.id ?? "new"}-${formKey}`} className="panel form-stack" onSubmit={submit}><h2>{editing ? "Edit brief" : "New content brief"}</h2><label>Title<input name="title" defaultValue={editing?.title} required /></label><div className="form-grid"><label>Target query<input name="query" defaultValue={editing?.target_query ?? ""} /></label><label>Search intent<input name="intent" defaultValue={editing?.search_intent ?? ""} /></label></div><div className="form-grid"><label>Language<input name="language" defaultValue={editing?.language ?? "fr-BE"} required /></label><label>Page type<select name="type" defaultValue={editing?.page_type ?? "service"}>{["service", "product", "faq", "blog", "supporting"].map(x => <option key={x}>{x}</option>)}</select></label></div><label>Verified source URL<input name="source" type="url" defaultValue={editing?.sources?.[0] ?? ""} /></label><label>Outline or draft<textarea name="draft" defaultValue={editing?.draft ?? ""} /></label>{error && <p className="error">{error}</p>}{notice && <p className="muted">{notice}</p>}<div className="row"><button className="primary" disabled={!siteId}>Save brief</button>{editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}</div></form><div className="panel"><h2>Briefs</h2>{rows?.length ? rows.map(row => <div className="finding" key={row.id}><div className="row space"><strong>{row.title}</strong><button onClick={() => setEditing(row)}>Edit</button></div><p className="muted">{row.language} · {row.page_type} · {row.status}</p><p>{row.draft ?? "No draft yet."}</p></div>) : <p className="muted">No content briefs yet.</p>}</div></div></>;
}

export function KeywordsPage({ siteId }: SiteContext) {
  const rows = useQuery(api.workspace.listKeywords, siteId ? { siteId } : "skip") as Keyword[] | undefined;
  const add = useMutation(api.workspace.addKeyword);
  const [error, setError] = useState(""); const [key, setKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!siteId) return; const d = new FormData(event.currentTarget); try { await add({ siteId, term: String(d.get("term")), language: String(d.get("language")), intent: String(d.get("intent") ?? "") }); setKey(k => k + 1); setError(""); } catch (reason) { setError((reason as Error).message); } }
  return <><div className="panel"><h2>Manual keyword ideas</h2><p className="muted">Rankings: Not connected.</p><form key={key} className="form-grid" onSubmit={submit}><label>Keyword<input name="term" required /></label><label>Language<input name="language" defaultValue="fr-BE" required /></label><label>Intent<input name="intent" /></label><button className="primary" disabled={!siteId}>Add keyword</button></form>{error && <p className="error">{error}</p>}</div><div className="panel"><h2>Tracked ideas</h2>{rows?.length ? rows.map(row => <div className="finding" key={row.id}><strong>{row.term}</strong><p className="muted">{row.language} · {row.intent ?? "Intent not set"} · Ranking not connected</p></div>) : <p className="muted">No keywords tracked yet.</p>}</div></>;
}

export function CompetitorsPage({ siteId }: SiteContext) {
  const rows = useQuery(api.workspace.listCompetitors, siteId ? { siteId } : "skip") as Competitor[] | undefined;
  const add = useMutation(api.workspace.addCompetitor);
  const [error, setError] = useState(""); const [key, setKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!siteId) return; const d = new FormData(event.currentTarget); try { await add({ siteId, domain: String(d.get("domain")), notes: String(d.get("notes") ?? "") }); setKey(k => k + 1); setError(""); } catch (reason) { setError((reason as Error).message); } }
  return <><div className="panel"><h2>Curated competitor domains</h2><p className="muted">Competitive metrics: Not connected.</p><form key={key} className="form-grid" onSubmit={submit}><label>Domain<input name="domain" placeholder="example.com" required /></label><label>Notes<input name="notes" /></label><button className="primary" disabled={!siteId}>Add competitor</button></form>{error && <p className="error">{error}</p>}</div><div className="panel"><h2>Domains</h2>{rows?.length ? rows.map(row => <div className="finding" key={row.id}><strong>{row.domain}</strong><p className="muted">{row.notes ?? "No notes"}</p></div>) : <p className="muted">No competitors added yet.</p>}</div></>;
}

export function IntegrationsPage() {
  const integrations = [
    ["Google Search Console", "Create a Google OAuth client, grant read-only Search Console access, then verify a property for this site."],
    ["Google Analytics 4", "Authorize read-only Analytics access and select a verified property."],
    ["Google Business Profile", "Verify business ownership and authorize the relevant profile before reading it."],
    ["Email delivery", "Connect a verified sender domain before enabling verification and password-reset mail."],
    ["Source repository", "Verify write access before proposing or publishing code changes."],
  ];
  return <><p className="muted">Setup steps are shown below. None of these connections is active in the Convex development app.</p>{integrations.map(([name, step]) => <div className="panel" key={name}><div className="row space"><h2>{name}</h2><span className="dev-badge">Not connected</span></div><p>{step}</p></div>)}</>;
}

export function AutomationsPage({ workspaceId, siteId }: SiteContext) {
  const workspace = useQuery(api.workspace.getWorkspace, workspaceId ? { workspaceId } : "skip") as { autopilot_mode: "manual" | "guarded" | "advanced" } | undefined;
  const setMode = useMutation(api.workspace.setMode);
  const schedule = useQuery(api.scheduling.get, siteId ? { siteId } : "skip") as { enabled: boolean; next_run_at: number | null; last_run_at: number | null; last_error: string | null } | null | undefined;
  const setSchedule = useMutation(api.scheduling.set);
  const [error, setError] = useState("");
  return <><div className="panel"><h2>Operating mode</h2><p className="muted">Mode sets policy for future workflows. This development app does not run publishing automations.</p><div className="mode-grid">{(["manual", "guarded", "advanced"] as const).map(mode => <button key={mode} className={workspace?.autopilot_mode === mode ? "selected" : ""} disabled={!workspace} onClick={() => workspaceId && void setMode({ workspaceId, mode }).catch(reason => setError((reason as Error).message))}><strong>{mode}</strong><small>{mode === "manual" ? "Human starts every action" : mode === "guarded" ? "Suggest and request review" : "Higher autonomy after access checks"}</small></button>)}</div>{error && <p className="error">{error}</p>}</div><div className="panel"><h2>Scheduled public audits</h2><p className="muted">Opt in per site for one read only audit every 24 hours. The hourly dispatcher starts due jobs and logs actual results.</p><label className="row"><input style={{ width: "auto", margin: 0 }} type="checkbox" checked={schedule?.enabled ?? false} disabled={!siteId} onChange={e => siteId && void setSchedule({ siteId, enabled: e.target.checked }).catch(reason => setError((reason as Error).message))} />Enable daily public audit</label><p className="muted">Next run: {schedule?.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : "Off"} · Last run: {schedule?.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : "Never"}</p>{schedule?.last_error && <p className="error">Last error: {schedule.last_error}</p>}</div><div className="panel"><h2>Risk gates</h2><table><thead><tr><th>Action</th><th>Review</th><th>Requirement</th></tr></thead><tbody><tr><td>Public audit</td><td>Manual or opt-in schedule</td><td>Public pages, robots rules and rate limit</td></tr><tr><td>Content draft</td><td>Human review</td><td>Verified facts and sources</td></tr><tr><td>Publish code or content</td><td>Approval required</td><td>Verified ownership and write access</td></tr><tr><td>External message</td><td>Approval required</td><td>Connected channel and recipient consent</td></tr></tbody></table></div></>;
}

export function ActivityPage({ workspaceId }: SiteContext) {
  const rows = useQuery(api.workspace.listActivity, workspaceId ? { workspaceId } : "skip") as { id: string; entity: string; action: string; created_at: string }[] | undefined;
  return <div className="panel"><h2>Change history</h2><p className="muted">This history is append only.</p>{rows?.length ? rows.map(row => <div className="finding" key={row.id}><strong>{row.action.replaceAll("_", " ")}</strong><p className="muted">{row.entity} · {new Date(row.created_at).toLocaleString()}</p></div>) : <p className="muted">No events yet.</p>}</div>;
}

export function SettingsPage({ workspaceId }: SiteContext) {
  const workspace = useQuery(api.workspace.getWorkspace, workspaceId ? { workspaceId } : "skip") as { name: string; autopilot_mode: string } | undefined;
  const tokens = useQuery(api.mcpTokens.list, workspaceId ? { workspaceId } : "skip") as { id: Id<"mcp_tokens">; label: string; expires_at: number; revoked_at: string | null }[] | undefined;
  const createToken = useAction(api.mcpTokens.create);
  const revokeToken = useMutation(api.mcpTokens.revoke);
  const [label, setLabel] = useState("My MCP client");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const endpoint = `${String(import.meta.env["VITE_CONVEX_URL"] ?? "").replace(".convex.cloud", ".convex.site")}/mcp`;
  return <><div className="panel"><h2>Workspace</h2><p>{workspace?.name ?? "Loading…"}</p><p className="muted">Autopilot mode: {workspace?.autopilot_mode ?? "—"}</p></div><div className="panel"><h2>MCP / ChatGPT</h2><p>Secure MCP endpoint for API-token clients: <code>{endpoint}</code></p><p className="muted">Eight tools are online for sites, audits, findings, tasks, job status, and review-only fix proposals. Tokens expire after 30 days and can be revoked here. Direct ChatGPT connection still needs OAuth and is not online.</p><div className="row"><input aria-label="Token label" value={label} onChange={e => setLabel(e.target.value)} maxLength={80} /><button disabled={!workspaceId} onClick={() => workspaceId && void createToken({ workspaceId, label }).then(result => { setNewToken(result.token); setError(""); }).catch(reason => setError((reason as Error).message))}>Create MCP token</button></div>{newToken && <div className="notice"><strong>Copy this token now. It will not be shown again.</strong><p><code style={{ overflowWrap: "anywhere" }}>{newToken}</code></p><button onClick={() => void navigator.clipboard.writeText(newToken).catch(reason => setError((reason as Error).message))}>Copy token</button><button onClick={() => setNewToken(null)}>Done</button></div>}{error && <p className="error">{error}</p>}<h3>Issued tokens</h3>{tokens?.length ? tokens.map(token => <div className="row space finding" key={token.id}><span>{token.label} · {token.revoked_at ? "Revoked" : Date.now() > token.expires_at ? "Expired" : `Expires ${new Date(token.expires_at).toLocaleDateString()}`}</span>{!token.revoked_at && <button onClick={() => void revokeToken({ tokenId: token.id }).catch(reason => setError((reason as Error).message))}>Revoke</button>}</div>) : <p className="muted">No MCP tokens.</p>}</div><div className="panel"><h2>Development authentication</h2><p>Email and password are available for dev accounts. Email verification, password reset, and Google sign in are not configured on Convex yet.</p></div></>;
}
