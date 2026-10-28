import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeDomain } from "../src/lib/audit/ssrf";

const now = () => new Date().toISOString();

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in required");
  return userId;
}

async function requireMember(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  edit = false,
) {
  const userId = await requireUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_workspace_id_and_user_id", (q) =>
      q.eq("workspace_id", workspaceId).eq("user_id", userId),
    )
    .unique();
  if (!membership || (edit && membership.role === "viewer")) throw new Error("Access denied");
  return membership;
}

async function requireSite(ctx: QueryCtx | MutationCtx, siteId: Id<"sites">, edit = false) {
  const site = await ctx.db.get(siteId);
  if (!site) throw new Error("Site not found");
  await requireMember(ctx, site.workspace_id, edit);
  return site;
}

const withId = <T extends { _id: string }>(row: T) => ({ ...row, id: row._id });

export const bootstrap = mutation({
  args: {},
  returns: v.id("workspaces"),
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(1);
    if (existing[0]) return existing[0].workspace_id;
    const createdAt = now();
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "My agency",
      autopilot_mode: "guarded",
      created_by: userId,
      created_at: createdAt,
    });
    await ctx.db.insert("memberships", {
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
      created_at: createdAt,
    });
    await ctx.db.insert("sites", {
      workspace_id: workspaceId,
      domain: "yabilocation.com",
      display_name: "Yabi Location",
      business_facts: {
        country: "Belgium",
        offering: "Monthly commercial utility van rentals",
        audience_primary: "B2B: SMEs, tradespeople, self-employed businesses",
        audience_secondary: "Private clients",
        fleet: "8 vans in L1H1, L2H2 and L3H2 sizes (individual models not specified)",
        handover: "Arranged handover meeting points; no fixed customer-facing garage",
        contact: "WhatsApp, phone, contact form",
        not_offered: "Car, leisure or tourist rentals; daily or weekend rentals; leasing or financing",
        pricing: "Not specified — do not publish exact prices",
      },
      regions: ["Brussels", "Vilvoorde"],
      service_radius_km: 45,
      languages: ["fr", "nl", "en"],
      source_repo: null,
      ownership_verified: false,
      write_access_verified: false,
      allow_location_pages: false,
      created_at: createdAt,
      updated_at: createdAt,
    });
    return workspaceId;
  },
});

export const viewer = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    return user ? { id: user._id, email: user.email ?? null, name: user.name ?? null } : null;
  },
});

export const listMemberships = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(100);
    return rows.map(withId);
  },
});

export const listSites = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(20);
    const groups = await Promise.all(
      memberships.map((membership) =>
        ctx.db
          .query("sites")
          .withIndex("by_workspace_id", (q) => q.eq("workspace_id", membership.workspace_id))
          .take(100),
      ),
    );
    return groups.flat().map(withId);
  },
});

export const addSite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    domain: v.string(),
    displayName: v.string(),
    description: v.string(),
    regions: v.array(v.string()),
    languages: v.array(v.string()),
    serviceRadiusKm: v.optional(v.number()),
    sourceRepo: v.optional(v.string()),
  },
  returns: v.id("sites"),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId, true);
    const domain = normalizeDomain(args.domain);
    if (!args.displayName.trim() || !args.description.trim() || !args.languages.length)
      throw new Error("Name, business facts and languages are required");
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_workspace_id_and_domain", (q) =>
        q.eq("workspace_id", args.workspaceId).eq("domain", domain),
      )
      .unique();
    if (existing) throw new Error("This site is already in the workspace");
    const createdAt = now();
    const siteId = await ctx.db.insert("sites", {
      workspace_id: args.workspaceId,
      domain,
      display_name: args.displayName.trim(),
      business_facts: { description: args.description.trim() },
      regions: args.regions,
      languages: args.languages,
      service_radius_km: args.serviceRadiusKm ?? null,
      source_repo: args.sourceRepo ?? null,
      ownership_verified: false,
      write_access_verified: false,
      allow_location_pages: false,
      created_at: createdAt,
      updated_at: createdAt,
    });
    await ctx.db.insert("change_events", {
      workspace_id: args.workspaceId,
      entity: "site",
      entity_id: siteId,
      action: "site_created",
      detail: {},
      actor: await requireUser(ctx),
      created_at: createdAt,
    });
    return siteId;
  },
});

