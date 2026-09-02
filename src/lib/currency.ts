import { prisma } from "@/lib/db";

export const BUILT_IN_CURRENCIES = [
  { name: "Indian Rupee", code: "INR", symbol: "₹", isDefault: true },
  { name: "Australian Dollar", code: "AUD", symbol: "$", isDefault: false },
  { name: "US Dollar", code: "USD", symbol: "$", isDefault: false },
  { name: "British Pound", code: "GBP", symbol: "£", isDefault: false },
  { name: "Euro", code: "EUR", symbol: "€", isDefault: false },
] as const;

let currenciesReady: Promise<void> | null = null;

async function seedCurrencies() {
  const existing = await prisma.currency.findMany();
  if (existing.length === 0) {
    await prisma.currency.createMany({ data: [...BUILT_IN_CURRENCIES] });
  } else if (!existing.some((row) => row.isDefault)) {
    const inr = existing.find((row) => row.code === "INR") ?? existing[0];
    await prisma.currency.update({ where: { id: inr.id }, data: { isDefault: true } });
  }

  const missingCurrency = await prisma.project.count({ where: { currencyId: null } });
  if (missingCurrency) {
    const fallback = await getDefaultCurrency();
    await prisma.project.updateMany({
      where: { currencyId: null },
      data: { currencyId: fallback.id },
    });
  }

  const closedUnbilled = await prisma.project.findMany({
    where: { status: "CLOSE", billingStage: "NONE", invoices: { none: {} } },
    select: { id: true },
  });
  if (closedUnbilled.length) {
    await prisma.project.updateMany({
      where: { id: { in: closedUnbilled.map((row) => row.id) } },
      data: { billingStage: "PENDING" },
    });
  }
}

export async function ensureCurrencies() {
  if (!currenciesReady) {
    currenciesReady = seedCurrencies().catch((error) => {
      currenciesReady = null;
      throw error;
    });
  }
  await currenciesReady;
  return prisma.currency.findMany({ orderBy: { code: "asc" } });
}

export async function getDefaultCurrency() {
  const found =
    (await prisma.currency.findFirst({ where: { isDefault: true } })) ??
    (await prisma.currency.findFirst({ where: { code: "INR" } })) ??
    (await prisma.currency.findFirst());
  if (found) return found;
  await prisma.currency.createMany({ data: [...BUILT_IN_CURRENCIES] });
  return prisma.currency.findFirstOrThrow({ where: { isDefault: true } });
}

export async function getActiveCurrencies() {
  await ensureCurrencies();
  return prisma.currency.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });
}

export async function getAllCurrencies() {
  await ensureCurrencies();
  return prisma.currency.findMany({ orderBy: [{ isDefault: "desc" }, { code: "asc" }] });
}

export function currencyCode(project: { currency?: { code: string } | null; currencyCode?: string | null }) {
  return project.currency?.code ?? project.currencyCode ?? "";
}
