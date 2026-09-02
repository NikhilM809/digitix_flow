"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRole, requireUser } from "@/lib/permissions";

export async function createUser(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "EMPLOYEE") as Role;
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Name and email are required." };
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) return { error: "Select a valid role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "That email is already in use." };

  await prisma.user.create({
    data: {
      name,
      email,
      role,
      password: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath("/employees");
  return { ok: true };
}

export async function updateUser(userId: string, formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Name and email are required." };

  const data: Record<string, unknown> = { name, email, role, active };
  if (password) {
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    data.password = await bcrypt.hash(password, 10);
  }
  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/employees");
  return { ok: true };
}
