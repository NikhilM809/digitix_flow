import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { buildApprovalWorkbook } from "@/lib/approval-excel";
import { ADMIN_LIKE_ROLES, requireApiRole } from "@/lib/permissions";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireApiRole(...ADMIN_LIKE_ROLES);
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const url = new URL(request.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month") || now.getMonth() + 1);
  const year = Number(url.searchParams.get("year") || now.getFullYear());

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      manager: true,
      currency: true,
      timeEntries: { select: { hours: true, workType: true } },
      invoices: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.status !== "CLOSE") {
    return NextResponse.json({ error: "Only closed projects can be exported for billing approval." }, { status: 400 });
  }

  const settings = await getSettings();
  const bytes = await buildApprovalWorkbook({
    companyName: settings.companyName,
    project,
    billingMonth: month,
    billingYear: year,
    exportedBy: authz.user.name,
  });

  await prisma.projectExport.create({
    data: {
      projectId: project.id,
      exportedById: authz.user.id,
      billingMonth: month,
      billingYear: year,
      exportType: "APPROVAL",
    },
  });

  if (project.billingStage === "PENDING" || project.billingStage === "NONE") {
    await prisma.project.update({
      where: { id: project.id },
      data: { billingStage: "APPROVAL_REQUIRED" },
    });
  }

  const filename = `${project.code}-approval-${year}-${String(month).padStart(2, "0")}.xlsx`;
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
