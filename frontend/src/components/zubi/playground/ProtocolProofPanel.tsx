import { DatabaseZap, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { LiveActivity } from "@/services/markets/types";
import { PLAYGROUND_PROOFS } from "@/services/playground/scenarios";

function proofTone(status: string) {
  if (status === "fork") return "border-warning/40 text-warning";
  if (status === "graph") return "border-primary/40 text-primary";
  if (status === "frontend") return "border-success/40 text-success";
  return "text-muted-foreground";
}

export function ProtocolProofPanel({ activity }: { activity: LiveActivity[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ReceiptText className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest">Test Proof Catalog</h2>
        </div>
        <div className="grid gap-px bg-border md:grid-cols-2">
          {PLAYGROUND_PROOFS.map((proof) => (
            <article key={proof.id} className="bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{proof.title}</h3>
                <Badge variant="outline" className={proofTone(proof.status)}>
                  {proof.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{proof.whatItProves}</p>
              <div className="mt-4 space-y-2">
                <p className="num truncate text-xs text-primary">{proof.file}</p>
                <code className="num block overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
                  {proof.command}
                </code>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <DatabaseZap className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest">Live Activity</h2>
        </div>
        <div className="divide-y divide-border">
          {activity.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              No indexed activity returned yet.
            </div>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.asset}</p>
                  </div>
                  <div className="num shrink-0 text-right">
                    <p className="text-sm text-primary">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.ago}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
