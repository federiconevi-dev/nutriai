"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Check, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_CREDITS, PLAN_PRICE_USD } from "@/lib/config";
import { formatDate, cn } from "@/lib/utils";

interface Transaction {
  id: string;
  amount: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

const PLANS = [
  { id: "FREE" as const, name: "Free", features: ["100 credits/mo", "720p exports", "Watermark"] },
  { id: "CREATOR" as const, name: "Creator", features: ["1,000 credits/mo", "1080p exports", "No watermark", "Brand kit"] },
  { id: "PRO" as const, name: "Pro", features: ["5,000 credits/mo", "1080p exports", "Team seats", "API access"] },
];

const REASON_LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Signup bonus",
  PLAN_RENEWAL: "Plan renewal",
  ADMIN_GRANT: "Admin grant",
  VIDEO_GENERATION: "Video generation",
  SCRIPT_GENERATION: "Script generation",
  REFUND: "Refund",
};

export function CreditsView({
  balance,
  currentPlan,
  subscription,
  transactions,
}: {
  balance: number;
  currentPlan: "FREE" | "CREATOR" | "PRO";
  subscription: { plan: string; status: string; cancelAtPeriodEnd: boolean } | null;
  transactions: Transaction[];
}) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleUpgrade(plan: "FREE" | "CREATOR" | "PRO") {
    if (plan === currentPlan) return;
    setLoadingPlan(plan);
    try {
      if (plan === "FREE") {
        const res = await fetch("/api/stripe/demo-upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        if (res.ok) {
          toast.success("Switched to Free plan");
          router.refresh();
        }
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (data.configured) {
        window.location.href = data.url;
        return;
      }

      // Stripe not configured yet - offer the demo upgrade so the plan/credit
      // flow can still be tested end to end.
      const demoRes = await fetch("/api/stripe/demo-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (demoRes.ok) {
        toast.success(`Demo mode: upgraded to ${plan} (Stripe not connected yet)`);
        router.refresh();
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Coins className="h-8 w-8 text-brand-400" />
        <p className="text-4xl font-semibold">{balance.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">credits available</p>
        {subscription?.cancelAtPeriodEnd && (
          <Badge variant="warning" className="mt-2">Cancels at period end</Badge>
        )}
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <Card key={plan.id} className={cn("flex flex-col p-5", isCurrent && "border-brand-500/50 bg-brand-500/5")}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{plan.name}</p>
                  {isCurrent && <Badge variant="brand">Current</Badge>}
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  ${PLAN_PRICE_USD[plan.id]}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-brand-400" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4"
                  variant={isCurrent ? "outline" : "gradient"}
                  disabled={isCurrent || loadingPlan === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {loadingPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCurrent ? "Current plan" : "Choose plan"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Transaction history</h2>
        <Card className="divide-y divide-border">
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      tx.amount > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {tx.amount > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{REASON_LABEL[tx.reason] ?? tx.reason}</p>
                    <p className="text-xs text-muted-foreground">{tx.note ?? formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <span className={cn("text-sm font-medium", tx.amount > 0 ? "text-emerald-400" : "text-foreground")}>
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
