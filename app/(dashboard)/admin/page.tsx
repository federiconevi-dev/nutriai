import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card } from "@/components/ui/card";
import { Users, Clapperboard, Coins, AlertTriangle, CreditCard, DollarSign } from "lucide-react";
import { PLAN_PRICE_USD } from "@/lib/config";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [userCount, videoCount, failedGenerations, activeSubscriptions, creditUsage] = await Promise.all([
    db.user.count(),
    db.video.count(),
    db.generation.count({ where: { stage: "FAILED" } }),
    db.subscription.count({ where: { status: "ACTIVE", plan: { not: "FREE" } } }),
    db.creditTransaction.aggregate({ _sum: { amount: true }, where: { amount: { lt: 0 } } }),
  ]);

  const subscriptions = await db.subscription.findMany({ where: { status: "ACTIVE" } });
  const revenue = subscriptions.reduce(
    (sum, s) => sum + (PLAN_PRICE_USD[s.plan as keyof typeof PLAN_PRICE_USD] ?? 0),
    0
  );
  const creditsUsed = Math.abs(creditUsage._sum.amount ?? 0);

  const stats = [
    { label: "Users", value: userCount.toLocaleString(), icon: Users },
    { label: "Videos generated", value: videoCount.toLocaleString(), icon: Clapperboard },
    { label: "Credits used", value: creditsUsed.toLocaleString(), icon: Coins },
    { label: "Failed generations", value: failedGenerations.toLocaleString(), icon: AlertTriangle },
    { label: "Active subscriptions", value: activeSubscriptions.toLocaleString(), icon: CreditCard },
    { label: "MRR (estimate)", value: `$${revenue.toLocaleString()}`, icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide metrics and management.</p>
      </div>
      <AdminNav />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <s.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
