import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { decryptToken, randomUrlToken, sha256Url } from "./gscCrypto";

const redirectUri = "https://colorless-toad-83.convex.site/ga4/callback";
const scope = "https://www.googleapis.com/auth/analytics.readonly";

export const begin = action({
  args: { siteId: v.id("sites") },
  returns: v.string(),
  handler: async (ctx, { siteId }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    await ctx.runQuery(internal.ga4Internal.authorizeSite, { siteId, userId });
    const clientId = process.env["AUTH_GOOGLE_ID"];
    if (!clientId || !process.env["AUTH_GOOGLE_SECRET"] || !process.env["GSC_TOKEN_KEY"])
      throw new Error("Analytics OAuth is not configured");
    const state = randomUrlToken();
    const verifier = randomUrlToken(48);
    await ctx.runMutation(internal.ga4Internal.begin, {
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
    connected: v.boolean(), property: v.union(v.string(), v.null()), streamUri: v.union(v.string(), v.null()),
    verifiedAt: v.union(v.string(), v.null()), periodStart: v.union(v.string(), v.null()),
    periodEnd: v.union(v.string(), v.null()), capturedAt: v.union(v.string(), v.null()),
    activeUsers: v.union(v.number(), v.null()), sessions: v.union(v.number(), v.null()),
    keyEvents: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { siteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    const membership = await ctx.db.query("memberships").withIndex("by_workspace_id_and_user_id", q => q.eq("workspace_id", site.workspace_id).eq("user_id", userId)).unique();
    if (!membership) throw new Error("Access denied");
    const connection = await ctx.db.query("ga4_connections").withIndex("by_site_id", q => q.eq("site_id", siteId)).unique();
    const empty = { connected: false, property: null, streamUri: null, verifiedAt: null, periodStart: null, periodEnd: null, capturedAt: null, activeUsers: null, sessions: null, keyEvents: null };
    if (!connection) return empty;
    const snapshots = await ctx.db.query("metrics_snapshots").withIndex("by_site_id_and_source", q => q.eq("site_id", siteId).eq("source", "google_analytics_4")).order("desc").take(3);
    const latest = snapshots[0] && snapshots[0].captured_at >= connection.verified_at ? snapshots[0] : undefined;
    const values = new Map(snapshots.filter(row => row.captured_at === latest?.captured_at).map(row => [row.metric, row.value]));
    return {
      connected: true, property: connection.property, streamUri: connection.stream_uri, verifiedAt: connection.verified_at,
      periodStart: latest?.period_start ?? null, periodEnd: latest?.period_end ?? null, capturedAt: latest?.captured_at ?? null,
      activeUsers: values.get("active_users") ?? null, sessions: values.get("sessions") ?? null, keyEvents: values.get("key_events") ?? null,
    };
  },
});

export const refresh = action({
  args: { siteId: v.id("sites") },
  returns: v.object({ activeUsers: v.number(), sessions: v.number(), keyEvents: v.number(), capturedAt: v.string() }),
  handler: async (ctx, { siteId }): Promise<{ activeUsers: number; sessions: number; keyEvents: number; capturedAt: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const connection = await ctx.runQuery(internal.ga4Internal.getConnection, { siteId, userId });
    if (!connection) throw new Error("Analytics is not connected");
    const clientId = process.env["AUTH_GOOGLE_ID"];
    const clientSecret = process.env["AUTH_GOOGLE_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
    const refreshToken = await decryptToken(connection.ciphertext, connection.iv);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!tokenResponse.ok) throw new Error("Google authorization expired. Reconnect Analytics.");
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Google did not return an access token");
    const end = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${connection.property}:runReport`, {
      method: "POST", headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "keyEvents" }] }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Analytics report failed (${response.status}). Check property access and API status.`);
    const data = await response.json() as { rows?: { metricValues?: { value?: string }[] }[] };
    const values = data.rows?.[0]?.metricValues;
    const activeUsers = Number(values?.[0]?.value ?? 0);
    const sessions = Number(values?.[1]?.value ?? 0);
    const keyEvents = Number(values?.[2]?.value ?? 0);
    if (![activeUsers, sessions, keyEvents].every(value => Number.isFinite(value) && value >= 0))
      throw new Error("Analytics returned invalid metrics");
    const capturedAt: string = await ctx.runMutation(internal.ga4Internal.saveMetrics, { siteId, userId, start, end, activeUsers, sessions, keyEvents });
    return { activeUsers, sessions, keyEvents, capturedAt };
  },
});

export const disconnect = action({
  args: { siteId: v.id("sites") },
  returns: v.null(),
  handler: async (ctx, { siteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    await ctx.runQuery(internal.ga4Internal.authorizeSite, { siteId, userId });
    await ctx.runMutation(internal.ga4Internal.remove, { siteId, userId });
    return null;
  },
});
