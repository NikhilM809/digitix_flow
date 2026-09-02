import { ProjectStatusForm } from "@/components/project-status-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireRole } from "@/lib/permissions";
import { visibleProjectsWhere } from "@/lib/project-access";

export default async function MyProjectsPage() {
  const user = await requireRole("EMPLOYEE");
  const assignments = await prisma.projectAssignment.findMany({
    where: { employeeId: user.id, project: visibleProjectsWhere("EMPLOYEE") },
    include: {
      project: {
        include: {
          statusChangedBy: true,
          tasks: { where: { assignedEmployeeId: user.id } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="My projects"
        description="Projects assigned to you stay visible for 7 days after close. Update status when work moves."
      />
      <Card>
        {assignments.length === 0 ? (
          <EmptyState title="No assignments" description="When a manager assigns you, projects will show here." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">ETA</th>
                <th className="px-5 py-3">Assigned task</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium">{row.project.name}</p>
                    <p className="text-xs text-muted">{row.project.code}</p>
                  </td>
                  <td className="px-5 py-3">{row.project.clientName}</td>
                  <td className="px-5 py-3">
                    <ProjectStatusForm
                      compact
                      projectId={row.project.id}
                      status={row.project.status}
                      changedByName={row.project.statusChangedBy?.name}
                      changedAt={row.project.statusChangedAt}
                    />
                  </td>
                  <td className="px-5 py-3">{formatDate(row.project.eta)}</td>
                  <td className="px-5 py-3">
                    {row.project.tasks.find((task) => task.status !== "COMPLETED")?.name ?? "No open task"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
