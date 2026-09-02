import { ProjectForm } from "@/components/project-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { nextProjectCode } from "@/lib/data";
import { getActiveClients } from "@/lib/catalog";
import { getActiveCurrencies, getDefaultCurrency } from "@/lib/currency";
import { ADMIN_LIKE_ROLES, requireRole } from "@/lib/permissions";

export default async function NewProjectPage() {
  const user = await requireRole(...ADMIN_LIKE_ROLES);
  const [people, code, currencies, fallback, clients] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SENIOR_MANAGER", "MANAGER", "EMPLOYEE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    nextProjectCode(),
    getActiveCurrencies(),
    getDefaultCurrency(),
    getActiveClients(),
  ]);

  return (
    <div>
      <PageHeader title="New project" description="Set the project value, hours split, ETA, and team." />
      <ProjectForm
        mode="create"
        people={people}
        currencies={currencies}
        clients={clients}
        canEditFinance
        defaults={{
          name: "",
          code,
          clientName: clients[0]?.name ?? "",
          description: "",
          managerId: people.find((p) => p.role === "MANAGER" || p.role === "SENIOR_MANAGER")?.id ?? user.id,
          status: "BID",
          sellValue: 0,
          currencyId: fallback.id,
          estimatedHours: 40,
          eta: "",
          selfAssignEnabled: true,
          employeeIds: [],
        }}
      />
    </div>
  );
}
