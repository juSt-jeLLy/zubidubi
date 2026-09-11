import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { fmtNum } from "@/lib/zubi-data";

export function SliderRow({
  label,
  value,
  set,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="num text-primary">
          {fmtNum(value, step < 1 ? 2 : 0)}
          {suffix === "k" ? "" : suffix}
        </span>
      </div>
      <Slider
        className="mt-2.5"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => set(next[0] ?? min)}
      />
    </div>
  );
}
