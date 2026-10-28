import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { normalizeDomain } from "../src/lib/audit/ssrf";
import { parseHtml, parseRobots, parseSitemap, robotsAllows, type RobotsInfo } from "../src/lib/audit/parse";
import { evaluate, confidenceOf, impactOf, type AuditInput } from "../src/lib/audit/rules";

const now = () => new Date().toISOString();

export const start = internalMutation({
  args: { siteId: v.id("sites"), userId: v.optional(v.id("users")), workspaceId: v.optional(v.id("workspaces")) },
  returns: v.object({
    auditId: v.id("audits"),
    jobId: v.id("job_runs"),
    workspaceId: v.id("workspaces"),
    domain: v.string(),
    languages: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");
    if (args.workspaceId && site.workspace_id !== args.workspaceId) throw new Error("Site outside token workspace");
    if (args.userId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_workspace_id_and_user_id", (q) =>
          q.eq("workspace_id", site.workspace_id).eq("user_id", args.userId!),
        )
        .unique();
      if (!membership || membership.role === "viewer") throw new Error("Audit access denied");
    } else {
      const schedule = await ctx.db.query("audit_schedules").withIndex("by_site_id", q => q.eq("site_id", site._id)).unique();
      if (!schedule?.enabled) throw new Error("Scheduled audit disabled");
    }
    const recent = await ctx.db
      .query("audits")
      .withIndex("by_site_id", (q) => q.eq("site_id", site._id))
      .order("desc")
      .take(1);
    if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 120_000)
      throw new Error("An audit for this site ran less than 2 minutes ago. Please wait.");
    const startedAt = now();
    const auditId = await ctx.db.insert("audits", {
      workspace_id: site.workspace_id,
      site_id: site._id,
      status: "running",
      started_at: startedAt,
      finished_at: null,
      error: null,
      summary: {},
      ...(args.userId ? { created_by: args.userId } : {}),
      created_at: startedAt,
    });
    const jobId = await ctx.db.insert("job_runs", {
      workspace_id: site.workspace_id,
      site_id: site._id,
      kind: "public_audit",
      status: "running",
      trigger: args.userId ? "manual" : "scheduled",
      started_at: startedAt,
      finished_at: null,
      error: null,
      ref_id: auditId,
      ...(args.userId ? { created_by: args.userId } : {}),
      created_at: startedAt,
    });
    return {
      auditId,
      jobId,
      workspaceId: site.workspace_id,
      domain: site.domain,
      languages: site.languages,
    };
  },
});

export const finish = internalMutation({
  args: {
    auditId: v.id("audits"),
    jobId: v.id("job_runs"),
    pages: v.array(v.any()),
    drafts: v.array(v.any()),
    summary: v.any(),
    status: v.union(v.literal("completed"), v.literal("partial"), v.literal("failed")),
    error: v.union(v.string(), v.null()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId);
    const job = await ctx.db.get(args.jobId);
    if (!audit || !job || audit.status !== "running" || job.status !== "running")
      throw new Error("Audit run is no longer active");
    const workspaceId = audit.workspace_id;
    let opportunitiesCreated = 0;
    for (const page of args.pages) {
      await ctx.db.insert("crawl_pages", {
        workspace_id: workspaceId,
        audit_id: args.auditId,
        url: page.url,
        kind: page.kind,
        http_status: page.http_status ?? null,
        fetched_at: page.fetched_at,
        redirect_chain: page.redirect_chain ?? [],
        bytes: page.bytes ?? null,
        duration_ms: page.duration_ms ?? null,
        content_type: page.content_type ?? null,
        parsed: page.parsed ?? {},
        error: page.error ?? null,
      });
    }
    for (const draft of args.drafts) {
      const findingId = await ctx.db.insert("findings", {
        workspace_id: workspaceId,
        site_id: audit.site_id,
        audit_id: args.auditId,
        code: draft.code,
        title: draft.title,
        severity: draft.severity,
        confidence: draft.confidence,
        category: draft.category,
        url: draft.url,
        recommendation: draft.recommendation,
        detail: draft.detail ?? null,
        created_at: now(),
      });
      await ctx.db.insert("evidence", {
        workspace_id: workspaceId,
        finding_id: findingId,
        url: draft.url,
        observed_at: now(),
        http_status: draft.httpStatus ?? null,
        snippet: draft.snippet ?? draft.detail ?? null,
        source: "public_fetch",
        created_at: now(),
      });
      if (draft.severity === "info") continue;
      const prior = await ctx.db
        .query("opportunities")
        .withIndex("by_site_id_and_finding_code", (q) =>
          q.eq("site_id", audit.site_id).eq("finding_code", draft.code),
        )
        .order("desc")
        .take(20);
      const open = prior.find((row) => !["verified", "dismissed", "rolled_back"].includes(row.status));
      if (open) {
        await ctx.db.patch(open._id, { finding_id: findingId, updated_at: now() });
      } else {
        await ctx.db.insert("opportunities", {
          workspace_id: workspaceId,
          site_id: audit.site_id,
          finding_id: findingId,
          finding_code: draft.code,
          title: draft.title,
          description: draft.recommendation,
          impact: impactOf(draft.severity),
          confidence: confidenceOf(draft.confidence),
          effort: draft.effort,
          status: "discovered",
          risk: "medium",
          owner: "agency",
          next_action: "Triage: confirm the evidence, then approve or dismiss.",
          created_at: now(),
          updated_at: now(),
        });
        opportunitiesCreated++;
      }
    }
    const finalSummary = { ...args.summary, opportunities_created: opportunitiesCreated };
    await ctx.db.patch(args.auditId, {
      status: args.status,
      finished_at: now(),
      error: args.error,
      summary: finalSummary,
    });
    await ctx.db.patch(args.jobId, {
      status: args.status === "failed" ? "failed" : "succeeded",
      finished_at: now(),
      error: args.status === "failed" ? args.error : null,
    });
    await ctx.db.insert("change_events", {
      workspace_id: workspaceId,
      entity: "audit",
      entity_id: args.auditId,
      action: `audit_${args.status}`,
      detail: finalSummary,
      ...(audit.created_by ? { actor: audit.created_by } : {}),
      created_at: now(),
    });
    return opportunitiesCreated;
  },
});

