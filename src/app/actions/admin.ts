"use server";

import { Client as ServerClient, Users, Account } from "node-appwrite";
import type { UserRole } from "@/lib/auth/roles";

/**
 * Validates that the provided Appwrite Session JWT belongs to a user
 * with at least one of the specified roles. Throws if unauthorized.
 */
export async function requireRole(jwt: string, allowedRoles: UserRole[]) {
  if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || !process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
    throw new Error("Missing Server Configuration for Appwrite.");
  }

  try {
    const jwtClient = new ServerClient()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
      .setJWT(jwt);
    
    const jwtAccount = new Account(jwtClient);
    const user = await jwtAccount.get();
    
    const hasAllowed = allowedRoles.some(role => user.labels?.includes(role));
    if (!hasAllowed) {
      throw new Error(`Unauthorized: requires one of [${allowedRoles.join(", ")}].`);
    }
    return user;
  } catch (error: any) {
    if (error?.code === 401) {
      throw new Error("Unauthorized: Invalid or expired JWT.");
    }
    throw error;
  }
}

/** Shorthand: require admin role. */
export async function requireAdmin(jwt: string) {
  return requireRole(jwt, ["admin"]);
}

/** Shorthand: require admin or content_manager role. */
export async function requireContentManager(jwt: string) {
  return requireRole(jwt, ["admin", "content_manager"]);
}

/**
 * Retrieves the Administrative API Key Client
 */
function getAdminClient() {
  return new ServerClient()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
}

/**
 * Lists all registered users in the Appwrite project.
 * Only callable by verified Admins.
 */
export async function listAllUsers(jwt: string) {
  await requireAdmin(jwt);
  
  const adminClient = getAdminClient();
  const usersService = new Users(adminClient);
  
  const result = await usersService.list();
  
  // Return serializable data
  return result.users.map((u) => ({
    id: u.$id,
    name: u.name,
    email: u.email,
    registration: u.registration,
    labels: u.labels || [],
  }));
}

/**
 * Toggles a specific string label (e.g. "admin", "creator") on a target user.
 * Only callable by verified Admins.
 */
export async function toggleUserLabel(jwt: string, targetUserId: string, label: string, add: boolean) {
  await requireAdmin(jwt);

  const adminClient = getAdminClient();
  const usersService = new Users(adminClient);
  
  const targetUser = await usersService.get(targetUserId);
  let labels = targetUser.labels || [];
  
  if (add && !labels.includes(label)) {
    labels.push(label);
  } else if (!add && labels.includes(label)) {
    labels = labels.filter((l) => l !== label);
  }
  
  await usersService.updateLabels(targetUserId, labels);
  return { success: true, newLabels: labels };
}