export const updateSite = mutation({
  args: {
    siteId: v.id("sites"),
    displayName: v.string(),
    description: v.string(),
    regions: v.array(v.string()),
    languages: v.array(v.string()),
    serviceRadiusKm: v.optional(v.number()),
    sourceRepo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.siteId, true);
    if (!args.displayName.trim() || !args.description.trim() || !args.languages.length)
      throw new Error("Name, business facts and languages are required");
    const previousFacts =
      site.business_facts &&
      typeof site.business_facts === "object" &&
      !Array.isArray(site.business_facts)
        ? site.business_facts
        : {};
    await ctx.db.patch(args.siteId, {
      display_name: args.displayName.trim(),
      business_facts: { ...previousFacts, description: args.description.trim() },
      regions: args.regions,
      languages: args.languages,
      service_radius_km: args.serviceRadiusKm ?? null,
      source_repo: args.sourceRepo ?? null,
      updated_at: now(),
    });
    await ctx.db.insert("change_events", {
      workspace_id: site.workspace_id,
      entity: "site",
      entity_id: site._id,
      action: "site_updated",
      detail: {},
      actor: await requireUser(ctx),
      created_at: now(),
    });
    return null;
  },
});

export const listAudits = query({
  args: { siteId: v.id("sites") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireSite(ctx, args.siteId);
    const rows = await ctx.db
      .query("audits")
      .withIndex("by_site_id", (q) => q.eq("site_id", args.siteId))
      .order("desc")
      .take(100);
    return rows.map(withId);
  },
});

export const listAuditPages = query({
  args: { auditId: v.id("audits") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId);
    if (!audit) throw new Error("Audit not found");
    await requireMember(ctx, audit.workspace_id);
    const rows = await ctx.db
      .query("crawl_pages")
      .withIndex("by_audit_id", (q) => q.eq("audit_id", args.auditId))
      .take(100);
    return rows.map(withId);
  },
});

export const listFindings = query({
  args: { siteId: v.id("sites") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireSite(ctx, args.siteId);
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_site_id", (q) => q.eq("site_id", args.siteId))
      .order("desc")
      .take(100);
    return rows.map(withId);
  },
});

export const listAuditFindings = query({
  args: { auditId: v.id("audits") },
  returns: v.array(v.any()),
  handler: async (ctx, { auditId }) => {
    const audit = await ctx.db.get(auditId);
    if (!audit) throw new Error("Audit not found");
    await requireMember(ctx, audit.workspace_id);
    return (await ctx.db.query("findings").withIndex("by_audit_id", q => q.eq("audit_id", auditId)).take(100)).map(withId);
  },
});

export const listOpportunities = query({
  args: { siteId: v.id("sites") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireSite(ctx, args.siteId);
    const rows = await ctx.db
      .query("opportunities")
      .withIndex("by_site_id", (q) => q.eq("site_id", args.siteId))
      .order("desc")
      .take(100);
    return rows.map(withId);
  },
});

