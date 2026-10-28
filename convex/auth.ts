import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";

const googleConfigured = Boolean(process.env["AUTH_GOOGLE_ID"] && process.env["AUTH_GOOGLE_SECRET"]);

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, ...(googleConfigured ? [Google] : [])],
});
