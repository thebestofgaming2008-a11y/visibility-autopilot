import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { encryptToken, sha256Url } from "./gscCrypto";
import { matchingWebStream } from "../src/lib/ga4-property";

const redirectUri = "https://colorless-toad-83.convex.site/ga4/callback";
const appUrl = "https://omni-visibility-autopilot-dev.thebestofgaming2008.workers.dev/";
type PropertySummary = { property?: string; displayName?: string };

async function matchingAnalyticsProperty(domain: string, accessToken: string): Promise<{ property: string; streamUri: string } | null> {
  const properties: PropertySummary[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`Analytics property lookup failed (${response.status})`);
    const data = await response.json() as { accountSummaries?: { propertySummaries?: PropertySummary[] }[]; nextPageToken?: string };
    for (const account of data.accountSummaries ?? []) properties.push(...(account.propertySummaries ?? []));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }
  if (properties.length > 100 || pageToken) throw new Error("Too many Analytics properties to verify safely");
  for (const candidate of properties) {
    if (!/^properties\/\d+$/.test(candidate.property ?? "")) continue;
    const response = await fetch(`https://analyticsadmin.googleapis.com/v1alpha/${candidate.property}/dataStreams?pageSize=200`, {
      headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) continue;
    const data = await response.json() as { dataStreams?: { type?: string; webStreamData?: { defaultUri?: string } }[] };
    const streamUri = matchingWebStream(domain, data.dataStreams ?? []);
    if (streamUri) return { property: candidate.property!, streamUri };
  }
  return null;
}

export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code || url.searchParams.has("error")) return Response.redirect(`${appUrl}?ga4=cancelled`, 302);
  try {
    const pending = await ctx.runMutation(internal.ga4Internal.consume, { stateHash: await sha256Url(state) });
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
    if (!token.access_token || !token.refresh_token || !token.scope?.split(" ").includes("https://www.googleapis.com/auth/analytics.readonly"))
      throw new Error("Read only Analytics permission or offline token missing");
    const property = await matchingAnalyticsProperty(pending.domain, token.access_token);
    if (!property) throw new Error("No Analytics web stream for this site was found");
    const encrypted = await encryptToken(token.refresh_token);
    await ctx.runMutation(internal.ga4Internal.finish, {
      siteId: pending.siteId, userId: pending.userId, property: property.property, streamUri: property.streamUri,
      ciphertext: encrypted.ciphertext, iv: encrypted.iv,
    });
    return Response.redirect(`${appUrl}?ga4=connected`, 302);
  } catch (error) {
    console.error("Analytics connection failed", error instanceof Error ? error.message : "Unknown error");
    return Response.redirect(`${appUrl}?ga4=failed`, 302);
  }
});
