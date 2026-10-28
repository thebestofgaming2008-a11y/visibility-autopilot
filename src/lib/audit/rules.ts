import type { ParsedPage, RobotsInfo } from "./parse";

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "medium" | "high";
export type FindingDraft = {
  code: string; title: string; severity: Severity; confidence: Confidence; category: string;
  url: string; recommendation: string; detail?: string; snippet?: string; httpStatus?: number;
  effort: number;
};

export type AuditInput = {
  siteLanguages: string[];
  home: { url: string; status: number | null; error?: string; chain: { url: string; status: number }[]; bytes: number; parsed: ParsedPage | null; robotsBlocked?: boolean };
  robots: { url: string; status: number | null; error?: string; info: RobotsInfo | null; body?: string };
  sitemap: { url: string; status: number | null; error?: string; count: number; isIndex: boolean; isUrlset: boolean; sample: string[] };
};

/** Turn observed facts into findings. Only flags what was actually observed; absence of optional markup is info. */
export function evaluate(i: AuditInput): FindingDraft[] {
  const f: FindingDraft[] = [];
  const h = i.home; const p = h.parsed; const u = h.url;

  if (h.error) f.push({ code: "home_unreachable", title: "Homepage could not be fetched", severity: "high", confidence: "medium", category: "availability", url: u, recommendation: "Check that the site is reachable over HTTPS from public networks. This may also be a network restriction on the audit runner — re-run before acting.", detail: h.error, effort: 2 });
  else if (h.status && h.status >= 400) f.push({ code: "home_status", title: `Homepage returned HTTP ${h.status}`, severity: "critical", confidence: "high", category: "availability", url: u, httpStatus: h.status, recommendation: "Restore a 200 response on the homepage.", effort: 2 });

  if (h.chain.length > 3) f.push({ code: "redirect_chain", title: `Redirect chain of ${h.chain.length - 1} hops`, severity: "low", confidence: "high", category: "technical", url: u, recommendation: "Point the entry URL directly to the final URL with a single 301.", snippet: h.chain.map((c) => `${c.status} ${c.url}`).join("\n"), effort: 2 });
  if (h.bytes > 1_500_000) f.push({ code: "page_weight", title: `Homepage HTML is ~${Math.round(h.bytes / 1024)} KB`, severity: "low", confidence: "medium", category: "performance", url: u, recommendation: "Reduce inline scripts/styles in the HTML document. This measures HTML only, not total transfer.", effort: 3 });

  if (p) {
    if (p.metaRobots && /noindex/i.test(p.metaRobots)) f.push({ code: "noindex", title: "Homepage has meta robots noindex", severity: "critical", confidence: "high", category: "indexability", url: u, snippet: p.snippets.metaRobots, recommendation: "Remove noindex unless the homepage is intentionally excluded from search.", effort: 1 });
    if (!p.title) f.push({ code: "title_missing", title: "No <title> element", severity: "high", confidence: "high", category: "on_page", url: u, recommendation: "Add a unique, descriptive title in the page's primary language (French).", effort: 1 });
    else if (p.title.length > 65 || p.title.length < 15) f.push({ code: "title_length", title: `Title length is ${p.title.length} characters`, severity: "low", confidence: "medium", category: "on_page", url: u, snippet: p.snippets.title, recommendation: "Aim for roughly 30–60 characters so it is not truncated in results. Keep it factual; no keyword stuffing.", effort: 1 });
    if (!p.metaDescription) f.push({ code: "meta_description_missing", title: "No meta description", severity: "medium", confidence: "high", category: "on_page", url: u, recommendation: "Write a factual French meta description (~140–160 chars) describing the actual offer.", effort: 1 });
    if (!p.canonical) f.push({ code: "canonical_missing", title: "No canonical link", severity: "low", confidence: "high", category: "indexability", url: u, recommendation: "Add a self-referencing rel=canonical.", effort: 1 });
    else {
      try {
        const ch = new URL(p.canonical).hostname.replace(/^www\./, ""); const hh = new URL(u).hostname.replace(/^www\./, "");
        if (ch !== hh) f.push({ code: "canonical_offsite", title: "Canonical points to another host", severity: "high", confidence: "high", category: "indexability", url: u, snippet: p.snippets.canonical, recommendation: "Canonical should reference this site's own URL.", effort: 1 });
      } catch { /* */ }
    }
    const h1 = p.headings.filter((x) => x.level === 1);
    if (h1.length === 0) f.push({ code: "h1_missing", title: "No H1 heading in served HTML", severity: "medium", confidence: "medium", category: "on_page", url: u, recommendation: "Add one descriptive H1. If headings are rendered by JavaScript only, consider server rendering.", effort: 1 });
    else if (h1.length > 1) f.push({ code: "h1_multiple", title: `${h1.length} H1 headings`, severity: "low", confidence: "medium", category: "on_page", url: u, snippet: h1.map((x) => x.text).join(" | "), recommendation: "Prefer a single primary H1.", effort: 1 });
    if (!p.lang) f.push({ code: "html_lang_missing", title: "No lang attribute on <html>", severity: "low", confidence: "high", category: "international", url: u, snippet: p.snippets.html, recommendation: "Set lang=\"fr-BE\" (or the actual page language).", effort: 1 });
    if (i.siteLanguages.length > 1 && p.hreflang.length === 0) f.push({ code: "hreflang_none", title: "No hreflang annotations observed on homepage", severity: "info", confidence: "medium", category: "international", url: u, recommendation: `Site config lists ${i.siteLanguages.join(", ")}. If translated equivalents exist, link them with hreflang. If only one language is published, no action needed.`, effort: 2 });
    if (p.jsonLdBlocks === 0) f.push({ code: "jsonld_none", title: "No JSON-LD structured data detected", severity: "info", confidence: "low", category: "structured_data", url: u, recommendation: "Optional: Organization/LocalBusiness markup may help entity understanding. Only mark up facts visible on the page; no fake address for a business without a customer-facing premises.", effort: 2 });
    if (p.jsonLdInvalid > 0) f.push({ code: "jsonld_invalid", title: `${p.jsonLdInvalid} JSON-LD block(s) failed to parse`, severity: "medium", confidence: "high", category: "structured_data", url: u, recommendation: "Fix the JSON syntax so the markup can be read.", effort: 1 });
    if (!p.og["og:title"] || !p.og["og:image"]) f.push({ code: "og_incomplete", title: "Open Graph tags incomplete", severity: "low", confidence: "high", category: "social", url: u, detail: `og:title ${p.og["og:title"] ? "present" : "missing"}, og:image ${p.og["og:image"] ? "present" : "missing"}`, recommendation: "Add og:title, og:description and og:image for link previews.", effort: 1 });
  }

  const r = i.robots;
  if (r.error) f.push({ code: "robots_unavailable", title: "robots.txt check unavailable", severity: "info", confidence: "low", category: "crawl", url: r.url, detail: r.error, recommendation: "Re-run the audit; the fetch failed before a response.", effort: 1 });
  else if (r.status === 404) f.push({ code: "robots_missing", title: "robots.txt returns 404", severity: "low", confidence: "high", category: "crawl", url: r.url, httpStatus: 404, recommendation: "Optional but useful: publish robots.txt with a Sitemap: line.", effort: 1 });
  else if (r.info?.disallowAllForStar) f.push({ code: "robots_block_all", title: "robots.txt disallows all crawlers", severity: "critical", confidence: "high", category: "crawl", url: r.url, httpStatus: r.status ?? undefined, snippet: r.body?.slice(0, 400), recommendation: "Remove 'Disallow: /' for User-agent: * unless the site must stay hidden.", effort: 1 });

  const s = i.sitemap;
  if (s.error) f.push({ code: "sitemap_unavailable", title: "Sitemap check unavailable", severity: "info", confidence: "low", category: "crawl", url: s.url, detail: s.error, recommendation: "Re-run the audit.", effort: 1 });
  else if (s.status !== 200 || (!s.isIndex && !s.isUrlset)) f.push({ code: "sitemap_missing", title: `No valid XML sitemap at ${s.url}`, severity: "medium", confidence: "medium", category: "crawl", url: s.url, httpStatus: s.status ?? undefined, recommendation: "Publish an XML sitemap and reference it in robots.txt. (Submission to search engines stays manual.)", effort: 2 });
  else if (s.count === 0) f.push({ code: "sitemap_empty", title: "Sitemap contains no URLs", severity: "medium", confidence: "high", category: "crawl", url: s.url, recommendation: "Populate the sitemap with canonical URLs.", effort: 2 });

  return f;
}

const SEV_IMPACT: Record<Severity, number> = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };
const CONF_NUM: Record<Confidence, number> = { low: 2, medium: 3, high: 5 };
export const impactOf = (s: Severity) => SEV_IMPACT[s];
export const confidenceOf = (c: Confidence) => CONF_NUM[c];
/** Priority = Impact × Confidence / Effort. */
export const priorityScore = (impact: number, confidence: number, effort: number) =>
  Math.round(((impact * confidence) / Math.max(1, effort)) * 10) / 10;
