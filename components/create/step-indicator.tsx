import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const index = i + 1;
        const active = index === current;
        const done = index < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                done && "bg-brand-500 text-white",
                active && !done && "bg-brand-500/20 text-brand-300 ring-2 ring-brand-500/50",
                !active && !done && "bg-secondary text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index}
            </div>
            <span className={cn("hidden text-sm sm:inline", active ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {index < steps.length && <div className="h-px w-6 bg-border sm:w-10" />}
          </div>
        );
      })}
    </div>
  );
}
