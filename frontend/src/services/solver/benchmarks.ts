import type { LiveMarket } from "@/services/markets/types";
import type { SolverQuote } from "@/services/solver/types";

export type QuoteBenchmark = {
  rateLabel: string;
  netRate: number | null;
  parRate: number | null;
  discountBps: number | null;
  headline: string;
  explanation: string;
  rows: { label: string; value: string; tone?: "good" | "warn" | "muted" }[];
};

function asNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | null, digits = 6) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function formatBps(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const sign = value > 0 ? "-" : value < 0 ? "+" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} bps`;
}

function isParComparable(market: LiveMarket) {
  const quote = market.quoteSymbol.toUpperCase();
  const underlying = market.underlying.toUpperCase();
  return quote === underlying || (quote === "USDC" && underlying.includes("USD"));
}

export function buildQuoteBenchmark(quote: SolverQuote | null, market: LiveMarket | null): QuoteBenchmark {
  if (!quote || !market) {
    return {
      rateLabel: "No quote",
      netRate: null,
      parRate: null,
      discountBps: null,
      headline: "Get a quote to compare the exit price",
      explanation:
        "The benchmark panel will show the executable route rate, fee-adjusted discount and external context when available.",
      rows: [],
    };
  }

  const input = asNumber(quote.quotedReceiptIn);
  const output = asNumber(quote.quotedNetOut);
  const netRate = input > 0 ? output / input : null;
  const comparableToPar = isParComparable(market);
  const parRate = comparableToPar ? 1 : null;
  const discountBps = netRate !== null && parRate ? (1 - netRate / parRate) * 10_000 : null;
  const recentIndexedDiscount = market.bestDiscount;

  const rows: QuoteBenchmark["rows"] = [
    {
      label: "Executable route rate",
      value:
        netRate === null
          ? "--"
          : `1 ${market.symbol} -> ${formatNumber(netRate)} ${market.quoteSymbol}`,
      tone: "good",
    },
    {
      label: comparableToPar ? "Par redemption benchmark" : "Benchmark source",
      value: comparableToPar
        ? `1 ${market.symbol} -> 1 ${market.quoteSymbol} at maturity`
        : "Onchain oracle curve; external Pendle side-by-side is shown in fork demo",
      tone: comparableToPar ? "muted" : "warn",
    },
  ];

  if (discountBps !== null) {
    rows.push({
      label: "Early-exit discount after fee",
      value: formatBps(discountBps),
      tone: discountBps > 0 ? "warn" : "good",
    });
  }

  if (recentIndexedDiscount !== null) {
    rows.push({
      label: "Recent indexed market discount",
      value: `${formatNumber(recentIndexedDiscount, 2)}%`,
      tone: "muted",
    });
  }

  if (quote.benchmark?.rate) {
    rows.push({
      label: quote.benchmark.label,
      value: `${formatNumber(Number(quote.benchmark.rate), 6)} ${market.quoteSymbol}`,
      tone: "muted",
    });
  }

  const headline =
    discountBps !== null
      ? discountBps > 0
        ? `You are exiting ${formatBps(discountBps)} below maturity par.`
        : `This route is ${formatBps(discountBps)} above maturity par.`
      : "This route is priced by the maker's oracle and inventory curve.";

  const explanation = comparableToPar
    ? "Par is the amount this receipt redeems for after maturity. The difference is the price of getting liquid tokens now."
    : "The payout asset differs from the backing asset, so the route uses the SwapVM oracle path onchain instead of a simple 1:1 par comparison.";

  return {
    rateLabel:
      netRate === null
        ? "--"
        : `${formatNumber(netRate)} ${market.quoteSymbol} / ${market.symbol}`,
    netRate,
    parRate,
    discountBps,
    headline,
    explanation,
    rows,
  };
}
