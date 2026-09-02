import { prisma } from "@/lib/db";

export const DEFAULT_WORK_TYPES = [
  { code: "INITIAL_SCRIPTING", name: "Initial Scripting", category: "initial", sortOrder: 10 },
  { code: "INITIAL_QA", name: "Initial QA", category: "initial", sortOrder: 20 },
  { code: "CHANGES", name: "Changes", category: "changes", sortOrder: 30 },
  { code: "CHANGES_QA", name: "Changes QA", category: "changes", sortOrder: 40 },
  { code: "LIVE", name: "Live", category: "live", sortOrder: 50 },
  { code: "PROJECT_MANAGEMENT", name: "Project Management", category: "pm", sortOrder: 60 },
] as const;

export const DEFAULT_INVOICE_SERVICES = ["Survey Programming and Consulting"];

let catalogReady: Promise<void> | null = null;

async function seedCatalog() {
  const [workTypes, services, clients] = await Promise.all([
    prisma.workTypeOption.count(),
    prisma.invoiceService.count(),
    prisma.client.count(),
  ]);
  if (workTypes === 0) {
    await prisma.workTypeOption.createMany({ data: [...DEFAULT_WORK_TYPES] });
  }
  if (services === 0) {
    await prisma.invoiceService.createMany({
      data: DEFAULT_INVOICE_SERVICES.map((name) => ({ name })),
    });
  }
  if (clients === 0) {
    const names = [
      ...new Set(
        (await prisma.project.findMany({ select: { clientName: true } })).map((row) => row.clientName.trim()).filter(Boolean),
      ),
    ];
    const settings = await prisma.setting.findUnique({ where: { id: "default" } });
    if (!names.length) names.push("Pureprofile");
    await prisma.client.createMany({
      data: names.map((name) => ({
        name,
        legalName: name.toLowerCase().includes("pureprofile") ? settings?.billToName || "PUREPROFILE LIMITED" : name,
        address: name.toLowerCase().includes("pureprofile") ? settings?.billToAddress || "" : "",
      })),
    });
  }

  const needsBackfill = await prisma.project.findFirst({
    where: { initialSellValue: 0, sellValue: { gt: 0 } },
    select: { id: true },
  });
  if (!needsBackfill) return;

  await prisma.$executeRawUnsafe(
    `UPDATE Project SET initialSellValue = sellValue WHERE initialSellValue = 0 AND sellValue > 0`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE Project SET initialEstimatedHours = estimatedHours WHERE initialEstimatedHours = 0 AND estimatedHours > 0`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE Project SET programmerHours = ROUND(estimatedHours * 0.6, 1), qaHours = ROUND(estimatedHours * 0.3, 1), marginHours = ROUND(estimatedHours - ROUND(estimatedHours * 0.6, 1) - ROUND(estimatedHours * 0.3, 1), 1) WHERE programmerHours = 0 AND estimatedHours > 0`,
  );
}

export async function ensureCatalog() {
  if (!catalogReady) {
    catalogReady = seedCatalog().catch((error) => {
      catalogReady = null;
      throw error;
    });
  }
  await catalogReady;
}

export async function getActiveClients() {
  await ensureCatalog();
  return prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function getActiveWorkTypes() {
  await ensureCatalog();
  return prisma.workTypeOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export async function getActiveInvoiceServices() {
  await ensureCatalog();
  return prisma.invoiceService.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function findClientByName(name: string) {
  return prisma.client.findFirst({ where: { name } });
}