export const fail = internalMutation({
  args: {
    auditId: v.id("audits"),
    jobId: v.id("job_runs"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.auditId, { status: "failed", finished_at: now(), error: args.error });
    await ctx.db.patch(args.jobId, { status: "failed", finished_at: now(), error: args.error });
    return null;
  },
});

type Started = {
  auditId: Id<"audits">;
  jobId: Id<"job_runs">;
  workspaceId: Id<"workspaces">;
  domain: string;
  languages: string[];
};

async function execute(ctx: ActionCtx, started: Started): Promise<{
  auditId: Id<"audits">;
  status: string;
  summary: Record<string, unknown>;
}> {
    try {
      const root = normalizeDomain(started.domain);
      const base = `https://${root}`;
      const pages: Record<string, unknown>[] = [];
      const robots: AuditInput["robots"] = { url: `${base}/robots.txt`, status: null, info: null };
      let robotsInfo: RobotsInfo | null = null;
      try {
        const response = await ctx.runAction(internal.publicAuditFetch.fetchPinned, { url: robots.url, allowedRoot: root });
        robots.status = response.status;
        robots.body = response.body.slice(0, 4000);
        if (response.truncated) robots.error = "robots.txt exceeded 2 MB";
        else if (response.status === 200) robotsInfo = robots.info = parseRobots(response.body);
        pages.push({
          url: response.finalUrl,
          kind: "robots",
          http_status: response.status,
          redirect_chain: response.chain,
          bytes: response.bytes,
          duration_ms: response.durationMs,
          content_type: response.contentType,
          parsed: robotsInfo ?? {},
          fetched_at: now(),
        });
      } catch (error) {
        robots.error = (error as Error).message;
        pages.push({ url: robots.url, kind: "robots", error: robots.error, fetched_at: now() });
      }

      const home: AuditInput["home"] = {
        url: `${base}/`, status: null, chain: [], bytes: 0, parsed: null,
      };
      if (robots.error || (robots.status !== null && robots.status >= 500)) {
        home.error = "Skipped: robots.txt could not be checked safely";
        home.robotsBlocked = true;
      } else if (robots.status === 401 || robots.status === 403 || !robotsAllows(robotsInfo, "/")) {
        home.error = "Skipped: robots.txt denies homepage crawling";
        home.robotsBlocked = true;
      } else {
        try {
          const response = await ctx.runAction(internal.publicAuditFetch.fetchPinned, { url: home.url, allowedRoot: root });
          home.url = response.finalUrl;
          home.status = response.status;
          home.chain = response.chain;
          home.bytes = response.bytes;
          if (response.truncated) home.error = "Homepage exceeded 2 MB";
          else if (response.status < 400 && (response.contentType ?? "").includes("html"))
            home.parsed = parseHtml(response.body, response.finalUrl);
          pages.push({
            url: response.finalUrl,
            kind: "homepage",
            http_status: response.status,
            redirect_chain: response.chain,
            bytes: response.bytes,
            duration_ms: response.durationMs,
            content_type: response.contentType,
            parsed: home.parsed ?? {},
            fetched_at: now(),
            error: response.truncated ? "Body truncated at 2 MB" : null,
          });
        } catch (error) {
          home.error = (error as Error).message;
        }
      }
      if (!pages.some((page) => page["kind"] === "homepage"))
        pages.push({ url: home.url, kind: "homepage", error: home.error, fetched_at: now() });

      const sitemapUrl =
        robotsInfo?.sitemaps.find((candidate) => {
          try {
            const host = new URL(candidate).hostname;
            return host === root || host.endsWith(`.${root}`);
          } catch {
            return false;
          }
        }) ?? `${base}/sitemap.xml`;
      const sitemap: AuditInput["sitemap"] = {
        url: sitemapUrl, status: null, count: 0, isIndex: false, isUrlset: false, sample: [],
      };
      const blocked =
        !!robots.error ||
        (robots.status !== null && [401, 403].includes(robots.status)) ||
        (robots.status !== null && robots.status >= 500) ||
        !robotsAllows(robotsInfo, new URL(sitemapUrl).pathname);
      if (blocked) {
        sitemap.error = "Skipped: robots.txt could not allow sitemap crawling";
        pages.push({ url: sitemapUrl, kind: "sitemap", error: sitemap.error, fetched_at: now() });
      } else {
        try {
          const response = await ctx.runAction(internal.publicAuditFetch.fetchPinned, { url: sitemapUrl, allowedRoot: root });
          sitemap.status = response.status;
          if (response.truncated) sitemap.error = "Sitemap exceeded 2 MB";
          else if (response.status === 200) Object.assign(sitemap, parseSitemap(response.body));
          pages.push({
            url: response.finalUrl,
            kind: "sitemap",
            http_status: response.status,
            redirect_chain: response.chain,
            bytes: response.bytes,
            duration_ms: response.durationMs,
            content_type: response.contentType,
            parsed: { count: sitemap.count, isIndex: sitemap.isIndex, sample: sitemap.sample },
            fetched_at: now(),
            error: response.truncated ? "Body truncated at 2 MB" : null,
          });
        } catch (error) {
          sitemap.error = (error as Error).message;
          pages.push({ url: sitemapUrl, kind: "sitemap", error: sitemap.error, fetched_at: now() });
        }
      }

      const drafts = evaluate({ siteLanguages: started.languages, home, robots, sitemap });
      const failedChecks = [home.error, robots.error, sitemap.error].filter(Boolean).length;
      const status = failedChecks === 3 ? "failed" : failedChecks > 0 ? "partial" : "completed";
      const error = failedChecks
        ? [home.error, robots.error, sitemap.error].filter(Boolean).join(" | ")
        : null;
      const summary = {
        findings: drafts.length,
        homepage_status: home.status,
        robots_status: robots.status,
        sitemap_status: sitemap.status,
        failed_checks: failedChecks,
        final_url: home.url,
      };
      const created: number = await ctx.runMutation(internal.publicAudit.finish, {
        auditId: started.auditId,
        jobId: started.jobId,
        pages,
        drafts: drafts.map((draft) => ({
          ...draft,
          detail: draft.detail ?? null,
          snippet: draft.snippet ?? null,
          httpStatus: draft.httpStatus ?? null,
        })),
        summary,
        status,
        error,
      });
      return { auditId: started.auditId, status, summary: { ...summary, opportunities_created: created } };
    } catch (error) {
      const message = (error as Error).message;
      await ctx.runMutation(internal.publicAudit.fail, {
        auditId: started.auditId,
        jobId: started.jobId,
        error: message,
      });
      return { auditId: started.auditId, status: "failed", summary: { error: message } };
    }
}

