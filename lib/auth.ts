import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";
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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const adminSecret = ctx.headers?.get("x-admin-secret");
        if (adminSecret !== env.ADMIN_SECRET) {
          throw new APIError("BAD_REQUEST", {
            message: "Public signup is disabled. Contact administrator.",
          });
        }
      }
    }),
  },
});
