import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeDomain, safeFetch } from "./ssrf";
import { parseHtml, parseRobots, parseSitemap, robotsAllows, type RobotsInfo } from "./parse";
import { evaluate, impactOf, confidenceOf, type AuditInput } from "./rules";

export const runPublicAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteId: string }) => {
    if (!input?.siteId || !/^[0-9a-f-]{36}$/i.test(input.siteId))
      throw new Error("Invalid site id");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS: only returns the site if caller is a member of its workspace.
    const { data: site, error: siteErr } = await supabase
      .from("sites")
      .select("*")
      .eq("id", data.siteId)
      .single();
    if (siteErr || !site) throw new Error("Site not found or not accessible");
    const ws = site.workspace_id;

    // Rate limit: one audit per site per 2 minutes.
    const { data: recent } = await supabase
      .from("audits")
      .select("id,created_at,status")
      .eq("site_id", site.id)
      .gte("created_at", new Date(Date.now() - 120_000).toISOString())
      .limit(1);
    if (recent && recent.length)
      throw new Error("An audit for this site ran less than 2 minutes ago. Please wait.");

    const now = () => new Date().toISOString();
    const { data: job, error: jobErr } = await supabase
      .from("job_runs")
      .insert({
        workspace_id: ws,
        site_id: site.id,
        kind: "public_audit",
        status: "running",
        trigger: "manual",
        started_at: now(),
        created_by: userId,
      })
      .select()
      .single();
    if (jobErr) throw new Error(jobErr.message);
    const { data: audit, error: aErr } = await supabase
      .from("audits")
      .insert({
        workspace_id: ws,
        site_id: site.id,
        status: "running",
        started_at: now(),
        created_by: userId,
      })
      .select()
      .single();
    if (aErr) throw new Error(aErr.message);
    await supabase.from("job_runs").update({ ref_id: audit.id }).eq("id", job.id);

    try {
      const root = normalizeDomain(site.domain);
      const base = `https://${root}`;
      const pages: Record<string, unknown>[] = [];

      // robots.txt first so we can respect it.
      const robots: AuditInput["robots"] = { url: `${base}/robots.txt`, status: null, info: null };
      let robotsInfo: RobotsInfo | null = null;
      try {
        const r = await safeFetch(robots.url, root);
        robots.status = r.status;
        robots.body = r.body.slice(0, 4000);
        if (r.truncated) robots.error = "robots.txt exceeded 2 MB";
        else if (r.status === 200) robotsInfo = robots.info = parseRobots(r.body);
        pages.push({
          url: r.finalUrl,
          kind: "robots",
          http_status: r.status,
          redirect_chain: r.chain,
          bytes: r.bytes,
          duration_ms: r.durationMs,
          content_type: r.contentType,
          parsed: robotsInfo ?? {},
          fetched_at: now(),
        });
      } catch (e) {
        robots.error = (e as Error).message;
        pages.push({ url: robots.url, kind: "robots", error: robots.error, fetched_at: now() });
      }

      const home: AuditInput["home"] = {
        url: `${base}/`,
        status: null,
        chain: [],
        bytes: 0,
        parsed: null,
      };
      if (robots.error || (robots.status !== null && robots.status >= 500)) {
        home.error = "Skipped: robots.txt could not be checked safely";
        home.robotsBlocked = true;
      } else if (robots.status === 401 || robots.status === 403 || !robotsAllows(robotsInfo, "/")) {
        home.error = "Skipped: robots.txt denies homepage crawling";
        home.robotsBlocked = true;
      } else {
        try {
          const r = await safeFetch(home.url, root);
          home.url = r.finalUrl;
          home.status = r.status;
          home.chain = r.chain;
          home.bytes = r.bytes;
          if (r.truncated) home.error = "Homepage exceeded 2 MB";
          else if (r.status < 400 && (r.contentType ?? "").includes("html"))
            home.parsed = parseHtml(r.body, r.finalUrl);
          pages.push({
            url: r.finalUrl,
            kind: "homepage",
            http_status: r.status,
            redirect_chain: r.chain,
            bytes: r.bytes,
            duration_ms: r.durationMs,
            content_type: r.contentType,
            parsed: home.parsed ?? {},
            fetched_at: now(),
            error: r.truncated ? "Body truncated at 2 MB" : null,
          });
        } catch (e) {
          home.error = (e as Error).message;
          pages.push({ url: home.url, kind: "homepage", error: home.error, fetched_at: now() });
        }
      }

      if (home.robotsBlocked)
        pages.push({ url: home.url, kind: "homepage", error: home.error, fetched_at: now() });
      const smUrl =
        robotsInfo?.sitemaps.find((s) => {
          try {
            const h = new URL(s).hostname;
            return h === root || h.endsWith("." + root);
          } catch {
            return false;
          }
        }) ?? `${base}/sitemap.xml`;
      const sitemap: AuditInput["sitemap"] = {
        url: smUrl,
        status: null,
        count: 0,
        isIndex: false,
        isUrlset: false,
        sample: [],
      };
      const sitemapBlocked =
        robots.error ||
        (robots.status !== null &&
          (robots.status >= 500 || robots.status === 401 || robots.status === 403)) ||
        !robotsAllows(robotsInfo, new URL(smUrl).pathname);
      if (sitemapBlocked) {
        sitemap.error = "Skipped: robots.txt could not allow sitemap crawling";
        pages.push({ url: smUrl, kind: "sitemap", error: sitemap.error, fetched_at: now() });
      } else
        try {
          const r = await safeFetch(smUrl, root);
          sitemap.status = r.status;
          if (r.truncated) sitemap.error = "Sitemap exceeded 2 MB";
          else if (r.status === 200) Object.assign(sitemap, parseSitemap(r.body));
          pages.push({
            url: r.finalUrl,
            kind: "sitemap",
            http_status: r.status,
            redirect_chain: r.chain,
            bytes: r.bytes,
            duration_ms: r.durationMs,
            content_type: r.contentType,
            parsed: { count: sitemap.count, isIndex: sitemap.isIndex, sample: sitemap.sample },
            fetched_at: now(),
          });
        } catch (e) {
          sitemap.error = (e as Error).message;
          pages.push({ url: smUrl, kind: "sitemap", error: sitemap.error, fetched_at: now() });
        }

      await supabase
        .from("crawl_pages")
        .insert(pages.map((p) => ({ ...p, workspace_id: ws, audit_id: audit.id })) as never);

      const drafts = evaluate({ siteLanguages: site.languages, home, robots, sitemap });
      const observedAt = now();
      let created = 0;
      for (const d of drafts) {
        const { data: fnd } = await supabase
          .from("findings")
          .insert({
            workspace_id: ws,
            site_id: site.id,
            audit_id: audit.id,
            code: d.code,
            title: d.title,
            severity: d.severity,
            confidence: d.confidence,
            category: d.category,
            url: d.url,
            recommendation: d.recommendation,
            detail: d.detail ?? null,
          })
          .select()
          .single();
        if (!fnd) continue;
        await supabase.from("evidence").insert({
          workspace_id: ws,
          finding_id: fnd.id,
          url: d.url,
          observed_at: observedAt,
          http_status: d.httpStatus ?? (d.url === home.url ? home.status : null),
          snippet:
            d.snippet ??
            d.detail ??
            (d.url === home.url ? home.parsed?.snippets["document"] : null) ??
            null,
        });
        if (d.severity === "info") continue;
        // One open opportunity per finding code per site.
        const { data: open } = await supabase
          .from("opportunities")
          .select("id")
          .eq("site_id", site.id)
          .eq("finding_code", d.code)
          .not("status", "in", "(verified,dismissed,rolled_back)")
          .limit(1);
        if (open?.[0]) {
          await supabase
            .from("opportunities")
            .update({ finding_id: fnd.id, updated_at: now() })
            .eq("id", open[0].id);
          continue;
        }
        await supabase.from("opportunities").insert({
          workspace_id: ws,
          site_id: site.id,
          finding_id: fnd.id,
          finding_code: d.code,
          title: d.title,
          description: d.recommendation,
          impact: impactOf(d.severity),
          confidence: confidenceOf(d.confidence),
          effort: d.effort,
          risk: "medium",
          owner: "agency",
          next_action: "Triage: confirm the evidence, then approve or dismiss.",
        });
        created++;
      }

      const failedChecks = [home.error, robots.error, sitemap.error].filter(Boolean).length;
      const status = failedChecks === 3 ? "failed" : failedChecks > 0 ? "partial" : "completed";
      const summary = {
        findings: drafts.length,
        opportunities_created: created,
        homepage_status: home.status,
        robots_status: robots.status,
        sitemap_status: sitemap.status,
        failed_checks: failedChecks,
        final_url: home.url,
      };
      await supabase
        .from("audits")
        .update({
          status,
          finished_at: now(),
          summary,
          error: failedChecks
            ? [home.error, robots.error, sitemap.error].filter(Boolean).join(" | ")
            : null,
        })
        .eq("id", audit.id);
      await supabase
        .from("job_runs")
        .update({
          status: status === "failed" ? "failed" : "succeeded",
          finished_at: now(),
          error: status === "failed" ? "All checks failed" : null,
        })
        .eq("id", job.id);
      await supabase.from("change_events").insert({
        workspace_id: ws,
        entity: "audit",
        entity_id: audit.id,
        action: `audit_${status}`,
        detail: summary,
        actor: userId,
      });
      return { auditId: audit.id, status, summary };
    } catch (e) {
      const msg = (e as Error).message;
      await supabase
        .from("audits")
        .update({ status: "failed", finished_at: now(), error: msg })
        .eq("id", audit.id);
      await supabase
        .from("job_runs")
        .update({ status: "failed", finished_at: now(), error: msg })
        .eq("id", job.id);
      return { auditId: audit.id, status: "failed", summary: { error: msg } };
    }
  });
