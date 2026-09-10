# ZubiDubi Subgraph

Indexes the ZubiDubi Sepolia deployment:

- Aqua strategies shipped, pushed, pulled, and docked.
- SwapVM fills against Aqua strategies.
- ZubiDubi routed exits, maker skips, and protocol/DAO fee accrual.
- Receipt maturity/redemption metadata from the receipt token contract.
- Market-level liquidity, volume, exposure, route-fill, price, and revenue reconstruction.

This follows The Graph standardized-subgraph design idea: reusable protocol/account/token/swap/revenue-style entities first, with ZubiDubi-specific strategy and maker-exposure entities layered on top.

## Commands

```bash
npm install
npm run codegen
npm run build
```

To deploy to Subgraph Studio:

```bash
npx graph auth <DEPLOY_KEY>
npm run deploy:studio
```

Live Studio endpoint (v0.8.0, current):

`https://api.studio.thegraph.com/query/1760034/zubidubi/v0.8.0`

Run a live provider query:

```bash
npm run query:live
```

Run the app-level Graph-backed solver quote from the repo root:

```bash
npm run zubidubi:graph-quote
```

That command queries active strategies from this live subgraph, decodes the indexed SwapVM order bytes, and calls the Sepolia `ZubiDubiRouteExecutor.quoteExactIn` function for final deliverability-aware route pricing.

## Live Sepolia Contracts (fixed-convexity curve-family stack)

- Aqua: `0x30aefbDE9EC52A23E597e338F02f35Da909D7183`
- AquaSwapVMRouter: `0x3d39B155De93CB9C340577E06b801C4956ed2a57`
- ZubiDubiRouteExecutor: `0x95d74BF2a83bc3ba50dc5c377cE8fB1478Ae5708`
- ZubiDubiExitReceipt: `0xb7877571932A025E03a7B9616F254B361FD1759F`
- Start block: `11676033` (all datasources aligned to the fixed-convexity-stack deployment block)

## Live Proof Transactions

- Deploy AquaSwapVMRouter: `0x240535fd3b5c42087a84aedc0a515ee99f3b02a4b8d211d0809236880dbdd4ba`
- Deploy ZubiDubiExitReceipt: `0x9453d2362987b4bb39bbdc510f5489079244acbe61d7e68865ee6e8c2874adb5`
- Deploy ZubiDubiRouteExecutor: `0x32be16feff1d92c133346bf109836a5fc2364a90805e4ef9a12d5541e48b1e71`
- Routed fill (convex curve): `0x77518aa105405c1986fd2499f414285ac6ba62f2f7fc10542953f74dbdb46da7`

The v0.8.0 subgraph indexes the hardened fixed-convexity stack: 3 shipped strategies (convex-5000 + linear support programs), 1 routed fill (0.003 zbETH volume, 7.152727 USDC net), 0.007159 USDC DAO fee accrual, and re-exposes the executable order bytes to the Graph-backed solver, which can now also execute routes (`ZUBIDUBI_EXECUTE=1`). Studio versions v0.6.0/v0.6.1 (pre-fix era, indexing_error) are inert; only v0.8.0 serves production queries. Deleting a Studio version label is a dashboard action (Studio → Deployments → kebab menu → Delete); the graph CLI exposes no per-version removal.

## Where This Improves ZubiDubi

- Solver discovery: query active `zubiDubiStrategies` instead of scanning Aqua logs live.
- Market reconstruction: query `markets` to see aggregate active liquidity, exposure, routes, volume, and protocol revenue.
- Route fill tape: query `routeFills` for maker attribution and execution prices.
- Position timeline: query `strategySnapshots` for strategy state changes over time.
- Routing quality: sort makers by exposure, available virtual quote balance, and recent fill history.
- Risk dashboard: show which makers are accumulating too much receipt exposure.
- DAO revenue: query `cumulativeProtocolSideRevenue` and `routeFees` for revenue-share proof.
- Demo story: show the same live query pattern powering solver, analytics, and frontend.
