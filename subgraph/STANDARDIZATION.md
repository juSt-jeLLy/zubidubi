# Graph Bounty Fit

ZubiDubi uses The Graph as the market data plane for Aqua/SwapVM strategies.

## Standardized Schema Leverage

The schema follows the standardized-subgraph pattern instead of exposing only bespoke ZubiDubi entities:

- `Protocol`: shared protocol metadata, versions, usage counters, volume, and protocol-side revenue.
- `Account`: maker, taker, recipient, and fee-recipient activity.
- `Token`: normalized token metadata.
- `Swap`: DEX/aggregator-style fill records.
- `RouteFee`: protocol-side revenue records.
- `Market`: pair-level liquidity, volume, revenue, and utilization records.
- `RouteFill`: maker-level execution tape with normalized price.

ZubiDubi then layers protocol-specific entities on top:

- `ZubiDubiStrategy`: Aqua strategy state and virtual balances.
- `StrategyBalance`: per-token Aqua pushed/pulled balance state.
- `MakerExposure`: maker receipt inventory, used by the solver and risk UI.
- `ReceiptAsset`: underlying, maturity, mint, and burn tracking.
- `MakerSkip`: skipped makers from real deliverability checks.
- `StrategySnapshot`: historical strategy state for route replay, risk review, and frontend charts.

This makes one query pattern reusable across:

- solver routing
- frontend market discovery
- DAO fee analytics
- maker exposure dashboards
- future multi-chain deployments

## Why Not Only RPC

Without the subgraph, the solver has to replay Aqua `Shipped`, `Pushed`, `Pulled`, SwapVM `Swapped`, and ZubiDubi route events directly from RPC. That does not scale and makes frontend quote discovery slow.

With the subgraph, the solver starts from indexed active strategies and only uses RPC for final freshness checks like current wallet balance and allowance.

## App Integration

The root app command `npm run zubidubi:graph-quote` uses this subgraph as the solver's discovery layer:

1. Query live active `ZubiDubiStrategy` entities from Subgraph Studio.
2. Decode each strategy's indexed `strategyData` back into executable SwapVM `Order` structs.
3. Pass those orders into `ZubiDubiRouteExecutor.quoteExactIn` on Sepolia.
4. Return a best-first route preview, candidate maker quotes, skipped makers, and net seller output.

This is the same pattern a frontend and production solver should use: The Graph narrows the market, then contracts perform final freshness checks and atomic settlement.

Compared to a basic event indexer, this gives ZubiDubi the same category of data plane that stronger Aqua projects used: an indexed live market that a deterministic solver can consume.

## Future Substreams Upgrade

If we want to strengthen the Graph bounty further, the natural next step is a reusable Substreams module for Aqua-style shared-liquidity flows:

- detect `Shipped`
- track virtual token balances from `Pushed`/`Pulled`
- emit normalized strategy balance deltas
- reuse the same module across chains and across any Aqua app

That would compose Substreams with this Subgraph, but the current implementation already satisfies the standardized-schema path and consumes live Studio data.
