import { randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);
const session = await client.action(api.auth.signIn, { provider: "password", params: { email: `omni-mcp-${Date.now()}@example.com`, password: randomBytes(24).toString("base64url"), flow: "signUp" } });
if (!session.tokens?.token) throw new Error("Dev account not created");
client.setAuth(session.tokens.token);
const workspaceId = await client.mutation(api.workspace.bootstrap, {});
const [site] = await client.query(api.workspace.listSites, {});
if (!site) throw new Error("Seed site missing");
const minted = await client.action(api.mcpTokens.create, { workspaceId, label: "Automated smoke test" });
const endpoint = process.env.VITE_CONVEX_SITE_URL + "/mcp";

async function send(method, params, bearer = minted.token) {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2026-07-28", "mcp-method": method, ...(method === "tools/call" ? { "mcp-name": params.name } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {}, "io.modelcontextprotocol/clientInfo": { name: "smoke-test", version: "1.0.0" } } } }) });
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* response may be an error page */ }
  return { status: response.status, json, body: body.slice(0, 300) };
}

const unauthenticated = await send("tools/list", {}, "");
if (unauthenticated.status !== 401) throw new Error("MCP allowed anonymous tools/list");
const discover = await send("server/discover", {});
if (discover.status !== 200 || discover.json?.error) throw new Error(`MCP discovery failed: ${JSON.stringify(discover)}`);
const tools = await send("tools/list", {});
if (tools.status !== 200 || !tools.json?.result?.tools?.some(t => t.name === "list_sites")) throw new Error(`MCP tools/list failed: ${JSON.stringify(tools)}`);
const listed = await send("tools/call", { name: "list_sites", arguments: {} });
if (listed.status !== 200 || !JSON.stringify(listed.json).includes("yabilocation.com")) throw new Error(`MCP list_sites failed: ${JSON.stringify(listed)}`);
const audited = await send("tools/call", { name: "run_public_audit", arguments: { site_id: site.id } });
if (audited.status !== 200 || audited.json?.result?.isError || !JSON.stringify(audited.json).includes("completed")) throw new Error(`MCP audit failed: ${JSON.stringify(audited)}`);
const [job] = await client.query(api.workspace.listJobs, { siteId: site.id });
const jobStatus = await send("tools/call", { name: "get_job_status", arguments: { job_id: job.id } });
if (jobStatus.status !== 200 || !JSON.stringify(jobStatus.json).includes("succeeded")) throw new Error(`MCP job status failed: ${JSON.stringify(jobStatus)}`);
const proposal = await send("tools/call", { name: "propose_fix", arguments: { site_id: site.id, title: "Smoke test proposal", proposed_change: "Test only, do not publish", test_plan: "Verify no public change", rollback_plan: "Dismiss proposal", risk: "low" } });
if (proposal.status !== 200 || proposal.json?.result?.isError) throw new Error(`MCP propose_fix failed: ${JSON.stringify(proposal)}`);
const outsider = new ConvexHttpClient(process.env.VITE_CONVEX_URL);
const outsiderSession = await outsider.action(api.auth.signIn, { provider: "password", params: { email: `omni-mcp-outsider-${Date.now()}@example.com`, password: randomBytes(24).toString("base64url"), flow: "signUp" } });
if (!outsiderSession.tokens?.token) throw new Error("Outsider account not created");
outsider.setAuth(outsiderSession.tokens.token);
const outsiderWorkspace = await outsider.mutation(api.workspace.bootstrap, {});
const outsiderToken = await outsider.action(api.mcpTokens.create, { workspaceId: outsiderWorkspace, label: "Isolation test" });
const crossTenant = await send("tools/call", { name: "get_site", arguments: { site_id: site.id } }, outsiderToken.token);
if (crossTenant.status !== 200 || !crossTenant.json?.result?.isError) throw new Error("MCP exposed a site from another workspace");
await outsider.mutation(api.mcpTokens.revoke, { tokenId: outsiderToken.id });
await client.mutation(api.mcpTokens.revoke, { tokenId: minted.id });
const revoked = await send("tools/list", {});
if (revoked.status !== 401) throw new Error("Revoked MCP token still valid");
console.log(JSON.stringify({ anonymousDenied: true, discovery: true, toolCount: tools.json.result.tools.length, siteRead: true, auditCompleted: true, jobRead: true, proposalSaved: true, crossTenantDenied: true, revokedDenied: true }));
