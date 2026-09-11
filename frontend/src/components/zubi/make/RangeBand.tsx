import type { PointerEvent } from "react";

type RangeBandProps = {
  x1: number;
  x2: number;
  y: number;
  height: number;
  active: "min" | "max" | null;
  onMinPointerStart: (event: PointerEvent<SVGLineElement>) => void;
  onMaxPointerStart: (event: PointerEvent<SVGLineElement>) => void;
};

export function RangeBand({
  x1,
  x2,
  y,
  height,
  active,
  onMinPointerStart,
  onMaxPointerStart,
}: RangeBandProps) {
  return (
    <g>
      <rect
        x={Math.min(x1, x2)}
        y={y}
        width={Math.abs(x2 - x1)}
        height={height}
        fill="var(--primary)"
        opacity={0.08}
      />
      <line
        x1={x1}
        x2={x1}
        y1={y}
        y2={y + height}
        stroke="var(--primary)"
        strokeWidth={active === "min" ? 4 : 2}
        className="cursor-ew-resize touch-none"
        onPointerDown={onMinPointerStart}
      />
      <line
        x1={x2}
        x2={x2}
        y1={y}
        y2={y + height}
        stroke="var(--primary)"
        strokeWidth={active === "max" ? 4 : 2}
        className="cursor-ew-resize touch-none"
        onPointerDown={onMaxPointerStart}
      />
      <line x1={x1} x2={x1} y1={y} y2={y + height} stroke="transparent" strokeWidth={24} onPointerDown={onMinPointerStart} className="cursor-ew-resize touch-none" />
      <line x1={x2} x2={x2} y1={y} y2={y + height} stroke="transparent" strokeWidth={24} onPointerDown={onMaxPointerStart} className="cursor-ew-resize touch-none" />
    </g>
  );
}
