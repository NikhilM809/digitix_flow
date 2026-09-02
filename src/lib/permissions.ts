import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  } satisfies SessionUser;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

export function canSeeFinance(role: Role) {
  return role === "ADMIN";
}

export function isStaff(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function assertRole(user: SessionUser, roles: Role[], message = "You do not have permission to do that.") {
  if (!roles.includes(user.role)) {
    throw new ActionError(message);
  }
}

/** Use in Route Handlers so unauthorized callers get JSON, not an HTML redirect. */
export async function requireApiRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  if (!roles.includes(user.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 }),
    };
  }
  return { ok: true as const, user };
}
