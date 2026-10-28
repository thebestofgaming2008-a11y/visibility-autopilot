import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashToken } from "./mcpTokens";

type Actor = { workspaceId: Id<"workspaces">; userId: Id<"users"> };
const jsonContent = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });

function serverFor(ctx: ActionCtx, actor: Actor) {
  const server = new McpServer({ name: "omni-visibility-autopilot", version: "0.1.0" });
  const siteId = z.string().min(1);

  server.registerTool("list_sites", { description: "List sites in the token's workspace.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () =>
    jsonContent(await ctx.runQuery(internal.mcpOps.listSites, { workspaceId: actor.workspaceId })));
  server.registerTool("get_site", { description: "Get one site and its verified business configuration.", inputSchema: z.object({ site_id: siteId }), annotations: { readOnlyHint: true } }, async ({ site_id }) =>
    jsonContent(await ctx.runQuery(internal.mcpOps.getSite, { workspaceId: actor.workspaceId, siteId: site_id as Id<"sites"> })));
  server.registerTool("list_findings", { description: "List recent public audit findings and their source URLs.", inputSchema: z.object({ site_id: siteId }), annotations: { readOnlyHint: true } }, async ({ site_id }) =>
    jsonContent(await ctx.runQuery(internal.mcpOps.listFindings, { workspaceId: actor.workspaceId, siteId: site_id as Id<"sites"> })));
  server.registerTool("list_tasks", { description: "List tasks in the token's workspace.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () =>
    jsonContent(await ctx.runQuery(internal.mcpOps.listTasks, { workspaceId: actor.workspaceId })));
  server.registerTool("get_job_status", { description: "Get the real status and timestamps of one job.", inputSchema: z.object({ job_id: z.string().min(1) }), annotations: { readOnlyHint: true } }, async ({ job_id }) =>
    jsonContent(await ctx.runQuery(internal.mcpOps.getJobStatus, { workspaceId: actor.workspaceId, jobId: job_id as Id<"job_runs"> })));
  server.registerTool("run_public_audit", { description: "Start a rate-limited, read-only public audit of a workspace site.", inputSchema: z.object({ site_id: siteId }), annotations: { readOnlyHint: false, destructiveHint: false } }, async ({ site_id }) =>
    jsonContent(await ctx.runAction(internal.publicAudit.runForMcp, { siteId: site_id as Id<"sites">, workspaceId: actor.workspaceId, userId: actor.userId })));
  server.registerTool("propose_fix", { description: "Save a proposed change for human review. Does not publish or alter a site.", inputSchema: z.object({ site_id: siteId, title: z.string().min(1).max(200), proposed_change: z.string().min(1).max(10000), test_plan: z.string().min(1).max(5000), rollback_plan: z.string().min(1).max(5000), risk: z.enum(["low", "medium", "high"]) }), annotations: { destructiveHint: false } }, async (args) =>
    jsonContent({ proposal_id: await ctx.runMutation(internal.mcpOps.proposeFix, { workspaceId: actor.workspaceId, userId: actor.userId, siteId: args.site_id as Id<"sites">, title: args.title, proposedChange: args.proposed_change, testPlan: args.test_plan, rollbackPlan: args.rollback_plan, risk: args.risk }) }));
  server.registerTool("update_task_status", { description: "Update an existing task's workflow status; records the change in activity history.", inputSchema: z.object({ task_id: z.string().min(1), status: z.enum(["todo", "doing", "done", "blocked"]) }), annotations: { destructiveHint: false } }, async ({ task_id, status }) => {
    await ctx.runMutation(internal.mcpOps.updateTaskStatus, { workspaceId: actor.workspaceId, userId: actor.userId, taskId: task_id as Id<"tasks">, status });
    return jsonContent({ updated: true });
  });
  return server;
}

export const handleMcp = httpAction(async (ctx, request) => {
  const expectedHost = process.env["CONVEX_SITE_URL"] ? new URL(process.env["CONVEX_SITE_URL"]).host : "";
  if (!expectedHost || new URL(request.url).host !== expectedHost) return new Response("Invalid host", { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== process.env["SITE_URL"]) return new Response("Invalid origin", { status: 403 });
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (ova_[0-9a-f]{64})$/.exec(header);
  if (!match) return new Response("Bearer token required", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="OmniVisibility MCP"' } });
  const tokenHash = await hashToken(match[1]!);
  const actor = await ctx.runQuery(internal.mcpTokens.authenticate, { tokenHash, now: Date.now() });
  if (!actor) return new Response("Token invalid or expired", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="OmniVisibility MCP", error="invalid_token"' } });
  const handler = createMcpHandler(() => serverFor(ctx, actor), { responseMode: "json", maxRequestBodySize: 65_536 });
  const response = await handler.fetch(request);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
});
