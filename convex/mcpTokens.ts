import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}

export const create = action({
  args: { workspaceId: v.id("workspaces"), label: v.string() },
  returns: v.object({ token: v.string(), id: v.id("mcp_tokens"), expiresAt: v.number() }),
  handler: async (ctx, { workspaceId, label }): Promise<{ token: string; id: Id<"mcp_tokens">; expiresAt: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = `ova_${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
    const minted: { id: Id<"mcp_tokens">; expiresAt: number } = await ctx.runMutation(internal.mcpTokens.mint, { workspaceId, userId, label, tokenHash: await hashToken(token) });
    return { token, id: minted.id, expiresAt: minted.expiresAt };
  },
});

export const mint = internalMutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users"), label: v.string(), tokenHash: v.string() },
  returns: v.object({ id: v.id("mcp_tokens"), expiresAt: v.number() }),
  handler: async (ctx, { workspaceId, userId, label, tokenHash }) => {
    const member = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", workspaceId).eq("user_id", userId)).unique();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Owner or admin required");
    if (!label.trim() || label.length > 80) throw new Error("Label required (80 characters max)");
    const issued = await ctx.db.query("mcp_tokens").withIndex("by_workspace_id", q => q.eq("workspace_id", workspaceId)).order("desc").take(50);
    if (issued.filter(row => !row.revoked_at && row.expires_at > Date.now()).length >= 10) throw new Error("Revoke an active token before creating another");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const id = await ctx.db.insert("mcp_tokens", { workspace_id: workspaceId, user_id: userId, token_hash: tokenHash, label: label.trim(), created_at: new Date().toISOString(), expires_at: expiresAt, revoked_at: null });
    await ctx.db.insert("change_events", { workspace_id: workspaceId, entity: "mcp_token", entity_id: id, action: "token_created", detail: { label: label.trim() }, actor: userId, created_at: new Date().toISOString() });
    return { id, expiresAt };
  },
});

export const list = query({
  args: { workspaceId: v.id("workspaces") }, returns: v.array(v.object({ id: v.id("mcp_tokens"), label: v.string(), created_at: v.string(), expires_at: v.number(), revoked_at: v.union(v.string(), v.null()) })),
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const member = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", workspaceId).eq("user_id", userId)).unique();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Owner or admin required");
    const rows = await ctx.db.query("mcp_tokens").withIndex("by_workspace_id", q => q.eq("workspace_id", workspaceId)).order("desc").take(100);
    return rows.map(row => ({ id: row._id, label: row.label, created_at: row.created_at, expires_at: row.expires_at, revoked_at: row.revoked_at ?? null }));
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("mcp_tokens") }, returns: v.null(),
  handler: async (ctx, { tokenId }) => {
    const userId = await getAuthUserId(ctx);
    const token = await ctx.db.get(tokenId);
    if (!userId || !token) throw new Error("Token not found");
    const member = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", token.workspace_id).eq("user_id", userId)).unique();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Owner or admin required");
    if (!token.revoked_at) await ctx.db.patch(tokenId, { revoked_at: new Date().toISOString() });
    await ctx.db.insert("change_events", { workspace_id: token.workspace_id, entity: "mcp_token", entity_id: tokenId, action: "token_revoked", detail: {}, actor: userId, created_at: new Date().toISOString() });
    return null;
  },
});

export const authenticate = internalQuery({
  args: { tokenHash: v.string(), now: v.number() },
  returns: v.union(v.object({ workspaceId: v.id("workspaces"), userId: v.id("users") }), v.null()),
  handler: async (ctx, { tokenHash, now }) => {
    const token = await ctx.db.query("mcp_tokens").withIndex("by_token_hash", q => q.eq("token_hash", tokenHash)).unique();
    if (!token || token.revoked_at || token.expires_at <= now) return null;
    const member = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", token.workspace_id).eq("user_id", token.user_id)).unique();
    if (!member || !["owner", "admin", "editor"].includes(member.role)) return null;
    return { workspaceId: token.workspace_id, userId: token.user_id };
  },
});
