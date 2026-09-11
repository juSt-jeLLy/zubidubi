export type CurveFamily = 0 | 1;

export type MakerCurveParams = {
  baseDiscountPct: number;
  annualRatePct: number;
  maxDiscountPct: number;
  curveFamily: CurveFamily;
  convexity: number;
  minDays: number;
  maxDays: number;
  inventorySlopePct: number;
  liquiditySlopePct: number;
  maxExposure: number;
  quoteLiquidity: number;
  riskTier: "conservative" | "balanced" | "aggressive";
  deviationPct: number;
};

export type Scale = {
  scale: (value: number) => number;
  unscale: (pixel: number) => number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): Scale {
  const domain = domainMax - domainMin || 1;
  const range = rangeMax - rangeMin || 1;
  return {
    scale: (value) => rangeMin + ((value - domainMin) / domain) * range,
    unscale: (pixel) => domainMin + ((pixel - rangeMin) / range) * domain,
  };
}

export function discountAtDays(params: MakerCurveParams, days: number) {
  const boundedDays = clamp(days, 0, Math.max(params.maxDays, 1));
  const linear = params.baseDiscountPct + params.annualRatePct * (boundedDays / 365);

  const fullTenorDiscount =
    params.baseDiscountPct + params.annualRatePct * (Math.max(params.maxDays, 1) / 365);
  const normalized = boundedDays / Math.max(params.maxDays, 1);
  const shaped =
    params.curveFamily === 1
      ? params.baseDiscountPct +
        (fullTenorDiscount - params.baseDiscountPct) *
          Math.pow(normalized, Math.max(params.convexity, 0.1))
      : linear;

  return clamp(shaped, 0, params.maxDiscountPct);
}

export function timeCurvePoints(params: MakerCurveParams, steps = 72) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const days = (params.maxDays / steps) * index;
    return { x: days, y: discountAtDays(params, days) };
  });
}

export function exposureDiscountAt(params: MakerCurveParams, exposure: number, liquidityUsePct = exposure) {
  const inventory = params.inventorySlopePct * clamp(exposure, 0, 100) / 100;
  const liquidity = params.liquiditySlopePct * clamp(liquidityUsePct, 0, 100) / 100;
  return clamp(params.baseDiscountPct + inventory + liquidity, 0, params.maxDiscountPct);
}

export function exposureCurvePoints(params: MakerCurveParams, steps = 72) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const exposure = (100 / steps) * index;
    return { x: exposure, y: exposureDiscountAt(params, exposure) };
  });
}

export function pathFromPoints(
  points: { x: number; y: number }[],
  scaleX: (value: number) => number,
  scaleY: (value: number) => number,
) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
    .join(" ");
}

export function pctLabel(value: number, digits = 2) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits })}%`;
}

export function daysLabel(value: number) {
  return `${Math.round(value)}d`;
}
