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

Live Studio endpoint (v0.9.3, current):

`https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.3`

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
- Pyth ETH/USD adapter: `0xE5179Bf17673A8Ab717F941a5A5BfedE64a2a2a4`
- Core start block: `11677683` (current multi-asset term-book deployment window)

Current PT-style Sepolia receipts indexed by v0.9.3:

| Asset | Address | Start block | Backing |
| --- | --- | --- | --- |
| PT-zbETH-30D | `0xc53C8D1fFBbb502E1a9004a93Ea33Adc2039F513` | 11677693 | WETH |
| PT-zbETH-180D | `0x4Ef8c0e1a313dFf9c25512Fb6dF10C871879A029` | 11677694 | WETH |
| PT-zbUSD-30D | `0xa6D3A922AA36b37cD9E3fB7A0436aC7df310ae57` | 11677695 | USDC |
| PT-zbUSD-180D | `0x4bd685DA37569691Cc7427B7Ce509a23bc70b044` | 11677696 | USDC |
| PT-zbLINK-30D | `0x6D6FDf4D13d2B440CfbfD464A11C55af05964e96` | 11677697 | LINK |
| PT-zbLINK-180D | `0x5e34350A960911490B9D78f3424BB4303EF29757` | 11677698 | LINK |

## Live Proof Transactions

- Deploy AquaSwapVMRouter: `0x240535fd3b5c42087a84aedc0a515ee99f3b02a4b8d211d0809236880dbdd4ba`
- Deploy ZubiDubiExitReceipt: `0x9453d2362987b4bb39bbdc510f5489079244acbe61d7e68865ee6e8c2874adb5`
- Deploy ZubiDubiRouteExecutor: `0x32be16feff1d92c133346bf109836a5fc2364a90805e4ef9a12d5541e48b1e71`
- Routed fill (convex curve): `0x77518aa105405c1986fd2499f414285ac6ba62f2f7fc10542953f74dbdb46da7`

The v0.9.3 subgraph indexes the hardened core stack plus the live multi-asset Sepolia term book: WETH-, USDC-, and LINK-backed receipts, USDC/WETH payouts, routed fills, DAO fee accrual, receipt issuance, and executable order bytes for the Graph-backed solver. Studio versions v0.6.0/v0.6.1 (indexing_error), v0.8.1 (burned mapping), and v0.8.2 (old WETH-only buckets) are inert; v0.9.3 is the current production query target. Deleting a Studio version label is a dashboard action (Studio -> Deployments -> kebab menu -> Delete); the graph CLI exposes no per-version removal.

## Where This Improves ZubiDubi

- Solver discovery: query active `zubiDubiStrategies` instead of scanning Aqua logs live.
- Market reconstruction: query `markets` to see aggregate active liquidity, exposure, routes, volume, and protocol revenue.
- Route fill tape: query `routeFills` for maker attribution and execution prices.
- Position timeline: query `strategySnapshots` for strategy state changes over time.
- Routing quality: sort makers by exposure, available virtual quote balance, and recent fill history.
- Risk dashboard: show which makers are accumulating too much receipt exposure.
- DAO revenue: query `cumulativeProtocolSideRevenue` and `routeFees` for revenue-share proof.
- Demo story: show the same live query pattern powering solver, analytics, and frontend.
