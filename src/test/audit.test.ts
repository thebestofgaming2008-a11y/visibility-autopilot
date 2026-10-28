import { afterEach, describe, expect, it, vi } from "vitest";
import { isPrivateIPv4, isPrivateIPv6, normalizeDomain, safeFetch } from "@/lib/audit/ssrf";
import { parseHtml, parseRobots, robotsAllows, parseSitemap } from "@/lib/audit/parse";
import { evaluate, priorityScore, type AuditInput } from "@/lib/audit/rules";

afterEach(() => vi.unstubAllGlobals());

describe("public audit network limits", () => {
  it("rejects unsafe domains and addresses", () => {
    expect(() => normalizeDomain("http://localhost:8080")).toThrow();
    expect(() => normalizeDomain("https://127.0.0.1")).toThrow();
    expect(isPrivateIPv4("10.0.0.1")).toBe(true);
    expect(isPrivateIPv4("172.16.2.3")).toBe(true);
    expect(isPrivateIPv4("169.254.1.2")).toBe(true);
    expect(isPrivateIPv4("192.0.2.1")).toBe(true);
    expect(isPrivateIPv4("198.51.100.1")).toBe(true);
    expect(isPrivateIPv4("203.0.113.1")).toBe(true);
    expect(isPrivateIPv6("::1")).toBe(true);
    expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
  });

  it("blocks off-domain redirects before fetching the destination", async () => {
    const fetch = vi.fn(async (input: string) => {
      if (input.includes("cloudflare-dns.com"))
        return new Response(JSON.stringify({ Answer: [{ type: 1, data: "93.184.215.14" }] }), {
          status: 200,
        });
      return new Response(null, {
        status: 302,
        headers: { location: "https://private.example.net/" },
      });
    });
    vi.stubGlobal("fetch", fetch);
    await expect(safeFetch("https://example.com/", "example.com")).rejects.toThrow("off-domain");
    expect(fetch.mock.calls.filter(([url]) => !url.includes("cloudflare-dns.com"))).toHaveLength(1);
  });

  it("rejects non-HTTPS and private DNS answers", async () => {
    await expect(safeFetch("http://example.com/", "example.com")).rejects.toThrow("Non-HTTPS");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ Answer: [{ type: 1, data: "127.0.0.1" }] }), {
            status: 200,
          }),
      ),
    );
    await expect(safeFetch("https://example.com/", "example.com")).rejects.toThrow("private IP");
  });
});

describe("audit evidence rules", () => {
  const input = (): AuditInput => ({
    siteLanguages: ["fr-BE", "nl-BE"],
    home: {
      url: "https://example.com/",
      status: 200,
      chain: [],
      bytes: 1000,
      parsed: parseHtml(
        '<html lang="fr-BE"><head><title>Location utilitaires professionnels mensuelle</title></head><body><h1>Location utilitaires</h1></body></html>',
        "https://example.com/",
      ),
    },
    robots: {
      url: "https://example.com/robots.txt",
      status: 200,
      info: parseRobots("User-agent: *\nAllow: /"),
      body: "User-agent: *\nAllow: /",
    },
    sitemap: {
      url: "https://example.com/sitemap.xml",
      status: 200,
      ...parseSitemap("<urlset><url><loc>https://example.com/</loc></url></urlset>"),
    },
  });
  it("respects a robots block", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /\nAllow: /public");
    expect(robotsAllows(robots, "/")).toBe(false);
    expect(robotsAllows(robots, "/public")).toBe(true);
  });
  it("treats absent optional JSON-LD as information", () => {
    const findings = evaluate(input());
    expect(findings.find((f) => f.code === "jsonld_none")?.severity).toBe("info");
    expect(findings.some((f) => f.code === "home_unreachable")).toBe(false);
    expect(priorityScore(4, 5, 2)).toBe(10);
  });
  it("never infers page markup after a failed fetch", () => {
    const state = input();
    state.home.parsed = null;
    state.home.error = "Network unavailable";
    const codes = evaluate(state).map((f) => f.code);
    expect(codes).toContain("home_unreachable");
    expect(codes).not.toContain("title_missing");
    expect(codes).not.toContain("jsonld_none");
  });
  it("does not call a robots-blocked homepage unreachable", () => {
    const state = input();
    state.home.parsed = null;
    state.home.error = "Skipped: robots.txt denies homepage crawling";
    state.home.robotsBlocked = true;
    expect(evaluate(state).some((f) => f.code === "home_unreachable")).toBe(false);
  });
});
