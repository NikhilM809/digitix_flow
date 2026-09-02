import { NextResponse } from "next/server";
import { buildEmployeeTemplate } from "@/lib/employee-excel";
import { ADMIN_LIKE_ROLES, requireApiRole } from "@/lib/permissions";

export async function GET() {
  const authz = await requireApiRole(...ADMIN_LIKE_ROLES);
  if (!authz.ok) return authz.response;
  const bytes = Buffer.from(await buildEmployeeTemplate());
  return new NextResponse(Uint8Array.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employee-import-template.xlsx"',
    },
  });
}
