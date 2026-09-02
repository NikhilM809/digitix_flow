"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugWorkTypeCode } from "@/lib/work-types";
import { assertRole, requireUser } from "@/lib/permissions";

function revalidateCatalog() {
  revalidatePath("/settings");
  revalidatePath("/projects");
  revalidatePath("/projects/new");
  revalidatePath("/hours");
  revalidatePath("/billing");
  revalidatePath("/reports");
}

export async function addClient(formData: FormData) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (name.length < 2) return { error: "Client name is required." };
  const exists = await prisma.client.findFirst({ where: { name } });
  if (exists) return { error: "That client already exists." };
  await prisma.client.create({
    data: { name, legalName: legalName || name, address },
  });
  revalidateCatalog();
  return { ok: true };
}

export async function saveClient(id: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const active = formData.get("active") === "on";
  if (name.length < 2) return { error: "Client name is required." };
  await prisma.client.update({
    where: { id },
    data: { name, legalName, address, active },
  });
  revalidateCatalog();
  return { ok: true };
}

export async function addInvoiceService(formData: FormData) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Service name is required." };
  const exists = await prisma.invoiceService.findFirst({ where: { name } });
  if (exists) return { error: "That service already exists." };
  await prisma.invoiceService.create({ data: { name } });
  revalidateCatalog();
  return { ok: true };
}

export async function addWorkType(formData: FormData) {
  const user = await requireUser();
  assertRole(user, [Role.ADMIN]);
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other") || "other";
  if (name.length < 2) return { error: "Work type name is required." };
  let code = slugWorkTypeCode(name);
  const clash = await prisma.workTypeOption.findUnique({ where: { code } });
  if (clash) code = `${code}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const last = await prisma.workTypeOption.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.workTypeOption.create({
    data: { name, code, category, sortOrder: (last?.sortOrder ?? 0) + 10 },
  });
  revalidateCatalog();
  return { ok: true };
}
