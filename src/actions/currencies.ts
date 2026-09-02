"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRole, requireUser } from "@/lib/permissions";

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export async function createCurrency(formData: FormData) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const symbol = String(formData.get("symbol") ?? "").trim();
  if (!name || !code || !symbol) return { error: "Name, code, and symbol are required." };
  const exists = await prisma.currency.findUnique({ where: { code } });
  if (exists) return { error: "That currency code already exists." };
  const count = await prisma.currency.count();
  await prisma.currency.create({
    data: { name, code, symbol, active: true, isDefault: count === 0 },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateCurrency(currencyId: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const symbol = String(formData.get("symbol") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name || !code || !symbol) return { error: "Name, code, and symbol are required." };
  const current = await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!current) return { error: "Currency not found." };
  if (current.isDefault && !active) return { error: "The default currency cannot be deactivated." };
  const clash = await prisma.currency.findFirst({ where: { code, NOT: { id: currencyId } } });
  if (clash) return { error: "That currency code already exists." };
  await prisma.currency.update({
    where: { id: currencyId },
    data: { name, code, symbol, active },
  });
  revalidatePath("/settings");
  revalidatePath("/projects");
  return { ok: true };
}

export async function setDefaultCurrency(currencyId: string) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const currency = await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!currency) return { error: "Currency not found." };
  if (!currency.active) return { error: "Activate the currency before making it default." };
  await prisma.$transaction([
    prisma.currency.updateMany({ data: { isDefault: false } }),
    prisma.currency.update({ where: { id: currencyId }, data: { isDefault: true, active: true } }),
    prisma.setting.updateMany({ data: { currency: currency.code } }),
  ]);
  revalidatePath("/settings");
  return { ok: true };
}
