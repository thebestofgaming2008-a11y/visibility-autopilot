import { describe, expect, it } from "vitest";
import { safeFetchPinned, selectPinnedAddress } from "@/lib/audit/ssrf-node";

describe("pinned audit transport", () => {
  it("rejects a mixed public and private DNS answer set", () => {
    expect(() => selectPinnedAddress([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ])).toThrow("non-public IP");
  });

  it("rejects mapped and reserved IPv6 addresses", () => {
    expect(() => selectPinnedAddress([{ address: "::ffff:127.0.0.1", family: 6 }])).toThrow("non-public IP");
    expect(() => selectPinnedAddress([{ address: "2001:db8::1", family: 6 }])).toThrow("non-public IP");
  });

  it("selects one verified public address for the actual connection", () => {
    expect(selectPinnedAddress([
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "8.8.8.8", family: 4 },
    ])).toEqual({ address: "8.8.8.8", family: 4 });
  });

  it("blocks unsafe URLs before DNS resolution", async () => {
    await expect(safeFetchPinned("http://example.com/", "example.com")).rejects.toThrow("Non-HTTPS");
    await expect(safeFetchPinned("https://other.com/", "example.com")).rejects.toThrow("off-domain");
  });
});
