/**
 * Utility functions for building standardized Role-Based Access Control
 * (RBAC) definitions compatible with Appwrite Document Permissions.
 */

import { Permission, Role } from "./client";

/**
 * Returns the baseline permissions required for a standard piece of content.
 * The owner has full rights, while Admins and Content Managers have elevated
 * edit and delete rights.
 */
export function buildStandardPermissions(ownerId: string): string[] {
  return [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),

    // Note: Admin and Content Manager rights are now handled at the Collection 
    // level in Appwrite to avoid "Role not allowed" errors during creation by standard users.
  ];
}

/**
 * Returns the permissions for content that is explicitly published to
 * the world. Anyone can read, but edits are locked to the owner and
 * elevated staff.
 */
export function buildPublishedPermissions(ownerId: string): string[] {
  const std = buildStandardPermissions(ownerId);
  return [
    Permission.read(Role.any()), // Global Discovery Read Access
    ...std.filter(p => !p.startsWith('read(')), // Remove standard reads to avoid redundancy, although Appwrite handles overlap fine
  ];
}

/**
 * Returns permissions for Classroom data.
 * The teacher has full rights, students rely on the class membership.
 * Staff have global view/mod rights.
 */
export function buildClassroomPermissions(teacherId: string): string[] {
  return [
    // Teachers
    Permission.read(Role.user(teacherId)),
    Permission.update(Role.user(teacherId)),
    Permission.delete(Role.user(teacherId)),

    // Global Discovery Read Access for join checks
    Permission.read(Role.users()),

    // Admin override rights are handled at Collection level
  ];
}
