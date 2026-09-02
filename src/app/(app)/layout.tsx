import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
