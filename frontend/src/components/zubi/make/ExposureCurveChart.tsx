import { useMemo, useRef, useState, type PointerEvent } from "react";

import { DraggableCapLine } from "./DraggableCapLine";
import { DraggableHandle } from "./DraggableHandle";
import {
  clamp,
  exposureDiscountAt,
  makeScale,
  pathFromPoints,
  pctLabel,
  snap,
  type MakerCurveParams,
} from "./curveMath";

type Handle = "inventory" | "liquidity" | "cap";

type ExposureCurveChartProps = {
  params: MakerCurveParams;
  onChange: (key: keyof MakerCurveParams, value: number) => void;
};

const WIDTH = 760;
const HEIGHT = 360;
const PAD = { left: 48, right: 24, top: 24, bottom: 42 };

export function ExposureCurveChart({ params, onChange }: ExposureCurveChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<Handle | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const maxY = Math.max(params.maxDiscountPct * 1.2, params.baseDiscountPct + params.inventorySlopePct + params.liquiditySlopePct, 2);
  const exposureDomainMax = useMemo(
    () => Math.max(params.maxExposure * 1.35, params.maxExposure + 0.01, 1),
    [params.maxExposure],
  );
  const scaleX = useMemo(() => makeScale(0, exposureDomainMax, PAD.left, WIDTH - PAD.right), [exposureDomainMax]);
  const scaleY = useMemo(() => makeScale(0, maxY, HEIGHT - PAD.bottom, PAD.top), [maxY]);
  const points = useMemo(
    () =>
      Array.from({ length: 73 }, (_, index) => {
        const exposure = (exposureDomainMax / 72) * index;
        const exposurePct = (exposure / Math.max(params.maxExposure, 0.000001)) * 100;
        return { x: exposure, y: exposureDiscountAt(params, exposurePct) };
      }),
    [exposureDomainMax, params],
  );
  const path = pathFromPoints(points, scaleX.scale, scaleY.scale);
  const capX = scaleX.scale(params.maxExposure);
  const inventoryY = scaleY.scale(params.baseDiscountPct + params.inventorySlopePct);
  const liquidityY = scaleY.scale(params.baseDiscountPct + params.liquiditySlopePct);
  const liquidityX = scaleX.scale(params.maxExposure * 0.72);

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const updateFromPoint = (handle: Handle, point: { x: number; y: number }) => {
    if (handle === "inventory") {
      const target = clamp(scaleY.unscale(point.y), params.baseDiscountPct, 50);
      const value = snap(Math.max(0, target - params.baseDiscountPct), 0.1);
      onChange("inventorySlopePct", value);
      setTooltip({ x: scaleX.scale(100), y: scaleY.scale(params.baseDiscountPct + value), text: `inventory ${pctLabel(value)}` });
    }
    if (handle === "liquidity") {
      const target = clamp(scaleY.unscale(point.y), params.baseDiscountPct, 50);
      const value = snap(Math.max(0, target - params.baseDiscountPct), 0.1);
      onChange("liquiditySlopePct", value);
      setTooltip({ x: liquidityX, y: scaleY.scale(params.baseDiscountPct + value), text: `liquidity ${pctLabel(value)}` });
    }
    if (handle === "cap") {
      const value = snap(clamp(scaleX.unscale(point.x), 0.000001, exposureDomainMax), 0.01);
      onChange("maxExposure", value);
      setTooltip({ x: scaleX.scale(value), y: HEIGHT - PAD.bottom, text: `cap ${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}` });
    }
  };

  const start = (handle: Handle) => (event: PointerEvent<SVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(handle);
    updateFromPoint(handle, pointFromEvent(event));
  };
  const move = (event: PointerEvent<SVGSVGElement>) => active && updateFromPoint(active, pointFromEvent(event));
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
        <Grid maxY={maxY} maxX={exposureDomainMax} cap={params.maxExposure} scaleX={scaleX.scale} scaleY={scaleY.scale} />
        <DraggableCapLine orientation="vertical" position={capX} from={PAD.top} to={HEIGHT - PAD.bottom} active={active === "cap"} label="Max exposure cap" onPointerStart={start("cap")} />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={3} />
        <path d={`${path} L ${WIDTH - PAD.right} ${HEIGHT - PAD.bottom} L ${PAD.left} ${HEIGHT - PAD.bottom} Z`} fill="var(--primary)" opacity={0.1} />
        <DraggableHandle x={capX} y={inventoryY} label="Inventory slope" active={active === "inventory"} onPointerStart={start("inventory")} onNudge={(d, big) => onChange("inventorySlopePct", params.inventorySlopePct + d * (big ? 0.5 : 0.1))} color="primary" />
        <DraggableHandle x={liquidityX} y={liquidityY} label="Liquidity slope" active={active === "liquidity"} onPointerStart={start("liquidity")} onNudge={(d, big) => onChange("liquiditySlopePct", params.liquiditySlopePct + d * (big ? 0.5 : 0.1))} color="success" />
        <circle cx={capX} cy={scaleY.scale(exposureDiscountAt(params, 100))} r={3} fill="var(--warning)" />
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
  cap,
  scaleX,
  scaleY,
}: {
  maxY: number;
  maxX: number;
  cap: number;
  scaleX: (value: number) => number;
  scaleY: (value: number) => number;
}) {
  const yTicks = [0, maxY / 4, maxY / 2, (maxY * 3) / 4, maxY];
  const xTicks = [0, cap / 2, cap, maxX];
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
            {tick === cap ? "100% cap" : tick.toLocaleString("en-US", { maximumFractionDigits: 3 })}
          </text>
        </g>
      ))}
    </g>
  );
}
