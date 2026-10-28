import { describe, expect, it } from "vitest";
import { matchingProperty } from "../lib/gsc-property";

describe("Search Console property matching", () => {
  it("prefers a verified domain property", () => {
    expect(matchingProperty("yabilocation.com", [
      { siteUrl: "https://yabilocation.com/", permissionLevel: "siteOwner" },
      { siteUrl: "sc-domain:yabilocation.com", permissionLevel: "siteFullUser" },
    ])?.siteUrl).toBe("sc-domain:yabilocation.com");
  });

  it("rejects unverified, subdomain, subpath, and HTTP properties", () => {
    expect(matchingProperty("yabilocation.com", [
      { siteUrl: "sc-domain:yabilocation.com", permissionLevel: "siteUnverifiedUser" },
      { siteUrl: "https://other.yabilocation.com/", permissionLevel: "siteOwner" },
      { siteUrl: "https://yabilocation.com/private/", permissionLevel: "siteOwner" },
      { siteUrl: "http://yabilocation.com/", permissionLevel: "siteOwner" },
    ])).toBeUndefined();
  });
});