export const setOpportunityStatus = mutation({
  args: {
    opportunityId: v.id("opportunities"),
    status: v.union(
      v.literal("discovered"),
      v.literal("triaged"),
      v.literal("approved"),
      v.literal("in_progress"),
      v.literal("verified"),
      v.literal("failed"),
      v.literal("rolled_back"),
      v.literal("dismissed"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");
    await requireMember(ctx, opportunity.workspace_id, true);
    await ctx.db.patch(args.opportunityId, { status: args.status, updated_at: now() });
    await ctx.db.insert("change_events", {
      workspace_id: opportunity.workspace_id,
      entity: "opportunity",
      entity_id: opportunity._id,
      action: `status_${args.status}`,
      detail: {},
      actor: await requireUser(ctx),
      created_at: now(),
    });
    return null;
  },
});

export const listTasks = query({
  args: { workspaceId: v.id("workspaces") }, returns: v.array(v.any()),
  handler: async (ctx, { workspaceId }) => {
    await requireMember(ctx, workspaceId);
    return (await ctx.db.query("tasks").withIndex("by_workspace_id", q => q.eq("workspace_id", workspaceId)).order("desc").take(100)).map(withId);
  },
});

export const addTask = mutation({
  args: { opportunityId: v.id("opportunities"), title: v.string() }, returns: v.id("tasks"),
  handler: async (ctx, { opportunityId, title }) => {
    const opportunity = await ctx.db.get(opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");
    await requireMember(ctx, opportunity.workspace_id, true);
    if (!title.trim()) throw new Error("Task title required");
    const id = await ctx.db.insert("tasks", { workspace_id: opportunity.workspace_id, opportunity_id: opportunityId, title: title.trim(), status: "todo", assignee: null, due_date: null, created_at: now() });
    await ctx.db.insert("change_events", { workspace_id: opportunity.workspace_id, entity: "task", entity_id: id, action: "task_created", detail: {}, actor: await requireUser(ctx), created_at: now() });
    return id;
  },
});

export const setTaskStatus = mutation({
  args: { taskId: v.id("tasks"), status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done"), v.literal("blocked")) }, returns: v.null(),
  handler: async (ctx, { taskId, status }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await requireMember(ctx, task.workspace_id, true);
    await ctx.db.patch(taskId, { status });
    await ctx.db.insert("change_events", { workspace_id: task.workspace_id, entity: "task", entity_id: taskId, action: `task_${status}`, detail: {}, actor: await requireUser(ctx), created_at: now() });
    return null;
  },
});

export const listJobs = query({
  args: { siteId: v.id("sites") }, returns: v.array(v.any()),
  handler: async (ctx, { siteId }) => {
    await requireSite(ctx, siteId);
    return (await ctx.db.query("job_runs").withIndex("by_site_id", q => q.eq("site_id", siteId)).order("desc").take(50)).map(withId);
  },
});

export const listContent = query({
  args: { siteId: v.id("sites") },
  returns: v.array(v.any()),
  handler: async (ctx, { siteId }) => {
    await requireSite(ctx, siteId);
    return (await ctx.db.query("content_briefs").withIndex("by_site_id", q => q.eq("site_id", siteId)).order("desc").take(100)).map(withId);
  },
});

export const saveContent = mutation({
  args: {
    siteId: v.id("sites"), briefId: v.optional(v.id("content_briefs")),
    title: v.string(), language: v.string(), pageType: v.union(v.literal("service"), v.literal("product"), v.literal("faq"), v.literal("blog"), v.literal("supporting")),
    targetQuery: v.string(), searchIntent: v.string(), draft: v.string(), sourceUrl: v.string(),
  },
  returns: v.id("content_briefs"),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.siteId, true);
    if (!args.title.trim() || !args.language.trim()) throw new Error("Title and language required");
    if (args.sourceUrl && !/^https:\/\//.test(args.sourceUrl)) throw new Error("Source URL must use HTTPS");
    const values = {
      title: args.title.trim(), language: args.language.trim(), page_type: args.pageType,
      target_query: args.targetQuery || null, search_intent: args.searchIntent || null,
      draft: args.draft || null, sources: args.sourceUrl ? [args.sourceUrl] : [],
      applicability: site.regions.join(", "), updated_at: now(),
    };
    let id: Id<"content_briefs">;
    if (args.briefId) {
      const current = await ctx.db.get(args.briefId);
      if (!current || current.site_id !== site._id) throw new Error("Brief not found");
      await ctx.db.patch(args.briefId, values);
      id = args.briefId;
    } else {
      id = await ctx.db.insert("content_briefs", { ...values, workspace_id: site.workspace_id, site_id: site._id, outline: null, status: "draft", ai_generated: false, created_at: now() });
    }
    await ctx.db.insert("change_events", { workspace_id: site.workspace_id, entity: "content_brief", entity_id: id, action: args.briefId ? "brief_updated" : "brief_created", detail: {}, actor: await requireUser(ctx), created_at: now() });
    return id;
  },
});

export const listKeywords = query({
  args: { siteId: v.id("sites") }, returns: v.array(v.any()),
  handler: async (ctx, { siteId }) => {
    await requireSite(ctx, siteId);
    return (await ctx.db.query("keywords").withIndex("by_site_id", q => q.eq("site_id", siteId)).order("desc").take(200)).map(withId);
  },
});

export const addKeyword = mutation({
  args: { siteId: v.id("sites"), term: v.string(), language: v.string(), intent: v.string() }, returns: v.id("keywords"),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.siteId, true);
    const term = args.term.trim();
    if (!term || !args.language.trim()) throw new Error("Keyword and language required");
    const prior = await ctx.db.query("keywords").withIndex("by_site_id_and_term_and_language", q => q.eq("site_id", site._id).eq("term", term).eq("language", args.language)).unique();
    if (prior) throw new Error("Keyword already tracked");
    const id = await ctx.db.insert("keywords", { workspace_id: site.workspace_id, site_id: site._id, term, language: args.language, intent: args.intent || null, notes: null, source: "manual", created_at: now() });
    await ctx.db.insert("change_events", { workspace_id: site.workspace_id, entity: "keyword", entity_id: id, action: "keyword_created", detail: {}, actor: await requireUser(ctx), created_at: now() });
    return id;
  },
});

export const listCompetitors = query({
  args: { siteId: v.id("sites") }, returns: v.array(v.any()),
  handler: async (ctx, { siteId }) => {
    await requireSite(ctx, siteId);
    return (await ctx.db.query("competitor_sites").withIndex("by_site_id", q => q.eq("site_id", siteId)).order("desc").take(100)).map(withId);
  },
});

export const addCompetitor = mutation({
  args: { siteId: v.id("sites"), domain: v.string(), notes: v.string() }, returns: v.id("competitor_sites"),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.siteId, true);
    const domain = normalizeDomain(args.domain);
    if (domain === site.domain) throw new Error("A site cannot compete with itself");
    const prior = await ctx.db.query("competitor_sites").withIndex("by_site_id_and_domain", q => q.eq("site_id", site._id).eq("domain", domain)).unique();
    if (prior) throw new Error("Competitor already tracked");
    const id = await ctx.db.insert("competitor_sites", { workspace_id: site.workspace_id, site_id: site._id, domain, notes: args.notes || null, created_at: now() });
    await ctx.db.insert("change_events", { workspace_id: site.workspace_id, entity: "competitor", entity_id: id, action: "competitor_created", detail: {}, actor: await requireUser(ctx), created_at: now() });
    return id;
  },
});

