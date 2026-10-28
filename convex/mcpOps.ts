import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const listSites = internalQuery({
  args: { workspaceId: v.id("workspaces") }, returns: v.array(v.any()),
  handler: async (ctx, { workspaceId }) => {
    const rows = await ctx.db.query("sites").withIndex("by_workspace_id", q => q.eq("workspace_id", workspaceId)).take(100);
    return rows.map(row => ({ id: row._id, domain: row.domain, display_name: row.display_name, ownership_verified: row.ownership_verified, languages: row.languages, regions: row.regions }));
  },
});

export const getSite = internalQuery({
  args: { workspaceId: v.id("workspaces"), siteId: v.id("sites") }, returns: v.any(),
  handler: async (ctx, { workspaceId, siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site || site.workspace_id !== workspaceId) throw new Error("Site not found");
    return { id: site._id, domain: site.domain, display_name: site.display_name, business_facts: site.business_facts, regions: site.regions, languages: site.languages, service_radius_km: site.service_radius_km, ownership_verified: site.ownership_verified, write_access_verified: site.write_access_verified };
  },
});

export const listFindings = internalQuery({
  args: { workspaceId: v.id("workspaces"), siteId: v.id("sites") }, returns: v.array(v.any()),
  handler: async (ctx, { workspaceId, siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site || site.workspace_id !== workspaceId) throw new Error("Site not found");
    const rows = await ctx.db.query("findings").withIndex("by_site_id", q => q.eq("site_id", siteId)).order("desc").take(100);
    return rows.map(row => ({ id: row._id, audit_id: row.audit_id, code: row.code, title: row.title, severity: row.severity, confidence: row.confidence, url: row.url, recommendation: row.recommendation, detail: row.detail, observed_at: row.created_at }));
  },
});

export const listTasks = internalQuery({
  args: { workspaceId: v.id("workspaces") }, returns: v.array(v.any()),
  handler: async (ctx, { workspaceId }) => {
    const rows = await ctx.db.query("tasks").withIndex("by_workspace_id", q => q.eq("workspace_id", workspaceId)).order("desc").take(100);
    return rows.map(row => ({ id: row._id, opportunity_id: row.opportunity_id ?? null, title: row.title, status: row.status, assignee: row.assignee, due_date: row.due_date }));
  },
});

export const getJobStatus = internalQuery({
  args: { workspaceId: v.id("workspaces"), jobId: v.id("job_runs") }, returns: v.any(),
  handler: async (ctx, { workspaceId, jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.workspace_id !== workspaceId) throw new Error("Job not found");
    return { id: job._id, site_id: job.site_id ?? null, kind: job.kind, status: job.status, trigger: job.trigger, started_at: job.started_at, finished_at: job.finished_at, error: job.error, ref_id: job.ref_id };
  },
});

export const proposeFix = internalMutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users"), siteId: v.id("sites"), title: v.string(), proposedChange: v.string(), testPlan: v.string(), rollbackPlan: v.string(), risk: v.union(v.literal("low"), v.literal("medium"), v.literal("high")) },
  returns: v.id("change_requests"),
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.workspace_id !== args.workspaceId) throw new Error("Site not found");
    if (!args.title.trim() || !args.proposedChange.trim() || !args.testPlan.trim() || !args.rollbackPlan.trim()) throw new Error("Title, change, test and rollback plan required");
    const id = await ctx.db.insert("change_requests", { workspace_id: args.workspaceId, site_id: args.siteId, title: args.title.trim(), proposed_change: args.proposedChange.trim(), test_plan: args.testPlan.trim(), rollback_plan: args.rollbackPlan.trim(), risk: args.risk, status: "proposed", requires_consent: true, created_by: args.userId, created_at: new Date().toISOString() });
    await ctx.db.insert("change_events", { workspace_id: args.workspaceId, entity: "change_request", entity_id: id, action: "fix_proposed", detail: { risk: args.risk }, actor: args.userId, created_at: new Date().toISOString() });
    return id;
  },
});

export const updateTaskStatus = internalMutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users"), taskId: v.id("tasks"), status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done"), v.literal("blocked")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task || task.workspace_id !== args.workspaceId) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { status: args.status });
    await ctx.db.insert("change_events", { workspace_id: args.workspaceId, entity: "task", entity_id: args.taskId, action: `task_${args.status}`, detail: { source: "mcp" }, actor: args.userId, created_at: new Date().toISOString() });
    return null;
  },
});
