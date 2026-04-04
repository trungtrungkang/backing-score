export const runtime = "edge";
import { getAuth } from "@/lib/auth/better-auth";
import { NextRequest } from "next/server";

// Dynamic route để nhận tất cả các request gửi đến API của Better-Auth
// Ví dụ: /api/auth/sign-in/email, /api/auth/session, v.v.

import { getRequestContext } from "@cloudflare/next-on-pages";

export async function GET(req: NextRequest) {
  let env = process.env as any;
  try {
     env = getRequestContext().env as any;
  } catch (e) {}

  const auth = getAuth(env);
  return auth.handler(req);
}

export async function POST(req: NextRequest) {
  let env = process.env as any;
  try {
     env = getRequestContext().env as any;
  } catch (e) {}

  const auth = getAuth(env);
  return auth.handler(req);
}

