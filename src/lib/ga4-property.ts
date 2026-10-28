type Stream = { type?: string; webStreamData?: { defaultUri?: string } };

/** A GA4 property is relevant only when a web stream names this site's host. */
export function matchingWebStream(domain: string, streams: Stream[]): string | undefined {
  for (const stream of streams) {
    if (stream.type !== "WEB_DATA_STREAM") continue;
    const value = stream.webStreamData?.defaultUri;
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && [domain, `www.${domain}`].includes(url.hostname.toLowerCase())) return value;
    } catch { /* Invalid provider URL cannot verify a site. */ }
  }
  return undefined;
}
