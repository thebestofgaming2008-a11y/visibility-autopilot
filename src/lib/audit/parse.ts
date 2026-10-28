// Dependency-free HTML/robots/sitemap parsing (runs on the edge worker).

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[(m[1] ?? "").toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? "");
  return out;
}

export type ParsedPage = {
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  metaRobots: string | null;
  hreflang: { lang: string; href: string }[];
  headings: { level: number; text: string }[];
  jsonLdTypes: string[];
  jsonLdBlocks: number;
  jsonLdInvalid: number;
  og: Record<string, string>;
  links: { href: string; text: string; internal: boolean }[];
  linkCount: number;
  snippets: Record<string, string>;
};

export function parseHtml(html: string, baseUrl: string): ParsedPage {
  const head = html.slice(0, 400_000);
  const snippets: Record<string, string> = {};
  snippets["document"] = head.slice(0, 400);
  const htmlTag = head.match(/<html\b[^>]*>/i)?.[0];
  const lang = htmlTag ? (attrs(htmlTag)["lang"] ?? null) : null;
  if (htmlTag) snippets["html"] = htmlTag.slice(0, 200);
  const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = t ? decode(t[1] ?? "") : null;
  if (t) snippets["title"] = t[0].slice(0, 300);
  let metaDescription: string | null = null,
    metaRobots: string | null = null;
  const og: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const name = (a["name"] ?? a["property"] ?? "").toLowerCase();
    if (name === "description") {
      metaDescription = a["content"] ?? "";
      snippets["metaDescription"] = m[0].slice(0, 300);
    }
    if (name === "robots") {
      metaRobots = a["content"] ?? "";
      snippets["metaRobots"] = m[0].slice(0, 200);
    }
    if (name.startsWith("og:")) og[name] = a["content"] ?? "";
  }
  let canonical: string | null = null;
  const hreflang: { lang: string; href: string }[] = [];
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a["rel"] ?? "").toLowerCase();
    if (rel === "canonical") {
      canonical = a["href"] ? abs(a["href"], baseUrl) : null;
      snippets["canonical"] = m[0].slice(0, 300);
    }
    if (rel === "alternate" && a["hreflang"] && a["href"])
      hreflang.push({ lang: a["hreflang"], href: abs(a["href"], baseUrl) });
  }
  const headings: { level: number; text: string }[] = [];
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
    headings.push({
      level: Number(m[1]),
      text: decode((m[2] ?? "").replace(/<[^>]+>/g, " ")).slice(0, 200),
    });
  const jsonLdTypes: string[] = [];
  let jsonLdBlocks = 0,
    jsonLdInvalid = 0;
  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    jsonLdBlocks++;
    try {
      const collect = (n: unknown): void => {
        if (Array.isArray(n)) return n.forEach(collect);
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          if (o["@type"])
            ([] as unknown[]).concat(o["@type"]).forEach((x) => jsonLdTypes.push(String(x)));
          if (o["@graph"]) collect(o["@graph"]);
        }
      };
      collect(JSON.parse(m[1] ?? ""));
    } catch {
      jsonLdInvalid++;
    }
  }
  const host = new URL(baseUrl).hostname.replace(/^www\./, "");
  const links: ParsedPage["links"] = [];
  let linkCount = 0;
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = attrs(m[1] ?? "");
    if (!a["href"] || a["href"].startsWith("#") || /^(javascript|mailto|tel):/i.test(a["href"]))
      continue;
    linkCount++;
    if (links.length < 40) {
      const href = abs(a["href"], baseUrl);
      let internal = false;
      try {
        internal = new URL(href).hostname.replace(/^www\./, "") === host;
      } catch {
        /* */
      }
      links.push({
        href,
        text: decode((m[2] ?? "").replace(/<[^>]+>/g, " ")).slice(0, 80),
        internal,
      });
    }
  }
  return {
    lang,
    title,
    metaDescription,
    canonical,
    metaRobots,
    hreflang,
    headings,
    jsonLdTypes,
    jsonLdBlocks,
    jsonLdInvalid,
    og,
    links,
    linkCount,
    snippets,
  };
}

function abs(href: string, base: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export type RobotsInfo = {
  sitemaps: string[];
  disallowAllForStar: boolean;
  starRules: { allow: string[]; disallow: string[] };
};

export function parseRobots(txt: string): RobotsInfo {
  const sitemaps: string[] = [];
  const star = { allow: [] as string[], disallow: [] as string[] };
  let agents: string[] = [];
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === "sitemap") {
      sitemaps.push(v);
      continue;
    }
    if (k === "user-agent") {
      if (!lastWasAgent) agents = [];
      agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (agents.includes("*")) {
      if (k === "disallow" && v) star.disallow.push(v);
      if (k === "allow" && v) star.allow.push(v);
    }
  }
  return {
    sitemaps,
    starRules: star,
    disallowAllForStar: star.disallow.includes("/") && !star.allow.includes("/"),
  };
}

/** Longest-match robots evaluation for user-agent *. */
export function robotsAllows(info: RobotsInfo | null, path: string): boolean {
  if (!info) return true;
  let best = { len: -1, allow: true };
  for (const d of info.starRules.disallow)
    if (path.startsWith(d) && d.length > best.len) best = { len: d.length, allow: false };
  for (const a of info.starRules.allow)
    if (path.startsWith(a) && a.length >= best.len) best = { len: a.length, allow: true };
  return best.allow;
}

export function parseSitemap(xml: string) {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decode(m[1] ?? ""));
  const isIndex = /<sitemapindex\b/i.test(xml);
  const isUrlset = /<urlset\b/i.test(xml);
  return { isIndex, isUrlset, count: locs.length, sample: locs.slice(0, 10) };
}
