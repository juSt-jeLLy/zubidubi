import type { PointerEvent } from "react";

type DraggableCapLineProps = {
  orientation: "horizontal" | "vertical";
  position: number;
  from: number;
  to: number;
  active: boolean;
  label: string;
  onPointerStart: (event: PointerEvent<SVGLineElement>) => void;
};

export function DraggableCapLine({
  orientation,
  position,
  from,
  to,
  active,
  label,
  onPointerStart,
}: DraggableCapLineProps) {
  const common = {
    stroke: "var(--warning)",
    strokeWidth: active ? 3 : 2,
    strokeDasharray: "7 5",
    className: "cursor-grab touch-none",
    onPointerDown: onPointerStart,
    "aria-label": label,
  };

  return orientation === "horizontal" ? (
    <>
      <line x1={from} x2={to} y1={position} y2={position} {...common} />
      <line x1={from} x2={to} y1={position} y2={position} stroke="transparent" strokeWidth={24} onPointerDown={onPointerStart} className="cursor-grab touch-none" />
    </>
  ) : (
    <>
      <line y1={from} y2={to} x1={position} x2={position} {...common} />
      <line y1={from} y2={to} x1={position} x2={position} stroke="transparent" strokeWidth={24} onPointerDown={onPointerStart} className="cursor-grab touch-none" />
    </>
  );
}
