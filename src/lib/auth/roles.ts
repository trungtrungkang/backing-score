/**
 * Centralized Role-Based Access Control (RBAC) utilities.
 *
 * Roles are stored as Appwrite user labels (string[]).
 * This module provides type-safe helpers used across client and server code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "content_manager" | "creator" | "wiki_editor";

/** All recognized roles in priority order (highest first). */
export const ALL_ROLES: UserRole[] = ["admin", "content_manager", "creator", "wiki_editor"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if the user has a specific role. */
export function hasRole(labels: string[] | undefined, role: UserRole): boolean {
  return !!labels?.includes(role);
}

/** Check if the user has *any* of the given roles. */
export function hasAnyRole(labels: string[] | undefined, roles: UserRole[]): boolean {
  return roles.some((r) => labels?.includes(r));
}

// ---------------------------------------------------------------------------
// Semantic shortcuts — use these in components & server actions
// ---------------------------------------------------------------------------

/** Can access /admin/* routes (Admin or Content Manager). */
export function canAccessAdmin(labels: string[] | undefined): boolean {
  return hasAnyRole(labels, ["admin", "content_manager"]);
}

/** Can manage (edit/delete/publish) ANY project/collection. */
export function canManageContent(labels: string[] | undefined): boolean {
  return hasAnyRole(labels, ["admin", "content_manager"]);
}

/** Can create new projects (Admin, Content Manager, or Creator). */
export function canCreate(labels: string[] | undefined): boolean {
  return hasAnyRole(labels, ["admin", "content_manager", "creator"]);
}

/** Can edit wiki content (Admin or Wiki Editor). */
export function canEditWiki(labels: string[] | undefined): boolean {
  return hasAnyRole(labels, ["admin", "wiki_editor"]);
}

/** Is a full Admin (highest privilege). */
export function isAdmin(labels: string[] | undefined): boolean {
  return hasRole(labels, "admin");
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: "Admin",
  content_manager: "Content Manager",
  creator: "Creator",
  wiki_editor: "Wiki Editor",
};

/** Get a human-readable display name for a role. */
export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DISPLAY_NAMES[role] ?? role;
}

/** Get the highest-priority role for a user (for badge display). */
export function getPrimaryRole(labels: string[] | undefined): UserRole | null {
  if (!labels) return null;
  for (const role of ALL_ROLES) {
    if (labels.includes(role)) return role;
  }
  return null;
}
