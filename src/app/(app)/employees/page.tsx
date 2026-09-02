import { PeopleManager } from "@/components/people-manager";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { ADMIN_LIKE_ROLES, requireRole } from "@/lib/permissions";

export default async function EmployeesPage() {
  await requireRole(...ADMIN_LIKE_ROLES);
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div>
      <PageHeader
        title="People"
        description="Add people one by one or from Excel. You can edit details later and reset passwords to Digitix@123."
      />
      <PeopleManager people={users} />
    </div>
  );
}
