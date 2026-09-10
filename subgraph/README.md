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
https://api.studio.thegraph.com/query/1760034/zubidubi/v0.4.0
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

- Aqua: `0x4D70dD3B2594A8AeD0544CE0434A2f93E27931AB`
- AquaSwapVMRouter: `0xc8a540840D23398fF44B4a20Cbc612d3b0ED0ECc`
- ZubiDubiRouteExecutor: `0xF6AA860E4d48BDEe0e1ec9B794ebB6ce1B0D00d2`
- ZubiDubiExitReceipt: `0x77ACf02293f802DF621d5ff0077e410dCf05C2fa`
- Start block: `11673656`

## Live Proof Transactions

- Deploy Aqua: `0xfebad005fcdd19f4e3e6014e588940efb8a72934313e6e03d1988ae89ea2987a`
- Deploy AquaSwapVMRouter: `0xa95c8c6d3604b992e5affefe001c6508f2f85585ec95628cd6814cc1b9c823a0`
- Deploy ZubiDubiExitReceipt: `0x79d547f3951e536b70cddd2e8786a111141cae00ca17a9dbdbfaeeea06bc1bb9`
- Deploy ZubiDubiRouteExecutor: `0x6336c7f26fac0582ec0ff74355295d7ba07eced6ec51e7f4762ea81dc390d424`
- Routed Sepolia demo final sell transaction: `0x845229237df8a77690fcd59fd753f4cfe7491f60379d7eb8f7e00246c62ce0ce`

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
