import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { creditBalance: true },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage users, plans and credits.</p>
      </div>
      <AdminNav />
      <AdminUsersTable
        currentUserId={admin.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          plan: u.plan,
          disabled: u.disabled,
          credits: u.creditBalance?.balance ?? 0,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
