import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const intervalMs = 24 * 60 * 60 * 1000;

export const get = query({
  args: { siteId: v.id("sites") },
  returns: v.union(v.object({ enabled: v.boolean(), interval_hours: v.number(), next_run_at: v.union(v.number(), v.null()), last_run_at: v.union(v.number(), v.null()), last_error: v.union(v.string(), v.null()) }), v.null()),
  handler: async (ctx, { siteId }) => {
    const userId = await getAuthUserId(ctx);
    const site = await ctx.db.get(siteId);
    if (!userId || !site) throw new Error("Access denied");
    const member = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", site.workspace_id).eq("user_id", userId)).unique();
    if (!member) throw new Error("Access denied");
    const schedule = await ctx.db.query("audit_schedules").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    return schedule ? { enabled: schedule.enabled, interval_hours: schedule.interval_hours, next_run_at: schedule.next_run_at, last_run_at: schedule.last_run_at, last_error: schedule.last_error } : null;
  },
});

export const set = mutation({
  args: { siteId: v.id("sites"), enabled: v.boolean() }, returns: v.null(),
  handler: async (ctx, { siteId, enabled }) => {
    const userId = await getAuthUserId(ctx);
    const site = await ctx.db.get(siteId);
    if (!userId || !site) throw new Error("Access denied");
    const member = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", site.workspace_id).eq("user_id", userId)).unique();
    if (!member || member.role === "viewer") throw new Error("Edit access required");
    const prior = await ctx.db.query("audit_schedules").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    const next = enabled ? Date.now() + intervalMs : null;
    if (prior) await ctx.db.patch(prior._id, { enabled, next_run_at: next, last_error: null, updated_at: new Date().toISOString() });
    else await ctx.db.insert("audit_schedules", { workspace_id: site.workspace_id, site_id: siteId, enabled, interval_hours: 24, next_run_at: next, last_run_at: null, last_error: null, updated_at: new Date().toISOString() });
    await ctx.db.insert("change_events", { workspace_id: site.workspace_id, entity: "audit_schedule", entity_id: siteId, action: enabled ? "schedule_enabled" : "schedule_disabled", detail: { interval_hours: 24 }, actor: userId, created_at: new Date().toISOString() });
    return null;
  },
});

export const dispatch = internalMutation({
  args: {}, returns: v.number(),
  handler: async (ctx) => {
    const due = await ctx.db.query("audit_schedules").withIndex("by_enabled_and_next_run_at", q => q.eq("enabled", true).lt("next_run_at", Date.now() + 1)).take(20);
    for (const schedule of due) {
      await ctx.db.patch(schedule._id, { next_run_at: Date.now() + intervalMs, updated_at: new Date().toISOString() });
      await ctx.scheduler.runAfter(0, internal.publicAudit.runScheduled, { siteId: schedule.site_id });
    }
    return due.length;
  },
});

export const record = internalMutation({
  args: { siteId: v.id("sites"), error: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, { siteId, error }) => {
    const schedule = await ctx.db.query("audit_schedules").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    if (schedule) await ctx.db.patch(schedule._id, { last_run_at: Date.now(), last_error: error, updated_at: new Date().toISOString() });
    return null;
  },
});
