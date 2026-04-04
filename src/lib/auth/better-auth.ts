import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/schema/auth";
import { sendEmail } from "@/lib/resend";
import React from "react";

/**
 * Hàm khởi tạo BetterAuth.
 */
import { getDb } from "@/db";

export function getAuth(fallbackEnv?: any) {
  const env = fallbackEnv || (process.env as any);
  const db = getDb(undefined, schema);

  return betterAuth({
    trustedOrigins: [
      "https://backingscore.com", 
      "https://www.backingscore.com", 
      "http://localhost:3000",
      "https://safemeet-api-fuk.pages.dev"
    ],
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
      autoSignIn: true, // Tự động tạo Session sau khi người dùng vừa Signup thành công
      sendResetPassword: async ({ user, url, token }: any) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your password for Backing & Score",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Password Reset</h2>
              <p>Hello ${user.name},</p>
              <p>You requested a password reset for your Backing & Score account. Please click the button below to set a new password:</p>
              <a href="${url}" style="display:inline-block; padding:10px 20px; background-color:#0070f3; color:#fff; text-decoration:none; border-radius:5px;">Reset Password</a>
              <p>If you did not request this, please ignore this email.</p>
            </div>
          `,
        });
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }: any) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your email address for Backing & Score",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
              <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #1a202c;">Verify your Email</h2>
                <p style="color: #4a5568; line-height: 1.6;">Welcome to <strong>Backing & Score</strong>. To complete your registration and unlock all platform features, please click the verification button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
                </div>
                <p style="color: #4a5568; font-size: 14px;">Or copy and paste this link into your browser: <br><a href="${url}" style="color: #3b82f6;">${url}</a></p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #a0aec0; font-size: 12px;">This verification link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
              </div>
            </div>
          `,
        });
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      }
    },
  });
}
