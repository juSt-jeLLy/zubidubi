import type { KeyboardEvent, PointerEvent } from "react";

type DraggableHandleProps = {
  x: number;
  y: number;
  label: string;
  active: boolean;
  onPointerStart: (event: PointerEvent<SVGCircleElement>) => void;
  onNudge: (direction: 1 | -1, big: boolean) => void;
  color?: "primary" | "success" | "warning";
};

function colorClass(color: DraggableHandleProps["color"]) {
  if (color === "success") return "var(--success)";
  if (color === "warning") return "var(--warning)";
  return "var(--primary)";
}

export function DraggableHandle({
  x,
  y,
  label,
  active,
  onPointerStart,
  onNudge,
  color = "primary",
}: DraggableHandleProps) {
  const handleKeyDown = (event: KeyboardEvent<SVGCircleElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      onNudge(1, event.shiftKey);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      onNudge(-1, event.shiftKey);
    }
  };

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={18}
        fill="transparent"
        className="cursor-grab touch-none"
        onPointerDown={onPointerStart}
      />
      <circle
        tabIndex={0}
        role="slider"
        aria-label={label}
        cx={x}
        cy={y}
        r={active ? 7 : 5}
        fill={colorClass(color)}
        stroke="var(--background)"
        strokeWidth={3}
        className="cursor-grab outline-none transition-all focus:stroke-white"
        onPointerDown={onPointerStart}
        onKeyDown={handleKeyDown}
      />
    </g>
  );
}
