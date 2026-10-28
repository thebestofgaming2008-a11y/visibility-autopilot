import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { claimLegacyForVerifiedGoogle } from "./legacyImport";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const googleConfigured = Boolean(process.env["AUTH_GOOGLE_ID"] && process.env["AUTH_GOOGLE_SECRET"]);

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, ...(googleConfigured ? [Google({
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        emailVerified: profile.email_verified === true,
      };
    },
  })] : [])],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, type, provider, profile }) {
      if (type === "oauth" && provider.id === "google" && profile.emailVerified === true && typeof profile.email === "string")
        await claimLegacyForVerifiedGoogle(ctx as MutationCtx, userId as Id<"users">, profile.email);
    },
  },
});
