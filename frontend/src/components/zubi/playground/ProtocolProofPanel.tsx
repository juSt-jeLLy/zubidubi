import { ArrowRight, DatabaseZap, GitBranch, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { LiveActivity } from "@/services/markets/types";
import { PLAYGROUND_PROOFS, PLAYGROUND_TEST_GROUPS } from "@/services/playground/scenarios";
import type { PlaygroundTestGroup } from "@/services/playground/types";

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
          <h2 className="text-sm font-semibold uppercase tracking-widest">Main Proof Catalog</h2>
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

      <section className="panel overflow-hidden lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest">Detailed Test Map</h2>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            {PLAYGROUND_TEST_GROUPS.reduce((sum, group) => sum + group.tests.length, 0)} checks
          </Badge>
        </div>
        <div className="divide-y divide-border">
          {PLAYGROUND_TEST_GROUPS.map((group) => (
            <TestGroupCard key={group.id} group={group} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TestGroupCard({ group }: { group: PlaygroundTestGroup }) {
  return (
    <article className="px-5 py-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{group.title}</h3>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                {group.summary}
              </p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              {group.tests.length} tests
            </Badge>
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-border bg-background p-3">
            <div className="flex min-w-max items-center gap-2">
              {group.flow.map((step, index) => (
                <div key={`${group.id}-${step}`} className="flex items-center gap-2">
                  <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-xs font-medium">{step}</p>
                  </div>
                  {index < group.flow.length - 1 ? (
                    <ArrowRight className="size-4 shrink-0 text-primary" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="num truncate text-xs text-primary">{group.file}</p>
            <code className="num block overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
              {group.command}
            </code>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface-2">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest">What each test proves</p>
          </div>
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {group.tests.map((test) => (
              <div key={test.name} className="px-4 py-3">
                <p className="num break-all text-xs text-foreground">{test.name}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{test.proves}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
