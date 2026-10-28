import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { decryptToken, randomUrlToken, sha256Url } from "./gscCrypto";

const redirectUri = "https://colorless-toad-83.convex.site/gsc/callback";
const scope = "https://www.googleapis.com/auth/webmasters.readonly";

export const begin = action({
  args: { siteId: v.id("sites") },
  returns: v.string(),
  handler: async (ctx, { siteId }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    await ctx.runQuery(internal.gscInternal.authorizeSite, { siteId, userId });
    const clientId = process.env["AUTH_GOOGLE_ID"];
    if (!clientId || !process.env["AUTH_GOOGLE_SECRET"] || !process.env["GSC_TOKEN_KEY"])
      throw new Error("Search Console OAuth is not configured");
    const state = randomUrlToken();
    const verifier = randomUrlToken(48);
    await ctx.runMutation(internal.gscInternal.begin, {
      siteId, userId, stateHash: await sha256Url(state), verifier, expiresAt: Date.now() + 10 * 60_000,
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", await sha256Url(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },
});

export const status = query({
  args: { siteId: v.id("sites") },
  returns: v.object({
    connected: v.boolean(), property: v.union(v.string(), v.null()), permission: v.union(v.string(), v.null()),
    verifiedAt: v.union(v.string(), v.null()), periodStart: v.union(v.string(), v.null()),
    periodEnd: v.union(v.string(), v.null()), capturedAt: v.union(v.string(), v.null()),
    clicks: v.union(v.number(), v.null()), impressions: v.union(v.number(), v.null()),
    position: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { siteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    const membership = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", site.workspace_id).eq("user_id", userId)).unique();
    if (!membership) throw new Error("Access denied");
    const connection = await ctx.db.query("gsc_connections").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    const empty = { connected: false, property: null, permission: null, verifiedAt: null, periodStart: null, periodEnd: null, capturedAt: null, clicks: null, impressions: null, position: null };
    if (!connection) return empty;
    const snapshots = await ctx.db.query("metrics_snapshots").withIndex("by_site_id_and_source", q => q.eq("site_id", siteId).eq("source", "google_search_console")).order("desc").take(3);
    const latest = snapshots[0];
    const values = new Map(snapshots.filter(row => row.captured_at === latest?.captured_at && row.captured_at >= connection.verified_at).map(row => [row.metric, row.value]));
    return {
      connected: true, property: connection.property, permission: connection.permission, verifiedAt: connection.verified_at,
      periodStart: values.size ? latest?.period_start ?? null : null, periodEnd: values.size ? latest?.period_end ?? null : null,
      capturedAt: values.size ? latest?.captured_at ?? null : null, clicks: values.get("clicks") ?? null,
      impressions: values.get("impressions") ?? null, position: values.get("position") ?? null,
    };
  },
});

export const refresh = action({
  args: { siteId: v.id("sites") },
  returns: v.object({ clicks: v.number(), impressions: v.number(), position: v.union(v.number(), v.null()), capturedAt: v.string() }),
  handler: async (ctx, { siteId }): Promise<{ clicks: number; impressions: number; position: number | null; capturedAt: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const connection = await ctx.runQuery(internal.gscInternal.getConnection, { siteId, userId });
    if (!connection) throw new Error("Search Console is not connected");
    const clientId = process.env["AUTH_GOOGLE_ID"];
    const clientSecret = process.env["AUTH_GOOGLE_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
    const refreshToken = await decryptToken(connection.ciphertext, connection.iv);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!tokenResponse.ok) throw new Error("Google authorization expired. Reconnect Search Console.");
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Google did not return an access token");
    const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(connection.property)}/searchAnalytics/query`, {
      method: "POST", headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end, rowLimit: 1 }), signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Search Console request failed (${response.status}). Check property access and API status.`);
    const data = await response.json() as { rows?: { clicks?: number; impressions?: number; position?: number }[] };
    const first = data.rows?.[0];
    const clicks = first?.clicks ?? 0;
    const impressions = first?.impressions ?? 0;
    const position = first?.position ?? null;
    if (!Number.isFinite(clicks) || !Number.isFinite(impressions) || (position !== null && !Number.isFinite(position)))
      throw new Error("Search Console returned invalid metrics");
    const capturedAt: string = await ctx.runMutation(internal.gscInternal.saveMetrics, { siteId, userId, start, end, clicks, impressions, position });
    return { clicks, impressions, position, capturedAt };
  },
});

export const disconnect = action({
  args: { siteId: v.id("sites") },
  returns: v.null(),
  handler: async (ctx, { siteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    await ctx.runQuery(internal.gscInternal.authorizeSite, { siteId, userId });
    await ctx.runMutation(internal.gscInternal.remove, { siteId, userId });
    return null;
  },
});
