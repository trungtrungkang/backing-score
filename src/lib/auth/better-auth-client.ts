import { createAuthClient } from "better-auth/react";

export const betterAuthClient = createAuthClient({
    // Vercel auto-configures this, but we explicitly set it for clarity
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
});
