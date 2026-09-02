import { prisma } from "@/lib/db";

export async function notifyUsers(
  userIds: string[],
  payload: { title: string; message: string; href?: string },
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      title: payload.title,
      message: payload.message,
      href: payload.href,
    })),
  });
}

export async function notifyAdmins(payload: { title: string; message: string; href?: string }) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  await notifyUsers(
    admins.map((admin) => admin.id),
    payload,
  );
}

export async function notifyManagersOfProject(
  projectId: string,
  payload: { title: string; message: string; href?: string },
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { managerId: true },
  });
  if (project) {
    await notifyUsers([project.managerId], payload);
  }
}
