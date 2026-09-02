import { PrismaClient } from "@prisma/client";
import { displayBillingStatus } from "../src/lib/finance";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { code: "DX-1006" },
    include: { invoices: true, currency: true },
  });
  if (!project) throw new Error("DX-1006 missing");
  if (project.invoices.length > 0) {
    throw new Error("DX-1006 already has an invoice; aborting so demo data is not changed.");
  }

  const invoiceCount = await prisma.invoice.count();
  const originalStage = project.billingStage;
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  let createdInvoiceId: string | null = null;

  try {
    await prisma.projectExport.create({
      data: {
        projectId: project.id,
        exportedById: admin.id,
        billingMonth: 8,
        billingYear: 2026,
        exportType: "QA_APPROVAL",
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { billingStage: "APPROVAL_REQUIRED" },
    });
    if ((await prisma.invoice.count()) !== invoiceCount) {
      throw new Error("Excel export created an invoice");
    }

    const afterExport = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { invoices: true },
    });
    if (displayBillingStatus(afterExport) !== "Approval Required") {
      throw new Error(`Expected Approval Required, got ${displayBillingStatus(afterExport)}`);
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { billingStage: "APPROVED" },
    });
    const approved = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { invoices: true },
    });
    if (displayBillingStatus(approved) !== "Approved") {
      throw new Error(`Expected Approved, got ${displayBillingStatus(approved)}`);
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-QA-TEMP",
        projectId: project.id,
        billingMonth: 8,
        billingYear: 2026,
        invoiceDate: new Date("2026-08-14T12:00:00.000Z"),
        amount: project.sellValue,
        currencyCode: project.currency?.code ?? "AUD",
        currencySymbol: project.currency?.symbol ?? "$",
        status: "GENERATED",
      },
    });
    createdInvoiceId = invoice.id;
    const invoiced = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { invoices: true },
    });
    if (displayBillingStatus(invoiced) !== "Invoice Generated") {
      throw new Error(`Expected Invoice Generated, got ${displayBillingStatus(invoiced)}`);
    }
    if (invoice.currencyCode !== "AUD") {
      throw new Error(`Expected AUD invoice, got ${invoice.currencyCode}`);
    }

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
    const paid = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { invoices: true },
    });
    if (displayBillingStatus(paid) !== "Paid") {
      throw new Error(`Expected Paid, got ${displayBillingStatus(paid)}`);
    }

    console.log(
      "WORKFLOW PASS: Closed → Pending Billing → Export (no invoice) → Approval Required → Approved → Invoice Generated → Paid",
    );
    console.log(`Currency preserved as ${invoice.currencyCode} ${invoice.amount}`);
  } finally {
    if (createdInvoiceId) {
      await prisma.invoice.delete({ where: { id: createdInvoiceId } }).catch(() => undefined);
    }
    await prisma.projectExport.deleteMany({
      where: { projectId: project.id, exportType: "QA_APPROVAL" },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { billingStage: originalStage },
    });
  }

  const restored = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { invoices: true },
  });
  if (restored.invoices.length !== 0) throw new Error("Temporary invoice was not removed");
  if ((await prisma.invoice.count()) !== invoiceCount) throw new Error("Invoice count changed after QA");
  console.log(`Restored ${project.code} to ${restored.billingStage}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
