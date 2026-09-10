# ZubiDubi

Self-custodial term liquidity for delayed-redemption DeFi assets on Aqua + SwapVM.

ZubiDubi lets a seller exit a delayed asset such as an LRT withdrawal receipt, PT, vault withdrawal share, or Sepolia `zbETH` receipt into wallet-held maker liquidity. Makers publish Aqua strategies, SwapVM prices each fill with a maturity/oracle/exposure curve, and the ZubiDubi route executor splits the exit across deliverable makers atomically.

## Live Sepolia Stack

- Aqua: `0x7E24a4C02F46dD2EF5A98c8865F6cA3Ab87bDFA9`
- AquaSwapVMRouter: `0xC124B7Db44306C411e51a8273e141b4FD3018662`
- ZubiDubiRouteExecutor: `0x62c99Fb801C6E3Ded8549bDD2B33abdDe0bAD354`
- ZubiDubiExitReceipt: `0x1585b2f1C396Cd9295e58FC0B51c065Ad5d68c03`
- Subgraph Studio: `https://thegraph.com/studio/subgraph/zubidubi`
- Subgraph endpoint: `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.3.0`

## Graph-Backed Solver

```bash
npm run zubidubi:graph-quote
```

The solver flow is:

1. Query active ZubiDubi Aqua strategies from The Graph.
2. Decode indexed SwapVM order bytes.
3. Quote against the live Sepolia route executor.
4. Return route preview, maker candidates, skipped makers, and net seller output.

This makes The Graph part of the core app path, not just a dashboard: Graph handles scalable market discovery, while Sepolia contracts handle final balance, allowance, quote, and settlement checks.

The upgraded subgraph also reconstructs a solver-grade market book:

- `Market`: active strategy count, virtual receipt/quote liquidity, exposure, volume, routes, and DAO revenue.
- `RouteFill`: maker-level fill tape with execution price.
- `StrategySnapshot`: strategy state timeline across ship, push, pull, swap, and dock events.
- `MakerExposure`: maker inventory pressure for routing and risk views.

## Substreams Module

```bash
npm run zubidubi:substreams:check
```

`substreams/aqua-liquidity` is a reusable Aqua shared-liquidity extractor. It streams standardized Aqua lifecycle deltas:

- `SHIPPED`
- `PUSHED`
- `PULLED`
- `DOCKED`

This is the Graph-composability upgrade path: Substreams handles fast cross-chain extraction of Aqua balance/strategy deltas, and the deployed subgraph turns those deltas into the ZubiDubi market book used by the solver and frontend.

## Current Proof

- Real routed Sepolia fill: `0x55d171c389bddbf9d8afeefbed81f9690cece1938c1dd6fae3b3a651be3f5acc`
- Demo sold `0.003 zbETH`.
- Seller received `7.256317 USDC` net.
- DAO/protocol fee is indexed by the live subgraph.

See `plan.md` for the full product, technical, and bounty-alignment plan.
