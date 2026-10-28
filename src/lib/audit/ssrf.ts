// SSRF guard for public read-only audits. HTTPS only, public hostnames only,
// DNS answers checked against private/reserved ranges, capped redirects/body/time.

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  if (!DOMAIN_RE.test(d)) throw new Error(`Invalid domain: ${input}`);
  if (
    /\.(local|localhost|internal|lan|home|corp|test|invalid|example)$/.test(d) ||
    d === "localhost"
  )
    throw new Error("Reserved hostname not allowed");
  return d;
}

export function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return true;
  const a = p[0] ?? 0,
    b = p[1] ?? 0;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2 || b === 88)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && p[2] === 113) ||
    a >= 224
  );
}

export function isPrivateIPv6(ip: string): boolean {
  const x = ip.toLowerCase();
  if (
    x === "::" ||
    x === "::1" ||
    x.startsWith("2001:db8:") ||
    x.startsWith("2002:") ||
    x.startsWith("64:ff9b:")
  )
    return true;
  if (
    x.startsWith("fc") ||
    x.startsWith("fd") ||
    x.startsWith("fe8") ||
    x.startsWith("fe9") ||
    x.startsWith("fea") ||
    x.startsWith("feb") ||
    x.startsWith("ff")
  )
    return true;
  const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIPv4(m[1] ?? "");
  return false;
}

/** Resolve via DNS-over-HTTPS (workers have no dns module) and reject private answers. */
export async function assertPublicHost(host: string, signal?: AbortSignal): Promise<string[]> {
  normalizeDomain(host);
  const ips: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      {
        headers: { accept: "application/dns-json" },
        signal: signal ?? AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
    const j = (await res.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of j.Answer ?? []) {
      if (a.type === 1) {
        if (isPrivateIPv4(a.data)) throw new Error(`Blocked private IP ${a.data}`);
        ips.push(a.data);
      }
      if (a.type === 28) {
        if (isPrivateIPv6(a.data)) throw new Error(`Blocked private IP ${a.data}`);
        ips.push(a.data);
      }
    }
  }
  if (!ips.length) throw new Error(`No public DNS records for ${host}`);
  return ips;
}

export type SafeFetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  chain: { url: string; status: number }[];
  body: string;
  bytes: number;
  truncated: boolean;
  durationMs: number;
  contentType: string | null;
  headers: Record<string, string>;
};

export const LIMITS = { maxRedirects: 5, maxBytes: 2_000_000, timeoutMs: 12_000 };
export const USER_AGENT = "OmniVisibilityAudit/1.0 (+public read-only audit)";

export async function safeFetch(url: string, allowedRoot: string): Promise<SafeFetchResult> {
  const started = Date.now();
  const signal = AbortSignal.timeout(LIMITS.timeoutMs);
  const chain: { url: string; status: number }[] = [];
  let current = url;
  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:") throw new Error(`Non-HTTPS URL blocked: ${current}`);
    if (u.port && u.port !== "443") throw new Error("Non-standard port blocked");
    if (u.username || u.password) throw new Error("Credentials in URL blocked");
    const host = u.hostname.toLowerCase();
    // Only follow redirects within the audited domain and its subdomains.
    if (host !== allowedRoot && !host.endsWith("." + allowedRoot))
      throw new Error(`Redirect off-domain blocked: ${host}`);
    await assertPublicHost(host, signal);
    const res = await fetch(current, {
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.5",
      },
      signal,
    });
    chain.push({ url: current, status: res.status });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      continue;
    }
    const { text, bytes, truncated } = await readCapped(res);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return {
      requestedUrl: url,
      finalUrl: current,
      status: res.status,
      chain,
      body: text,
      bytes,
      truncated,
      durationMs: Date.now() - started,
      contentType: res.headers.get("content-type"),
      headers,
    };
  }
  throw new Error(`Too many redirects (> ${LIMITS.maxRedirects})`);
}

async function readCapped(res: Response) {
  if (!res.body) return { text: "", bytes: 0, truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > LIMITS.maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.byteLength;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(all), bytes, truncated };
}
