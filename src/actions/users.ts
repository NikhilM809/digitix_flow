"use server";

import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_PASSWORD } from "@/lib/auth-defaults";
import { parseEmployeeWorkbook } from "@/lib/employee-excel";
import { ADMIN_LIKE_ROLES, assertRole, requireUser } from "@/lib/permissions";
import { isAssignableRole, parseRole } from "@/lib/roles";

function revalidatePeople() {
  revalidatePath("/employees");
  revalidatePath("/team");
  revalidatePath("/projects");
}

export async function createUser(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ADMIN_LIKE_ROLES);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseRole(String(formData.get("role") ?? "EMPLOYEE"));
  const password = String(formData.get("password") ?? "") || DEFAULT_PASSWORD;
  if (!name || !email) return { error: "Name and email are required." };
  if (!role || !isAssignableRole(role)) return { error: "Select a valid role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "That email is already in use." };

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        role,
        password: await bcrypt.hash(password, 10),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That email is already in use." };
    }
    throw error;
  }
  revalidatePeople();
  return { ok: true };
}

export async function updateUser(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ADMIN_LIKE_ROLES);
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseRole(String(formData.get("role") ?? ""));
  const active = String(formData.get("active") ?? "") !== "false";
  const password = String(formData.get("password") ?? "").trim();
  if (!userId) return { error: "Person not found." };
  if (!name || !email) return { error: "Name and email are required." };
  if (!role || !isAssignableRole(role)) return { error: "Select a valid role." };

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return { error: "Person not found." };

  if (existing.role === Role.ADMIN && (role !== Role.ADMIN || !active)) {
    const otherAdmins = await prisma.user.count({
      where: { role: Role.ADMIN, active: true, id: { not: userId } },
    });
    if (otherAdmins === 0) return { error: "Keep at least one active admin." };
  }

  const clash = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
  if (clash) return { error: "That email is already in use." };

  const data: Prisma.UserUpdateInput = { name, email, role, active };
  if (password) {
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    await prisma.user.update({ where: { id: userId }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That email is already in use." };
    }
    throw error;
  }
  revalidatePeople();
  return { ok: true };
}

export async function resetUserPassword(userId: string) {
  const actor = await requireUser();
  assertRole(actor, ADMIN_LIKE_ROLES);
  if (!userId) return { error: "Person not found." };
  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(DEFAULT_PASSWORD, 10) },
  });
  revalidatePeople();
  return { ok: true, password: DEFAULT_PASSWORD };
}

export async function importEmployees(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ADMIN_LIKE_ROLES);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an Excel file (.xlsx)." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Upload an .xlsx Excel file." };
  }

  const parsed = await parseEmployeeWorkbook(Buffer.from(await file.arrayBuffer()));
  if ("error" in parsed && parsed.error && parsed.rows.length === 0) {
    return { error: parsed.error };
  }

  const invalid = parsed.rows.filter((row) => row.error);
  const valid = parsed.rows.filter((row) => !row.error);
  if (valid.length === 0) {
    return { error: invalid[0]?.error ?? "No people found in the file." };
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let created = 0;
  let updated = 0;
  for (const row of valid) {
    const existing = await prisma.user.findUnique({ where: { email: row.email } });
    if (existing) {
      if (existing.role === Role.ADMIN && row.role !== Role.ADMIN) {
        const otherAdmins = await prisma.user.count({
          where: { role: Role.ADMIN, active: true, id: { not: existing.id } },
        });
        if (otherAdmins === 0) {
          invalid.push({ ...row, error: "Keep at least one active admin." });
          continue;
        }
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: row.name, role: row.role, active: true },
      });
      updated += 1;
    } else {
      await prisma.user.create({
        data: {
          name: row.name,
          email: row.email,
          role: row.role,
          password: passwordHash,
        },
      });
      created += 1;
    }
  }

  revalidatePeople();
  const skipped = invalid.length;
  return {
    ok: true,
    created,
    updated,
    skipped,
    message: `Imported ${created} new ${created === 1 ? "person" : "people"}${
      updated ? `, updated ${updated}` : ""
    }${skipped ? `, skipped ${skipped} row(s)` : ""}. Default password is ${DEFAULT_PASSWORD}.`,
  };
}