export const listActivity = query({
  args: { workspaceId: v.id("workspaces") }, returns: v.array(v.any()),
  handler: async (ctx, { workspaceId }) => {
    await requireMember(ctx, workspaceId);
    return (await ctx.db.query("change_events").withIndex("by_workspace_id", q => q.eq("workspace_id", workspaceId)).order("desc").take(100)).map(withId);
  },
});

export const setMode = mutation({
  args: { workspaceId: v.id("workspaces"), mode: v.union(v.literal("manual"), v.literal("guarded"), v.literal("advanced")) }, returns: v.null(),
  handler: async (ctx, { workspaceId, mode }) => {
    const membership = await requireMember(ctx, workspaceId);
    if (membership.role !== "owner" && membership.role !== "admin") throw new Error("Owner or admin required");
    await ctx.db.patch(workspaceId, { autopilot_mode: mode });
    await ctx.db.insert("change_events", { workspace_id: workspaceId, entity: "workspace", entity_id: workspaceId, action: `mode_${mode}`, detail: {}, actor: await requireUser(ctx), created_at: now() });
    return null;
  },
});

export const getWorkspace = query({
  args: { workspaceId: v.id("workspaces") }, returns: v.any(),
  handler: async (ctx, { workspaceId }) => {
    await requireMember(ctx, workspaceId);
    return ctx.db.get(workspaceId);
  },
});
