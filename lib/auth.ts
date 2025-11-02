import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/lib/env";
import { db } from "./db/client";
import { schema } from "./db/schema";

export type Session = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires?: string;
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: env.VERCEL_URL ? [env.VERCEL_URL] : undefined,
  secret: env.AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [nextCookies()],
  advanced: {
    hooks: {
      // Disable public signup - only allow via admin script
      signUp: {
        before: async (ctx) => {
          // Check if request has admin secret token
          const adminSecret = ctx.headers?.get("x-admin-secret");
          if (adminSecret !== env.ADMIN_SECRET) {
            throw new Error("Public signup is disabled. Contact administrator.");
          }
        },
      },
    },
  },
});
