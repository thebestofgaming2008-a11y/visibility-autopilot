import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type LegacyKey =
  | "workspace" | "site" | "audits" | "pages" | "jobs" | "events"
  | "id" | "audit_id" | "ref_id" | "domain" | "name" | "display_name" | "business_facts"
  | "regions" | "service_radius_km" | "languages" | "source_repo" | "allow_location_pages"
  | "autopilot_mode" | "status" | "started_at" | "finished_at" | "created_at" | "updated_at"
  | "error" | "summary" | "url" | "kind" | "http_status" | "fetched_at" | "redirect_chain"
  | "bytes" | "duration_ms" | "content_type" | "parsed" | "trigger" | "entity" | "entity_id"
  | "action" | "detail" | "actor";
type RecordLike = Record<string, unknown> & Partial<Record<LegacyKey, unknown>>;
type LegacyPayload = {
  workspace: RecordLike;
  site: RecordLike;
  audits: RecordLike[];
  pages: RecordLike[];
  jobs: RecordLike[];
  events: RecordLike[];
};

function object(value: unknown): RecordLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid legacy record");
  return value as RecordLike;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid legacy text");
  return value;
}
function maybeString(value: unknown): string | null {
  return value == null ? null : string(value);
}
function maybeNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number") throw new Error("Invalid legacy number");
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) throw new Error("Invalid legacy text list");
  return value;
}
function records(value: unknown): RecordLike[] {
  if (!Array.isArray(value)) throw new Error("Invalid legacy record list");
  return value.map(object);
}
function mode(value: unknown): "manual" | "guarded" | "advanced" {
  if (value === "manual" || value === "guarded" || value === "advanced") return value;
  throw new Error("Invalid legacy mode");
}
function auditStatus(value: unknown): "queued" | "running" | "completed" | "failed" | "partial" {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "partial") return value;
  throw new Error("Invalid legacy audit status");
}
function jobStatus(value: unknown): "queued" | "running" | "succeeded" | "failed" {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed") return value;
  throw new Error("Invalid legacy job status");
}

/** Only call this from a Google OAuth callback with a verified email claim. */
export async function claimLegacyForVerifiedGoogle(ctx: MutationCtx, userId: Id<"users">, email: string): Promise<void> {
  const entry = await ctx.db.query("legacy_imports").withIndex("by_email", q => q.eq("email", email.toLowerCase())).unique();
  if (!entry || entry.claimed_user_id) return;
  const raw = object(entry.payload);
  const payload: LegacyPayload = {
    workspace: object(raw.workspace), site: object(raw.site),
    audits: records(raw.audits), pages: records(raw.pages), jobs: records(raw.jobs), events: records(raw.events),
  };
  if (string(payload.site.domain) !== "yabilocation.com" || payload.audits.length > 20 || payload.pages.length > 200 || payload.jobs.length > 20 || payload.events.length > 200)
    throw new Error("Legacy import exceeds expected scope");
  const timestamp = new Date().toISOString();
  const priorMembership = (await ctx.db.query("memberships").withIndex("by_user_id", q => q.eq("user_id", userId)).take(1))[0];
  let workspaceId: Id<"workspaces">;
  if (priorMembership) workspaceId = priorMembership.workspace_id;
  else {
    workspaceId = await ctx.db.insert("workspaces", {
      name: string(payload.workspace.name),
      autopilot_mode: mode(payload.workspace.autopilot_mode),
      created_by: userId,
      created_at: string(payload.workspace.created_at),
    });
    await ctx.db.insert("memberships", { workspace_id: workspaceId, user_id: userId, role: "owner", created_at: timestamp });
  }
  let site = await ctx.db.query("sites").withIndex("by_workspace_id_and_domain", q => q.eq("workspace_id", workspaceId).eq("domain", "yabilocation.com")).unique();
  if (!site) {
    const siteId = await ctx.db.insert("sites", {
      workspace_id: workspaceId,
      domain: "yabilocation.com",
      display_name: string(payload.site.display_name),
      business_facts: payload.site.business_facts ?? {},
      regions: strings(payload.site.regions),
      service_radius_km: maybeNumber(payload.site.service_radius_km),
      languages: strings(payload.site.languages),
      source_repo: maybeString(payload.site.source_repo),
      ownership_verified: false,
      write_access_verified: false,
      allow_location_pages: payload.site.allow_location_pages === true,
      created_at: string(payload.site.created_at),
      updated_at: string(payload.site.updated_at),
    });
    site = await ctx.db.get(siteId);
  }
  if (!site) throw new Error("Legacy site import failed");
  const auditIds = new Map<string, Id<"audits">>();
  for (const old of payload.audits) {
    const id = await ctx.db.insert("audits", {
      workspace_id: workspaceId, site_id: site._id,
      status: auditStatus(old.status), started_at: maybeString(old.started_at), finished_at: maybeString(old.finished_at),
      error: maybeString(old.error), summary: old.summary ?? {}, created_at: string(old.created_at),
    });
    auditIds.set(string(old.id), id);
  }
  for (const old of payload.pages) {
    const auditId = auditIds.get(string(old.audit_id));
    if (!auditId) throw new Error("Legacy page references unknown audit");
    await ctx.db.insert("crawl_pages", {
      workspace_id: workspaceId, audit_id: auditId,
      url: string(old.url), kind: string(old.kind), http_status: maybeNumber(old.http_status),
      fetched_at: string(old.fetched_at), redirect_chain: old.redirect_chain ?? [], bytes: maybeNumber(old.bytes),
      duration_ms: maybeNumber(old.duration_ms), content_type: maybeString(old.content_type), parsed: old.parsed ?? {},
      error: maybeString(old.error),
    });
  }
  for (const old of payload.jobs) {
    const refId = old.ref_id ? auditIds.get(string(old.ref_id)) : null;
    await ctx.db.insert("job_runs", {
      workspace_id: workspaceId, site_id: site._id, kind: string(old.kind), status: jobStatus(old.status),
      trigger: string(old.trigger), started_at: maybeString(old.started_at), finished_at: maybeString(old.finished_at),
      error: maybeString(old.error), ref_id: refId ?? null, created_at: string(old.created_at),
    });
  }
  for (const old of payload.events) {
    await ctx.db.insert("change_events", {
      workspace_id: workspaceId, entity: string(old.entity), entity_id: maybeString(old.entity_id),
      action: string(old.action), detail: { legacy_detail: old.detail ?? {}, legacy_actor_id: old.actor ?? null },
      created_at: string(old.created_at),
    });
  }
  await ctx.db.insert("change_events", {
    workspace_id: workspaceId, entity: "legacy_import", entity_id: entry._id,
    action: "legacy_data_claimed", detail: { audits: payload.audits.length, pages: payload.pages.length },
    actor: userId, created_at: timestamp,
  });
  await ctx.db.patch(entry._id, { claimed_user_id: userId, claimed_at: timestamp });
}
