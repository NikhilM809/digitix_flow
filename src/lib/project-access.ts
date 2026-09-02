import { Prisma, Role } from "@prisma/client";
import { subDays } from "date-fns";
import { INACTIVE_STATUSES } from "@/lib/project-status";

export function closedRetentionDays(role: Role) {
  if (role === "EMPLOYEE") return 7;
  if (role === "MANAGER") return 30;
  return null;
}

export function visibleProjectsWhere(role: Role): Prisma.ProjectWhereInput {
  const days = closedRetentionDays(role);
  if (days == null) return {};
  const cutoff = subDays(new Date(), days);
  return {
    OR: [
      { status: { notIn: INACTIVE_STATUSES } },
      {
        status: { in: INACTIVE_STATUSES },
        OR: [
          { actualCompletionDate: { gte: cutoff } },
          {
            AND: [{ actualCompletionDate: null }, { statusChangedAt: { gte: cutoff } }],
          },
          {
            AND: [
              { actualCompletionDate: null },
              { statusChangedAt: null },
              { updatedAt: { gte: cutoff } },
            ],
          },
        ],
      },
    ],
  };
}

export function withVisibleProjects(
  role: Role,
  where: Prisma.ProjectWhereInput = {},
): Prisma.ProjectWhereInput {
  const visibility = visibleProjectsWhere(role);
  if (Object.keys(visibility).length === 0) return where;
  if (Object.keys(where).length === 0) return visibility;
  return { AND: [visibility, where] };
}
