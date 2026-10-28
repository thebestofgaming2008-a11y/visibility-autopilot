import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { encryptToken, sha256Url } from "./gscCrypto";
import { matchingProperty } from "../src/lib/gsc-property";

const redirectUri = "https://colorless-toad-83.convex.site/gsc/callback";
const appUrl = "https://omni-visibility-autopilot-dev.thebestofgaming2008.workers.dev/";

export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code || url.searchParams.has("error"))
    return Response.redirect(`${appUrl}?gsc=cancelled`, 302);
  try {
    const pending = await ctx.runMutation(internal.gscInternal.consume, { stateHash: await sha256Url(state) });
    const clientId = process.env["AUTH_GOOGLE_ID"];
    const clientSecret = process.env["AUTH_GOOGLE_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, code_verifier: pending.verifier, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!tokenResponse.ok) throw new Error(`Google token exchange failed (${tokenResponse.status})`);
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; scope?: string };
    if (!token.access_token || !token.refresh_token || !token.scope?.split(" ").includes("https://www.googleapis.com/auth/webmasters.readonly"))
      throw new Error("Read only Search Console permission or offline token missing");
    const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(12_000),
    });
    if (!sitesResponse.ok) throw new Error(`Search Console property lookup failed (${sitesResponse.status})`);
    const sites = await sitesResponse.json() as { siteEntry?: { siteUrl?: string; permissionLevel?: string }[] };
    const property = matchingProperty(pending.domain, sites.siteEntry ?? []);
    if (!property?.siteUrl || !property.permissionLevel) throw new Error("No verified Search Console property for this site");
    const encrypted = await encryptToken(token.refresh_token);
    await ctx.runMutation(internal.gscInternal.finish, {
      siteId: pending.siteId, userId: pending.userId, property: property.siteUrl, permission: property.permissionLevel,
      ciphertext: encrypted.ciphertext, iv: encrypted.iv,
    });
    return Response.redirect(`${appUrl}?gsc=connected`, 302);
  } catch (error) {
    console.error("Search Console connection failed", error instanceof Error ? error.message : "Unknown error");
    return Response.redirect(`${appUrl}?gsc=failed`, 302);
  }
});
