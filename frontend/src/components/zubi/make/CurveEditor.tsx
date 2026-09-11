import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ExposureCurveChart } from "./ExposureCurveChart";
import { TimeCurveChart } from "./TimeCurveChart";
import { discountAtDays, exposureDiscountAt, pctLabel, type MakerCurveParams } from "./curveMath";

type CurveEditorProps = {
  params: MakerCurveParams;
  onChange: (key: keyof MakerCurveParams, value: number) => void;
};

export function CurveEditor({ params, onChange }: CurveEditorProps) {
  const [tab, setTab] = useState<"time" | "exposure">("time");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Interactive curve editor</h2>
          <p className="text-xs text-muted-foreground">
            Drag handles or type values in the form. Both views write to the same strategy state.
          </p>
        </div>
        <div className="flex rounded-md border border-border bg-surface-2 p-1">
          {(["time", "exposure"] as const).map((next) => (
            <button
              key={next}
              onClick={() => setTab(next)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                tab === next ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {next}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {params.curveFamily === 1 ? `convex k=${params.convexity.toFixed(2)}` : "linear"}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary">
          cap {pctLabel(params.maxDiscountPct)}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          risk {params.riskTier}
        </Badge>
      </div>

      <div className="mt-5">
        {tab === "time" ? (
          <TimeCurveChart params={params} onChange={onChange} />
        ) : (
          <ExposureCurveChart params={params} onChange={onChange} />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {[
          { l: "At 30d", v: pctLabel(discountAtDays(params, 30)) },
          { l: "At 180d", v: pctLabel(discountAtDays(params, 180)) },
          { l: "Full exposure", v: pctLabel(exposureDiscountAt(params, 100)) },
          { l: "Window", v: `${params.minDays}-${params.maxDays}d` },
        ].map((item) => (
          <div key={item.l} className="bg-surface-2 px-3 py-3">
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.l}</dt>
            <dd className="num mt-1 text-sm capitalize">{item.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
