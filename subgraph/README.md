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

Live Studio endpoint:

```text
https://api.studio.thegraph.com/query/1760034/zubidubi/v0.3.0
```

Run a live provider query:

```bash
npm run query:live
```

Run the app-level Graph-backed solver quote from the repo root:

```bash
npm run zubidubi:graph-quote
```

That command queries active strategies from this live subgraph, decodes the indexed SwapVM order bytes, and calls the Sepolia `ZubiDubiRouteExecutor.quoteExactIn` function for final deliverability-aware route pricing.

## Live Sepolia Contracts

- Aqua: `0x7E24a4C02F46dD2EF5A98c8865F6cA3Ab87bDFA9`
- AquaSwapVMRouter: `0xC124B7Db44306C411e51a8273e141b4FD3018662`
- ZubiDubiRouteExecutor: `0x62c99Fb801C6E3Ded8549bDD2B33abdDe0bAD354`
- ZubiDubiExitReceipt: `0x1585b2f1C396Cd9295e58FC0B51c065Ad5d68c03`
- Start block: `11673578`

## Live Proof Transactions

- Deploy Aqua: `0xa486e96f8dd58dfbe8554c3dbe8450fd9340d3ccd2289bc28016016f45618503`
- Deploy AquaSwapVMRouter: `0x96ebe0aa7afbf7b704a0919ebb42520f639d884d87f4d503528f66587fea40bd`
- Deploy ZubiDubiExitReceipt: `0xfbd1e2efca306f8b52066122684f2a78a417d1d0019fd79f1b7083a29054c3a9`
- Deploy ZubiDubiRouteExecutor: `0x685e07240027b0fe10fd28bf114f392aea636bc6cd634af087ed2a973c0fb028`
- Routed Sepolia demo final sell transaction: `0x55d171c389bddbf9d8afeefbed81f9690cece1938c1dd6fae3b3a651be3f5acc`

The modular routed demo sold `0.003 zbETH` and paid `7.256317 USDC` net to the seller.

## Where This Improves ZubiDubi

- Solver discovery: query active `zubiDubiStrategies` instead of scanning Aqua logs live.
- Market reconstruction: query `markets` to see aggregate active liquidity, exposure, routes, volume, and protocol revenue.
- Route fill tape: query `routeFills` for maker attribution and execution prices.
- Position timeline: query `strategySnapshots` for strategy state changes over time.
- Routing quality: sort makers by exposure, available virtual quote balance, and recent fill history.
- Risk dashboard: show which makers are accumulating too much receipt exposure.
- DAO revenue: query `cumulativeProtocolSideRevenue` and `routeFees` for revenue-share proof.
- Demo story: show the same live query pattern powering solver, analytics, and frontend.
