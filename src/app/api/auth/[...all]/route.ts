export const runtime = "edge";
import { getAuth } from "@/lib/auth/better-auth";
import { NextRequest } from "next/server";

// Dynamic route để nhận tất cả các request gửi đến API của Better-Auth
// Ví dụ: /api/auth/sign-in/email, /api/auth/session, v.v.

export async function GET(req: NextRequest) {
  const auth = getAuth(process.env as any);
  return auth.handler(req);
}

export async function POST(req: NextRequest) {
  const auth = getAuth(process.env as any);
  return auth.handler(req);
}

