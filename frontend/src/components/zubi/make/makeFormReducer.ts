import { clamp, type MakerCurveParams } from "./curveMath";

export type MakeFormState = MakerCurveParams & {
  quoteLiquidity: number;
  maxExposure: number;
  maxNotionalOut: string;
};

export type MakeFormAction =
  | { type: "set-number"; key: keyof Pick<MakeFormState, "baseDiscountPct" | "annualRatePct" | "maxDiscountPct" | "convexity" | "minDays" | "maxDays" | "inventorySlopePct" | "liquiditySlopePct" | "maxExposure" | "quoteLiquidity" | "deviationPct">; value: number }
  | { type: "set-text"; key: "maxNotionalOut"; value: string }
  | { type: "set-risk"; value: MakeFormState["riskTier"] }
  | { type: "set-curve-family"; value: MakeFormState["curveFamily"] }
  | { type: "reset-market"; quoteLiquidity: number; maxExposure: number; maxDays?: number };

export const initialMakeFormState: MakeFormState = {
  baseDiscountPct: 0.4,
  annualRatePct: 6,
  maxDiscountPct: 4,
  curveFamily: 1,
  convexity: 1.8,
  riskTier: "balanced",
  minDays: 1,
  maxDays: 240,
  quoteLiquidity: 25,
  maxExposure: 1,
  maxNotionalOut: "",
  inventorySlopePct: 1.5,
  liquiditySlopePct: 0.6,
  deviationPct: 0,
};

function sanitize(state: MakeFormState): MakeFormState {
  const maxDiscountPct = clamp(state.maxDiscountPct, 0.25, 25);
  const baseDiscountPct = clamp(state.baseDiscountPct, 0, maxDiscountPct);
  const minDays = Math.round(clamp(state.minDays, 1, 720));
  const maxDays = Math.round(clamp(state.maxDays, minDays + 7, 900));

  return {
    ...state,
    baseDiscountPct,
    annualRatePct: Math.max(0, state.annualRatePct),
    maxDiscountPct,
    convexity: clamp(state.convexity, 0.25, 5),
    minDays,
    maxDays,
    inventorySlopePct: clamp(state.inventorySlopePct, 0, 50),
    liquiditySlopePct: clamp(state.liquiditySlopePct, 0, 50),
    maxExposure: Math.max(0.000001, state.maxExposure),
    quoteLiquidity: Math.max(0.000001, state.quoteLiquidity),
    deviationPct: clamp(state.deviationPct, 0, 10),
  };
}

export function makeFormReducer(state: MakeFormState, action: MakeFormAction): MakeFormState {
  if (action.type === "set-number") {
    return sanitize({ ...state, [action.key]: action.value });
  }

  if (action.type === "set-text") {
    return sanitize({ ...state, [action.key]: action.value });
  }

  if (action.type === "set-risk") {
    return sanitize({ ...state, riskTier: action.value });
  }

  if (action.type === "set-curve-family") {
    return sanitize({ ...state, curveFamily: action.value });
  }

  if (action.type === "reset-market") {
    return sanitize({
      ...state,
      quoteLiquidity: action.quoteLiquidity,
      maxExposure: action.maxExposure,
      maxNotionalOut: "",
      maxDays: action.maxDays ?? state.maxDays,
    });
  }

  return state;
}
