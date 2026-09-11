import { useMemo, useRef, useState, type PointerEvent } from "react";

import { DraggableCapLine } from "./DraggableCapLine";
import { DraggableHandle } from "./DraggableHandle";
import { RangeBand } from "./RangeBand";
import {
  clamp,
  daysLabel,
  discountAtDays,
  makeScale,
  pathFromPoints,
  pctLabel,
  snap,
  timeCurvePoints,
  type MakerCurveParams,
} from "./curveMath";

type Handle = "base" | "rate" | "cap" | "bow" | "min" | "max";

type TimeCurveChartProps = {
  params: MakerCurveParams;
  onChange: (key: keyof MakerCurveParams, value: number) => void;
};

const WIDTH = 760;
const HEIGHT = 360;
const PAD = { left: 48, right: 24, top: 24, bottom: 42 };

export function TimeCurveChart({ params, onChange }: TimeCurveChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<Handle | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const maxY = Math.max(params.maxDiscountPct * 1.2, 2);
  const scaleX = useMemo(() => makeScale(0, Math.max(params.maxDays, 30), PAD.left, WIDTH - PAD.right), [params.maxDays]);
  const scaleY = useMemo(() => makeScale(0, maxY, HEIGHT - PAD.bottom, PAD.top), [maxY]);
  const points = useMemo(() => timeCurvePoints(params), [params]);
  const path = pathFromPoints(points, scaleX.scale, scaleY.scale);

  const baseY = scaleY.scale(params.baseDiscountPct);
  const capY = scaleY.scale(params.maxDiscountPct);
  const rateY = scaleY.scale(discountAtDays(params, params.maxDays));
  const bowDays = params.maxDays / 2;
  const bowY = scaleY.scale(discountAtDays(params, bowDays));

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const updateFromPoint = (handle: Handle, point: { x: number; y: number }) => {
    if (handle === "base") {
      const value = snap(clamp(scaleY.unscale(point.y), 0, params.maxDiscountPct), 0.05);
      onChange("baseDiscountPct", value);
      setTooltip({ x: scaleX.scale(0), y: scaleY.scale(value), text: `base ${pctLabel(value)}` });
    }
    if (handle === "rate") {
      const target = clamp(scaleY.unscale(point.y), params.baseDiscountPct, params.maxDiscountPct);
      const annual = snap(Math.max(0, ((target - params.baseDiscountPct) * 365) / Math.max(params.maxDays, 1)), 0.25);
      onChange("annualRatePct", annual);
      setTooltip({ x: scaleX.scale(params.maxDays), y: point.y, text: `annual ${pctLabel(annual)}` });
    }
    if (handle === "cap") {
      const value = snap(clamp(scaleY.unscale(point.y), params.baseDiscountPct, 25), 0.25);
      onChange("maxDiscountPct", value);
      setTooltip({ x: WIDTH - PAD.right - 70, y: scaleY.scale(value), text: `cap ${pctLabel(value)}` });
    }
    if (handle === "bow") {
      const midpoint = discountAtDays(params, bowDays);
      const target = clamp(scaleY.unscale(point.y), params.baseDiscountPct, params.maxDiscountPct);
      const delta = target - midpoint;
      const next = snap(clamp(params.convexity + delta * -0.18, 0.25, 5), 0.05);
      onChange("curveFamily", 1);
      onChange("convexity", next);
      setTooltip({ x: scaleX.scale(bowDays), y: scaleY.scale(target), text: `bow k=${next.toFixed(2)}` });
    }
    if (handle === "min") {
      const value = snap(clamp(scaleX.unscale(point.x), 1, params.maxDays - 7), 1);
      onChange("minDays", value);
      setTooltip({ x: scaleX.scale(value), y: HEIGHT - PAD.bottom, text: `min ${daysLabel(value)}` });
    }
    if (handle === "max") {
      const value = snap(clamp(scaleX.unscale(point.x), params.minDays + 7, 900), 1);
      onChange("maxDays", value);
      setTooltip({ x: scaleX.scale(value), y: HEIGHT - PAD.bottom, text: `max ${daysLabel(value)}` });
    }
  };

  const start = (handle: Handle) => (event: PointerEvent<SVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(handle);
    updateFromPoint(handle, pointFromEvent(event));
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    updateFromPoint(active, pointFromEvent(event));
  };

  const end = (event: PointerEvent<SVGSVGElement>) => {
    if (active) event.currentTarget.releasePointerCapture?.(event.pointerId);
    setActive(null);
    setTooltip(null);
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[340px] w-full touch-none select-none overflow-visible rounded-md border border-border bg-background"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <Grid maxY={maxY} maxX={params.maxDays} scaleX={scaleX.scale} scaleY={scaleY.scale} />
        <RangeBand
          x1={scaleX.scale(params.minDays)}
          x2={scaleX.scale(params.maxDays)}
          y={PAD.top}
          height={HEIGHT - PAD.top - PAD.bottom}
          active={active === "min" ? "min" : active === "max" ? "max" : null}
          onMinPointerStart={start("min")}
          onMaxPointerStart={start("max")}
        />
        <DraggableCapLine orientation="horizontal" position={capY} from={PAD.left} to={WIDTH - PAD.right} active={active === "cap"} label="Max discount cap" onPointerStart={start("cap")} />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={3} />
        <path d={`${path} L ${WIDTH - PAD.right} ${HEIGHT - PAD.bottom} L ${PAD.left} ${HEIGHT - PAD.bottom} Z`} fill="var(--primary)" opacity={0.1} />
        <DraggableHandle x={scaleX.scale(0)} y={baseY} label="Base discount" active={active === "base"} onPointerStart={start("base")} onNudge={(d, big) => onChange("baseDiscountPct", params.baseDiscountPct + d * (big ? 0.25 : 0.05))} />
        <DraggableHandle x={scaleX.scale(params.maxDays)} y={rateY} label="Annual rate" active={active === "rate"} onPointerStart={start("rate")} onNudge={(d, big) => onChange("annualRatePct", params.annualRatePct + d * (big ? 1 : 0.25))} />
        <DraggableHandle x={scaleX.scale(bowDays)} y={bowY} label="Convexity bow" active={active === "bow"} onPointerStart={start("bow")} onNudge={(d, big) => onChange("convexity", params.convexity + d * (big ? 0.25 : 0.05))} color="warning" />
      </svg>
      {tooltip ? (
        <div
          className="pointer-events-none absolute rounded-md border border-border bg-surface-2 px-2 py-1 text-xs shadow"
          style={{ left: `${(tooltip.x / WIDTH) * 100}%`, top: `${(tooltip.y / HEIGHT) * 100}%`, transform: "translate(-50%, -130%)" }}
        >
          <span className="num">{tooltip.text}</span>
        </div>
      ) : null}
    </div>
  );
}

function Grid({
  maxY,
  maxX,
  scaleX,
  scaleY,
}: {
  maxY: number;
  maxX: number;
  scaleX: (value: number) => number;
  scaleY: (value: number) => number;
}) {
  const yTicks = [0, maxY / 4, maxY / 2, (maxY * 3) / 4, maxY];
  const xTicks = [0, maxX / 4, maxX / 2, (maxX * 3) / 4, maxX];
  return (
    <g>
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={scaleY(tick)} y2={scaleY(tick)} stroke="var(--border)" />
          <text x={PAD.left - 10} y={scaleY(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {pctLabel(tick, 1)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={scaleX(tick)} x2={scaleX(tick)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--border)" opacity={0.45} />
          <text x={scaleX(tick)} y={HEIGHT - 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {daysLabel(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}
