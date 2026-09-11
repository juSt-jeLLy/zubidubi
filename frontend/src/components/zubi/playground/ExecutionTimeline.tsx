import { CheckCircle2, CircleDot, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PlaygroundProtocolStep } from "@/services/playground/types";

type ExecutionTimelineProps = {
  steps: PlaygroundProtocolStep[];
};

export function ExecutionTimeline({ steps }: ExecutionTimelineProps) {
  return (
    <section className="panel p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest">Protocol Proof</h2>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => (
          <div key={step.title} className="flex gap-3">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-md border",
                step.state === "verified" || step.state === "live"
                  ? "border-success/40 bg-success/10 text-success"
                  : step.state === "blocked"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-surface-2 text-muted-foreground",
              )}
            >
              {step.state === "blocked" ? (
                <ShieldAlert className="size-4" />
              ) : step.state === "waiting" ? (
                <span className="num text-xs">{index + 1}</span>
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-md border border-border bg-surface-2 px-3 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <CircleDot className="size-3 text-primary" />
          Important:
        </span>{" "}
        The playground previews routes, but settlement remains atomic and contract-enforced through Aqua.
      </div>
    </section>
  );
}
