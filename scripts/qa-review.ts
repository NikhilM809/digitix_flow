import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { hoursByWorkType, sumHours } from "../src/lib/data";
import { displayBillingStatus, totalsByCurrency } from "../src/lib/finance";
import { formatMoney, formatMoneyPdf } from "../src/lib/format";
import { buildApprovalWorkbook } from "../src/lib/approval-excel";
import { buildInvoicePdf } from "../src/lib/invoice-pdf";
import { maxInvoiceSequence } from "../src/lib/data";

const prisma = new PrismaClient();
const failures: string[] = [];

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

async function main() {
  const currencies = await prisma.currency.findMany({ orderBy: { code: "asc" } });
  const codes = currencies.map((row) => row.code);
  assert(codes.includes("AUD") && codes.includes("USD") && codes.includes("GBP") && codes.includes("EUR") && codes.includes("INR"), "Expected five managed currencies");
  assert(currencies.filter((row) => row.isDefault).length === 1, "Exactly one default currency");

  const projects = await prisma.project.findMany({
    include: {
      manager: true,
      currency: true,
      timeEntries: true,
      invoices: true,
    },
  });
  assert(projects.every((project) => project.currencyId && project.currency), "Every project has a currency");

  const mixed = totalsByCurrency(projects, (project) => project.sellValue);
  const mixedSum = mixed.reduce((sum, [, amount]) => sum + amount, 0);
  const naive = projects.reduce((sum, project) => sum + project.sellValue, 0);
  assert(mixed.length >= 2 || projects.every((p) => p.currency?.code === mixed[0]?.[0]), "Sales totals are grouped by currency");
  assert(Math.abs(mixedSum - naive) < 0.01, "Per-currency totals still cover all project values");
  assert(!mixed.some(([code]) => code === "Unknown" && projects.some((p) => p.currency)), "No unknown currency in seeded projects");

  for (const project of projects) {
    const breakdown = hoursByWorkType(project.timeEntries);
    assert(Math.abs(breakdown.total - sumHours(project.timeEntries)) < 0.01, `Hours mismatch on ${project.code}`);
    assert(
      Math.abs(breakdown.initial + breakdown.changes + breakdown.live - breakdown.total) < 0.01,
      `Work-type hours do not add up on ${project.code}`,
    );
  }

  const invoices = await prisma.invoice.findMany();
  const numbers = invoices.map((row) => row.invoiceNumber);
  assert(new Set(numbers).size === numbers.length, "Invoice numbers are unique");
  assert(invoices.every((row) => row.currencyCode), "Every invoice has a currency code");

  const closedPending = projects.find((project) => project.status === "CLOSE" && project.invoices.length === 0);
  assert(closedPending, "Seed includes a closed unbilled project for the approval workflow");
  if (closedPending) {
    assert(displayBillingStatus(closedPending) === "Pending Billing" || displayBillingStatus(closedPending) === "Approval Required" || displayBillingStatus(closedPending) === "Approved", "Closed unbilled project has a billing status");
    assert(closedPending.billingStage !== "APPROVED" || closedPending.invoices.length === 0, "Approved project without invoice is allowed");

    const bytes = await buildApprovalWorkbook({
      companyName: "Digitix Labs",
      project: closedPending,
      billingMonth: 8,
      billingYear: 2026,
      exportedBy: "QA",
    });
    const dir = path.join(process.cwd(), "tmp");
    mkdirSync(dir, { recursive: true });
    const excelPath = path.join(dir, `${closedPending.code}-qa-approval.xlsx`);
    writeFileSync(excelPath, bytes);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const sheet = workbook.worksheets[0];
    assert(sheet, "Excel workbook has a worksheet");
    const text = JSON.stringify(sheet.getSheetValues());
    assert(text.includes(closedPending.code), "Excel contains project ID");
    assert(text.includes(closedPending.name), "Excel contains project name");
    assert(text.includes(closedPending.clientName), "Excel contains client name");
    assert(text.includes(closedPending.manager.name), "Excel contains project manager");
    if (closedPending.currency?.code) {
      assert(text.includes(closedPending.currency.code), "Excel contains currency code");
    }
    assert(text.includes("does not create an invoice"), "Excel states that export is not an invoice");
    assert(!text.includes("SUM("), "Excel has no formulas that could break in Excel");
  }

  const generated = invoices[0];
  if (generated) {
    const project = projects.find((row) => row.id === generated.projectId);
    const pdf = await buildInvoicePdf({
      companyName: "Digitix Labs",
      companyAddress: "Pune",
      companyEmail: "billing@digitixlabs.com",
      companyPhone: "+91",
      invoiceNumber: generated.invoiceNumber,
      invoiceDate: generated.invoiceDate,
      billingMonth: generated.billingMonth,
      billingYear: generated.billingYear,
      clientName: project?.clientName ?? "Client",
      projectName: project?.name ?? "Project",
      projectCode: project?.code ?? "DX",
      description: "QA invoice",
      amount: generated.amount,
      currency: generated.currencyCode,
      currencySymbol: generated.currencySymbol,
      status: generated.status,
    });
    assert(pdf.byteLength > 1000, "Invoice PDF was generated");
    assert(formatMoneyPdf(5000, "AUD") === "AUD 5,000.00", "PDF money format uses the selected currency code");
    assert(formatMoney(5000, "AUD") === "5,000 AUD", "UI money format uses the selected currency code");
    assert(!formatMoneyPdf(generated.amount, generated.currencyCode).includes("USD") || generated.currencyCode === "USD", "PDF amount does not assume USD");
  }

  assert(displayBillingStatus({ status: "LIVE", billingStage: "NONE", invoices: [] }) === "Not billed", "Open projects are not billed");
  assert(displayBillingStatus({ status: "CLOSE", billingStage: "PENDING", invoices: [] }) === "Pending Billing", "Closed projects start at Pending Billing");
  assert(displayBillingStatus({ status: "CLOSE", billingStage: "APPROVAL_REQUIRED", invoices: [] }) === "Approval Required", "Export moves billing to Approval Required");
  assert(displayBillingStatus({ status: "CLOSE", billingStage: "APPROVED", invoices: [] }) === "Approved", "Approved status is distinct from invoice generated");
  assert(displayBillingStatus({ status: "CLOSE", billingStage: "APPROVED", invoices: [{ status: "GENERATED" }] }) === "Invoice Generated", "Invoice generated overrides approved");
  assert(displayBillingStatus({ status: "CLOSE", billingStage: "APPROVED", invoices: [{ status: "PAID" }] }) === "Paid", "Paid status is shown after payment");
  assert(maxInvoiceSequence(["INV-00001", "INV-00012"]) === 12, "Invoice sequence uses the highest number");

  const users = await prisma.user.findMany({ select: { email: true, role: true, active: true } });
  assert(users.some((row) => row.role === "ADMIN" && row.email === "admin@digitix.local"), "Admin demo user exists");
  assert(users.some((row) => row.role === "MANAGER"), "Manager demo user exists");
  assert(users.some((row) => row.role === "EMPLOYEE"), "Employee demo user exists");

  if (failures.length) {
    console.error("QA FAILURES");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("QA PASS");
    console.log(`Currencies: ${codes.join(", ")}`);
    console.log(`Projects: ${projects.length}, invoices: ${invoices.length}`);
    console.log("Currency totals:", mixed.map(([code, amount]) => `${code} ${amount}`).join(" | "));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
