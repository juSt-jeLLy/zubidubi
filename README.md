# ZubiDubi

Self-custodial term liquidity for delayed-redemption DeFi assets on Aqua + SwapVM.

ZubiDubi lets a seller exit a delayed asset such as an LRT withdrawal receipt, PT, vault withdrawal share, or Sepolia `zbETH` receipt into wallet-held maker liquidity. Makers publish Aqua strategies, SwapVM prices each fill with a maturity/oracle/exposure curve, and the ZubiDubi route executor splits the exit across deliverable makers atomically.

## Live Sepolia Stack

- Aqua: `0xd265362BC3F34FBc7f5F7a075899dA9E3E20Da8e`
- AquaSwapVMRouter: `0xd4F7a64301416947D0f62c98B80F588ddEbCb741`
- ZubiDubiRouteExecutor: `0x2D1d8B08A810766f702ef29A01b6219964073a8d`
- ZubiDubiExitReceipt: `0x9c99F37e5Ad3F974eeb5a50F929EEa9fa70D3581`
- Subgraph Studio: `https://thegraph.com/studio/subgraph/zubidubi`
- Subgraph endpoint: `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.2.1`

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

- Real routed Sepolia fill: `0xca274ac4f8904d06674eca90c681a3d1338766aa3d74a7fa64df67001d85827c`
- Demo sold `0.003 zbETH`.
- Seller received `7.243334 USDC` net.
- DAO/protocol fee is indexed by the live subgraph.

See `plan.md` for the full product, technical, and bounty-alignment plan.
