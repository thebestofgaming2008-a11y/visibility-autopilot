import { describe, expect, it } from "vitest";
import { entryTarget, isRecoveryCallback } from "@/lib/auth-callback";

describe("auth email callbacks", () => {
  it("preserves recovery tokens when the provider lands on the site root", () => {
    const hash = "#access_token=test-token&refresh_token=test-refresh&type=recovery";
    expect(entryTarget("", hash)).toBe(`/auth${hash}`);
    expect(isRecoveryCallback("", hash)).toBe(true);
  });

  it("recognizes a PKCE recovery callback", () => {
    expect(entryTarget("?code=abc&recovery=1", "")).toBe("/auth?code=abc&recovery=1");
    expect(isRecoveryCallback("?code=abc&recovery=1", "")).toBe(true);
  });

  it("sends ordinary entry traffic to Overview", () => {
    expect(entryTarget("", "")).toBe("/overview");
  });
});
