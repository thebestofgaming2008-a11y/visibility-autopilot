import { promises as dns } from "node:dns";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { LIMITS, USER_AGENT, normalizeDomain, type SafeFetchResult } from "./ssrf";

type Address = { address: string; family: 4 | 6 };

async function resolveWithDeadline(host: string, signal: AbortSignal): Promise<Address[]> {
  if (signal.aborted) throw signal.reason;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    dns.lookup(host, { all: true, verbatim: true })
      .then((addresses) => resolve(addresses as Address[]), reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** Reject the entire DNS answer set if any address is not public. */
export function selectPinnedAddress(addresses: Address[]): Address {
  if (!addresses.length) throw new Error("No DNS records for host");
  for (const candidate of addresses) {
    if (!ipaddr.isValid(candidate.address)) throw new Error("Invalid DNS address");
    const parsed = ipaddr.parse(candidate.address);
    if (parsed.kind() !== `ipv${candidate.family}` || parsed.range() !== "unicast")
      throw new Error(`Blocked non-public IP ${candidate.address}`);
  }
  return addresses.find((candidate) => candidate.family === 4) ?? addresses[0]!;
}

type PinnedResponse = {
  status: number;
  location: string | null;
  body: string;
  bytes: number;
  truncated: boolean;
  contentType: string | null;
  headers: Record<string, string>;
};

function requestPinned(url: URL, address: Address, signal: AbortSignal): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      agent: false,
      servername: url.hostname,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.5",
        "accept-encoding": "identity",
      },
    }, async (res) => {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(res.headers))
        if (typeof value === "string") headers[name] = value;
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;
      const contentType = typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : null;
      const contentEncoding = res.headers["content-encoding"];
      if (contentEncoding && contentEncoding !== "identity") {
        res.destroy();
        reject(new Error(`Unsupported content encoding: ${contentEncoding}`));
        return;
      }
      if (status >= 300 && status < 400 && location) {
        res.destroy();
        resolve({ status, location, body: "", bytes: 0, truncated: false, contentType, headers });
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const part of res) {
          const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
          bytes += chunk.length;
          if (bytes > LIMITS.maxBytes) {
            res.destroy();
            resolve({ status, location, body: "", bytes, truncated: true, contentType, headers });
            return;
          }
          chunks.push(chunk);
        }
        resolve({ status, location, body: Buffer.concat(chunks).toString("utf8"), bytes, truncated: false, contentType, headers });
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetchPinned(url: string, allowedRoot: string): Promise<SafeFetchResult> {
  const root = normalizeDomain(allowedRoot);
  const started = Date.now();
  const signal = AbortSignal.timeout(LIMITS.timeoutMs);
  const chain: SafeFetchResult["chain"] = [];
  let current = url;
  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    const target = new URL(current);
    if (target.protocol !== "https:") throw new Error(`Non-HTTPS URL blocked: ${current}`);
    if (target.port && target.port !== "443") throw new Error("Non-standard port blocked");
    if (target.username || target.password) throw new Error("Credentials in URL blocked");
    const host = normalizeDomain(target.hostname);
    if (host !== root && !host.endsWith(`.${root}`)) throw new Error(`Redirect off-domain blocked: ${host}`);
    const pinned = selectPinnedAddress(await resolveWithDeadline(host, signal));
    const response = await requestPinned(target, pinned, signal);
    chain.push({ url: current, status: response.status });
    if (response.status >= 300 && response.status < 400 && response.location) {
      current = new URL(response.location, current).toString();
      continue;
    }
    return {
      requestedUrl: url,
      finalUrl: current,
      status: response.status,
      chain,
      body: response.body,
      bytes: response.bytes,
      truncated: response.truncated,
      durationMs: Date.now() - started,
      contentType: response.contentType,
      headers: response.headers,
    };
  }
  throw new Error(`Too many redirects (> ${LIMITS.maxRedirects})`);
}
