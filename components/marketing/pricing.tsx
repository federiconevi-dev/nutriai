import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAN_CREDITS, PLAN_PRICE_USD } from "@/lib/config";

const plans = [
  {
    id: "FREE" as const,
    name: "Free",
    description: "Try the full platform, no card needed.",
    features: ["100 credits / month", "720p exports", "Watermark on exports", "Community templates"],
  },
  {
    id: "CREATOR" as const,
    name: "Creator",
    description: "For creators shipping content weekly.",
    features: ["1,000 credits / month", "1080p exports", "No watermark", "Brand kit", "Priority rendering"],
    highlighted: true,
  },
  {
    id: "PRO" as const,
    name: "Pro",
    description: "For teams and agencies at scale.",
    features: ["5,000 credits / month", "1080p exports", "Team seats", "API access", "Priority support"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-white/5 py-24">
      <div className="container">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple, credit-based pricing</h2>
          <p className="mt-4 text-muted-foreground">Every generation consumes credits. Upgrade any time, cancel whenever.</p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6",
                plan.highlighted
                  ? "border-brand-500/50 bg-gradient-to-b from-brand-500/10 to-transparent shadow-lg shadow-brand-900/20"
                  : "border-border bg-card"
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <h3 className="font-medium">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">${PLAN_PRICE_USD[plan.id]}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 text-xs text-brand-400">{PLAN_CREDITS[plan.id].toLocaleString()} credits included</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /> {f}
                  </li>
                ))}
              </ul>

              <Button className="mt-8" variant={plan.highlighted ? "gradient" : "outline"} asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
