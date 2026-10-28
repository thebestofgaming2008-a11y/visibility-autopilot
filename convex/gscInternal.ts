import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function siteAccess(ctx: QueryCtx | MutationCtx, siteId: Id<"sites">, userId: Id<"users">, edit: boolean) {
  const site = await ctx.db.get(siteId);
  if (!site) throw new Error("Site not found");
  const membership = await ctx.db.query("memberships")
    .withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", site.workspace_id).eq("user_id", userId)).unique();
  if (!membership || (edit && membership.role === "viewer")) throw new Error("Access denied");
  return site;
}

export const authorizeSite = internalQuery({
  args: { siteId: v.id("sites"), userId: v.id("users") },
  handler: async (ctx, { siteId, userId }) => {
    const site = await siteAccess(ctx, siteId, userId, true);
    return { domain: site.domain };
  },
});

export const begin = internalMutation({
  args: { siteId: v.id("sites"), userId: v.id("users"), stateHash: v.string(), verifier: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    await siteAccess(ctx, args.siteId, args.userId, true);
    await ctx.db.insert("gsc_oauth_states", {
      site_id: args.siteId, user_id: args.userId, state_hash: args.stateHash,
      verifier: args.verifier, expires_at: args.expiresAt,
    });
  },
});

export const consume = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, { stateHash }) => {
    const state = await ctx.db.query("gsc_oauth_states").withIndex("by_state_hash", q => q.eq("state_hash", stateHash)).unique();
    if (!state) throw new Error("Invalid or already used authorization state");
    await ctx.db.delete(state._id);
    if (state.expires_at < Date.now()) throw new Error("Authorization expired; reconnect Search Console");
    const site = await siteAccess(ctx, state.site_id, state.user_id, true);
    return { siteId: state.site_id, userId: state.user_id, workspaceId: site.workspace_id, domain: site.domain, verifier: state.verifier };
  },
});

export const finish = internalMutation({
  args: {
    siteId: v.id("sites"), userId: v.id("users"), property: v.string(), permission: v.string(),
    ciphertext: v.string(), iv: v.string(),
  },
  handler: async (ctx, args) => {
    const site = await siteAccess(ctx, args.siteId, args.userId, true);
    const timestamp = new Date().toISOString();
    const old = await ctx.db.query("gsc_connections").withIndex("by_site_id", q => q.eq("site_id", args.siteId)).unique();
    const values = {
      workspace_id: site.workspace_id, site_id: args.siteId, granted_by: args.userId,
      property: args.property, permission: args.permission, refresh_token_ciphertext: args.ciphertext,
      refresh_token_iv: args.iv, verified_at: timestamp, updated_at: timestamp,
    };
    if (old) await ctx.db.patch(old._id, values);
    else await ctx.db.insert("gsc_connections", values);
    const connection = (await ctx.db.query("integration_connections").withIndex("by_site_id", q => q.eq("site_id", args.siteId)).collect())
      .find(row => row.provider === "google_search_console");
    if (connection) await ctx.db.patch(connection._id, { status: "connected", verified_at: timestamp, notes: `Read only: ${args.property}` });
    else await ctx.db.insert("integration_connections", { workspace_id: site.workspace_id, site_id: args.siteId, provider: "google_search_console", status: "connected", verified_at: timestamp, notes: `Read only: ${args.property}`, created_at: timestamp });
    if (args.permission === "siteOwner" && !site.ownership_verified) await ctx.db.patch(site._id, { ownership_verified: true, updated_at: timestamp });
    await ctx.db.insert("change_events", { workspace_id: site.workspace_id, entity: "integration_connection", entity_id: args.siteId, action: "gsc_connected", detail: { property: args.property, permission: args.permission }, actor: args.userId, created_at: timestamp });
  },
});

export const getConnection = internalQuery({
  args: { siteId: v.id("sites"), userId: v.id("users") },
  handler: async (ctx, { siteId, userId }) => {
    await siteAccess(ctx, siteId, userId, false);
    const row = await ctx.db.query("gsc_connections").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    return row ? { ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv, property: row.property } : null;
  },
});

export const saveMetrics = internalMutation({
  args: {
    siteId: v.id("sites"), userId: v.id("users"), start: v.string(), end: v.string(),
    clicks: v.number(), impressions: v.number(), position: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const site = await siteAccess(ctx, args.siteId, args.userId, false);
    const capturedAt = new Date().toISOString();
    for (const [metric, value] of Object.entries({ clicks: args.clicks, impressions: args.impressions, position: args.position }))
      await ctx.db.insert("metrics_snapshots", {
        workspace_id: site.workspace_id, site_id: args.siteId, source: "google_search_console", metric,
        value, period_start: args.start, period_end: args.end, captured_at: capturedAt,
      });
    return capturedAt;
  },
});

export const remove = internalMutation({
  args: { siteId: v.id("sites"), userId: v.id("users") },
  handler: async (ctx, { siteId, userId }) => {
    const site = await siteAccess(ctx, siteId, userId, true);
    const old = await ctx.db.query("gsc_connections").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    if (old) await ctx.db.delete(old._id);
    const records = await ctx.db.query("integration_connections").withIndex("by_site_id", q => q.eq("site_id", siteId)).collect();
    for (const row of records) if (row.provider === "google_search_console") await ctx.db.patch(row._id, { status: "disconnected", verified_at: null, notes: null });
    if (old?.permission === "siteOwner" && site.ownership_verified)
      await ctx.db.patch(site._id, { ownership_verified: false, updated_at: new Date().toISOString() });
    await ctx.db.insert("change_events", { workspace_id: site.workspace_id, entity: "integration_connection", entity_id: siteId, action: "gsc_disconnected", detail: {}, actor: userId, created_at: new Date().toISOString() });
  },
});
