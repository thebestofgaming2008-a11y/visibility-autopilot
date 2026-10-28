import { randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.VITE_CONVEX_URL;
if (!url) throw new Error("VITE_CONVEX_URL missing");
const client = new ConvexHttpClient(url);
const email = `omni-smoke-${Date.now()}@example.com`;
const password = randomBytes(24).toString("base64url");
const session = await client.action(api.auth.signIn, {
  provider: "password",
  params: { email, password, flow: "signUp" },
});
if (!session.tokens?.token) throw new Error("Sign-up did not return a session");
client.setAuth(session.tokens.token);
const workspaceId = await client.mutation(api.workspace.bootstrap, {});
const sites = await client.query(api.workspace.listSites, {});
const site = sites.find((row) => row.domain === "yabilocation.com");
if (!site || site.workspace_id !== workspaceId || site.ownership_verified)
  throw new Error("Yabi seed or workspace ownership incorrect");
await client.mutation(api.workspace.addKeyword, { siteId: site.id, term: "monthly van rental", language: "en", intent: "commercial" });
await client.mutation(api.workspace.addCompetitor, { siteId: site.id, domain: "example.com", notes: "Synthetic test domain" });
await client.mutation(api.workspace.saveContent, { siteId: site.id, title: "Smoke test brief", language: "en", pageType: "service", targetQuery: "monthly van rental", searchIntent: "commercial", draft: "Test only", sourceUrl: "" });
await client.mutation(api.workspace.setMode, { workspaceId, mode: "manual" });
const [keywords, competitors, briefs, activity, workspace] = await Promise.all([
  client.query(api.workspace.listKeywords, { siteId: site.id }),
  client.query(api.workspace.listCompetitors, { siteId: site.id }),
  client.query(api.workspace.listContent, { siteId: site.id }),
  client.query(api.workspace.listActivity, { workspaceId }),
  client.query(api.workspace.getWorkspace, { workspaceId }),
]);
if (!keywords.length || !competitors.length || !briefs.length || activity.length < 4 || workspace?.autopilot_mode !== "manual")
  throw new Error("Convex content, research, mode, or activity flow failed");
await client.mutation(api.scheduling.set, { siteId: site.id, enabled: true });
const schedule = await client.query(api.scheduling.get, { siteId: site.id });
if (!schedule?.enabled || !schedule.next_run_at || schedule.interval_hours !== 24)
  throw new Error("Scheduled audit did not persist");
await client.mutation(api.scheduling.set, { siteId: site.id, enabled: false });
const audit = await client.action(api.publicAudit.run, { siteId: site.id });
const audits = await client.query(api.workspace.listAudits, { siteId: site.id });
const pages = await client.query(api.workspace.listAuditPages, { auditId: audit.auditId });
if (!audits.some((row) => row.id === audit.auditId) || pages.length < 2)
  throw new Error("Audit was not persisted with fetched page evidence");
if (audit.status !== "completed")
  throw new Error(`Public audit failed: ${JSON.stringify({ summary: audit.summary, errors: pages.map(page => ({ kind: page.kind, error: page.error })) })}`);
const outsider = new ConvexHttpClient(url);
const outsiderSession = await outsider.action(api.auth.signIn, { provider: "password", params: { email: `omni-outsider-${Date.now()}@example.com`, password: randomBytes(24).toString("base64url"), flow: "signUp" } });
if (!outsiderSession.tokens?.token) throw new Error("Second account creation failed");
outsider.setAuth(outsiderSession.tokens.token);
await outsider.mutation(api.workspace.bootstrap, {});
if ((await outsider.query(api.workspace.listSites, {})).some(row => row.id === site.id)) throw new Error("Cross-workspace site leaked");
let denied = false;
try { await outsider.query(api.workspace.listAudits, { siteId: site.id }); } catch { denied = true; }
if (!denied) throw new Error("Cross-workspace audit access allowed");
denied = false;
try { await outsider.query(api.gsc.status, { siteId: site.id }); } catch { denied = true; }
if (!denied) throw new Error("Cross-workspace Search Console status access allowed");
denied = false;
try { await outsider.query(api.ga4.status, { siteId: site.id }); } catch { denied = true; }
if (!denied) throw new Error("Cross-workspace Analytics status access allowed");
denied = false;
try { await outsider.action(api.gsc.begin, { siteId: site.id }); } catch { denied = true; }
if (!denied) throw new Error("Cross-workspace Search Console authorization allowed");
denied = false;
try { await outsider.action(api.ga4.begin, { siteId: site.id }); } catch { denied = true; }
if (!denied) throw new Error("Cross-workspace Analytics authorization allowed");
console.log(JSON.stringify({ signUp: "ok", workspace: "ok", site: site.domain, content: "ok", keywords: "ok", competitors: "ok", activity: "ok", isolation: "ok", scheduling: "ok", audit: audit.status, pages: pages.length, summary: audit.summary }, null, 2));
