import { Role } from "@prisma/client";

const ASSIGNABLE_ROLES: Role[] = [Role.ADMIN, Role.SENIOR_MANAGER, Role.MANAGER, Role.EMPLOYEE];

export function parseRole(value: string | null | undefined, fallback: Role = Role.EMPLOYEE): Role | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return fallback;
  if (normalized === "SENIOR_MANAGER" || normalized === "SENIORMANAGER" || normalized === "SR_MANAGER") {
    return Role.SENIOR_MANAGER;
  }
  if (ASSIGNABLE_ROLES.includes(normalized as Role)) return normalized as Role;
  return null;
}

export function isAssignableRole(role: string): role is Role {
  return ASSIGNABLE_ROLES.includes(role as Role);
}
