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
https://api.studio.thegraph.com/query/1760034/zubidubi/v0.2.1
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

- Aqua: `0xd265362BC3F34FBc7f5F7a075899dA9E3E20Da8e`
- AquaSwapVMRouter: `0xd4F7a64301416947D0f62c98B80F588ddEbCb741`
- ZubiDubiRouteExecutor: `0x2D1d8B08A810766f702ef29A01b6219964073a8d`
- ZubiDubiExitReceipt: `0x9c99F37e5Ad3F974eeb5a50F929EEa9fa70D3581`
- Start block: `11671900`

## Live Proof Transactions

- Deploy Aqua: `0x0e4490668e79fdc2907ae3e406547526de1fcb738214d20785abd0f8e5e3c708`
- Deploy AquaSwapVMRouter: `0x7c7ed8716e5a4679b865d45d96c7dbbcf345dbdb0891fe99d8ac3026cbb2fc38`
- Deploy ZubiDubiExitReceipt: `0x74be4f2c3d266bf63c9cc451b7904cf4f942e79bb01deac0ed1ca45e2ce8cff8`
- Deploy ZubiDubiRouteExecutor: `0xb3595d3c1c07e9a07c50be84575ecca8f71fe2efa9b4d5d05b97a4b489470bd0`
- Routed Sepolia demo final sell transaction: `0xca274ac4f8904d06674eca90c681a3d1338766aa3d74a7fa64df67001d85827c`

The routed demo sold `0.003 zbETH` and paid `7.243334 USDC` net to the seller.

## Where This Improves ZubiDubi

- Solver discovery: query active `zubiDubiStrategies` instead of scanning Aqua logs live.
- Market reconstruction: query `markets` to see aggregate active liquidity, exposure, routes, volume, and protocol revenue.
- Route fill tape: query `routeFills` for maker attribution and execution prices.
- Position timeline: query `strategySnapshots` for strategy state changes over time.
- Routing quality: sort makers by exposure, available virtual quote balance, and recent fill history.
- Risk dashboard: show which makers are accumulating too much receipt exposure.
- DAO revenue: query `cumulativeProtocolSideRevenue` and `routeFees` for revenue-share proof.
- Demo story: show the same live query pattern powering solver, analytics, and frontend.
