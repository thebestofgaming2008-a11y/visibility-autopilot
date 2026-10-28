import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);
const session = await client.action(api.auth.signIn, {
  provider: "password",
  params: {
    email: `omni-schedule-${Date.now()}@example.com`,
    password: randomBytes(24).toString("base64url"),
    flow: "signUp",
  },
});
if (!session.tokens?.token) throw new Error("Dev account not created");
client.setAuth(session.tokens.token);
await client.mutation(api.workspace.bootstrap, {});
const [site] = await client.query(api.workspace.listSites, {});
if (!site) throw new Error("Seed site missing");
await client.mutation(api.scheduling.set, { siteId: site.id, enabled: true });
const cli = spawnSync(process.execPath, ["node_modules/convex/bin/main.js", "run", "publicAudit:runScheduled", JSON.stringify({ siteId: site.id })], { encoding: "utf8", cwd: process.cwd(), timeout: 60_000 });
if (cli.status !== 0) throw new Error(`Scheduled action failed: ${cli.stderr || cli.stdout}`);
const audits = await client.query(api.workspace.listAudits, { siteId: site.id });
const jobs = await client.query(api.workspace.listJobs, { siteId: site.id });
const schedule = await client.query(api.scheduling.get, { siteId: site.id });
await client.mutation(api.scheduling.set, { siteId: site.id, enabled: false });
if (audits[0]?.status !== "completed" || jobs[0]?.trigger !== "scheduled" || !schedule?.last_run_at)
  throw new Error("Scheduled audit did not finish and persist");
console.log(JSON.stringify({ scheduledAudit: audits[0].status, trigger: jobs[0].trigger, lastRunSaved: true }));
