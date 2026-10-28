type SearchConsoleProperty = { siteUrl?: string; permissionLevel?: string };

/** Accept only a verified domain property or an exact root URL property. */
export function matchingProperty(domain: string, sites: SearchConsoleProperty[]): SearchConsoleProperty | undefined {
  const eligible = sites.filter(site => ["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(site.permissionLevel ?? ""));
  return eligible.find(site => site.siteUrl === `sc-domain:${domain}`)
    ?? eligible.find(site => {
      try {
        const url = new URL(site.siteUrl ?? "");
        return url.protocol === "https:" && url.hostname.toLowerCase() === domain &&
          url.pathname === "/" && !url.search && !url.hash;
      } catch { return false; }
    });
}
