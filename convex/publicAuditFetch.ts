"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { safeFetchPinned } from "../src/lib/audit/ssrf-node";

export const fetchPinned = internalAction({
  args: { url: v.string(), allowedRoot: v.string() },
  returns: v.object({
    requestedUrl: v.string(),
    finalUrl: v.string(),
    status: v.number(),
    chain: v.array(v.object({ url: v.string(), status: v.number() })),
    body: v.string(),
    bytes: v.number(),
    truncated: v.boolean(),
    durationMs: v.number(),
    contentType: v.union(v.string(), v.null()),
    headers: v.record(v.string(), v.string()),
  }),
  handler: async (_ctx, args) => safeFetchPinned(args.url, args.allowedRoot),
});
