import { v } from "convex/values";
import { query } from "./_generated/server";

export const get = query({
  args: {},
  returns: v.object({ googleSignIn: v.boolean() }),
  handler: async () => ({ googleSignIn: Boolean(process.env["AUTH_GOOGLE_ID"] && process.env["AUTH_GOOGLE_SECRET"]) }),
});
