import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema/auth";

/**
 * Hàm khởi tạo BetterAuth.
 * Ở môi trường Serverless/Edge như Cloudflare Pages, bạn không thể khởi tạo DB toàn cục (Global) dễ dàng mà thường gọi trong ngữ cảnh của mỗi Request.
 * Do đó, chúng ta truyền object env (biến môi trường chứa D1) vào để khởi tạo linh hoạt.
 */
import { getDb } from "@/db";

export function getAuth(fallbackEnv?: any) {
  let env = fallbackEnv || (process.env as any);
  try {
     const ctx = (globalThis as any)[Symbol.for("@cloudflare/next-on-pages/request-context")];
     if (ctx) env = ctx.env || env;
  } catch (e) {}

  const d1Binding = env && env.backing_score_prod ? env.backing_score_prod : undefined;
  const db = getDb(d1Binding, schema);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite", // D1 dựa trên lõi SQLite
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications
      }
    }),
    user: {
      additionalFields: {
        labels: {
          type: "string",
          required: false,
          defaultValue: "[]"
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      // Tính năng này giúp Appwrite di trú âm thầm sau này!
      autoSignIn: false 
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      }
    },
    // Chặn luồng gửi Cookie Secure trên Localhost
    trustedOrigins: ["http://localhost:3000"],
  });
}