export const run = action({
  args: { siteId: v.id("sites") },
  returns: v.object({ auditId: v.id("audits"), status: v.string(), summary: v.any() }),
  handler: async (ctx, args): Promise<{ auditId: Id<"audits">; status: string; summary: Record<string, unknown> }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const started: Started = await ctx.runMutation(internal.publicAudit.start, { siteId: args.siteId, userId });
    return execute(ctx, started);
  },
});

export const runScheduled = internalAction({
  args: { siteId: v.id("sites") },
  returns: v.null(),
  handler: async (ctx, { siteId }) => {
    try {
      const started: Started = await ctx.runMutation(internal.publicAudit.start, { siteId });
      const result = await execute(ctx, started);
      await ctx.runMutation(internal.scheduling.record, { siteId, error: result.status === "failed" ? String(result.summary["error"] ?? "Audit failed") : null });
    } catch (error) {
      await ctx.runMutation(internal.scheduling.record, { siteId, error: (error as Error).message });
    }
    return null;
  },
});

export const runForMcp = internalAction({
  args: { siteId: v.id("sites"), workspaceId: v.id("workspaces"), userId: v.id("users") },
  returns: v.object({ auditId: v.id("audits"), status: v.string(), summary: v.any() }),
  handler: async (ctx, args): Promise<{ auditId: Id<"audits">; status: string; summary: Record<string, unknown> }> => {
    const started: Started = await ctx.runMutation(internal.publicAudit.start, args);
    return execute(ctx, started);
  },
});
