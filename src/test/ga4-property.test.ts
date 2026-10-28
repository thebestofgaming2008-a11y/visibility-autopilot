import { describe, expect, it } from "vitest";
import { matchingWebStream } from "../lib/ga4-property";

describe("GA4 stream matching", () => {
  it("accepts only a site's HTTPS web stream", () => {
    expect(matchingWebStream("yabilocation.com", [
      { type: "ANDROID_APP_DATA_STREAM", webStreamData: { defaultUri: "https://yabilocation.com" } },
      { type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://other.example" } },
      { type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://www.yabilocation.com" } },
    ])).toBe("https://www.yabilocation.com");
  });
  it("rejects HTTP, sibling domains and invalid URLs", () => {
    expect(matchingWebStream("yabilocation.com", [
      { type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "http://yabilocation.com" } },
      { type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://notyabilocation.com" } },
      { type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "bad url" } },
    ])).toBeUndefined();
  });
});
