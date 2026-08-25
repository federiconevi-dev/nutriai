import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const STAGE_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
};

export default async function AdminVideosPage() {
  await requireAdmin();

  const generations = await db.generation.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { project: { include: { user: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every generation across the platform.</p>
      </div>
      <AdminNav />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-4 font-medium">Project</th>
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium">Stage</th>
              <th className="p-4 font-medium">Progress</th>
              <th className="p-4 font-medium">Error</th>
              <th className="p-4 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {generations.map((g) => (
              <tr key={g.id} className="border-b border-border/50 last:border-0">
                <td className="p-4">{g.project.title}</td>
                <td className="p-4 text-xs text-muted-foreground">{g.project.user.email}</td>
                <td className="p-4">
                  <Badge variant={STAGE_VARIANT[g.stage] ?? "warning"}>{g.stage}</Badge>
                </td>
                <td className="p-4 text-xs text-muted-foreground">{g.progress}%</td>
                <td className="p-4 max-w-xs truncate text-xs text-destructive">{g.errorMessage ?? "—"}</td>
                <td className="p-4 text-xs text-muted-foreground">{formatDate(g.startedAt)}</td>
              </tr>
            ))}
            {generations.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No generations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
