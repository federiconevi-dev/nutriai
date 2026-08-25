import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getOrCreateBalance } from "@/lib/credits";
import { CreditsView } from "@/components/credits/credits-view";

export default async function CreditsPage() {
  const user = await requireUser();
  const [balance, transactions, dbUser, subscription] = await Promise.all([
    getOrCreateBalance(user.id),
    db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.user.findUnique({ where: { id: user.id } }),
    db.subscription.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Credits & billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your plan, credits and usage history.</p>
      </div>
      <CreditsView
        balance={balance.balance}
        currentPlan={(dbUser?.plan as "FREE" | "CREATOR" | "PRO") ?? "FREE"}
        subscription={
          subscription
            ? { plan: subscription.plan, status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd }
            : null
        }
        transactions={transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          reason: t.reason,
          note: t.note,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
