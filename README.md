# ZubiDubi

**A self-custodial term-liquidity network for delayed-redemption DeFi assets.**

Makers quote programmable term-risk curves from their own wallets. Sellers get instant USDC/WETH for maturing DeFi positions. No isolated pools. No idle locked TVL. No future counterparty liability.

ZubiDubi is built on **Aqua** and **SwapVM**:

- Aqua keeps maker funds self-custodial and pulls them only at atomic settlement.
- SwapVM executes reusable term-liquidity instructions for oracle backing, exposure caps, and maturity-aware discount curves.
- The Graph reconstructs the live market book for discovery.
- The route executor verifies real deliverable liquidity onchain before any fill can happen.
- Shared term-risk budgets let one maker reserve coordinate sibling Aqua strategies, so rising book usage both reduces capacity and applies a utilization-based pressure discount across the rest of the maker's book.

## The Problem

DeFi has many assets that trade like tokens but represent positions that are **not instantly redeemable**:

- Principal Tokens and other maturing yield claims.
- LST/LRT withdrawal receipts.
- Vault withdrawal shares with epoch exits.
- Bridge withdrawal receipts.
- Any transferable claim with known backing but delayed settlement.

When holders need liquidity now, they usually have three bad choices:

1. Wait for the protocol withdrawal or maturity date.
2. Sell into thin or fragmented markets.
3. Accept opaque RFQ/OTC pricing.

At the same time, makers who are willing to buy those claims at a fair discount usually need to lock liquidity into separate pools for every asset, maturity, and risk profile. That fragments capital and creates idle TVL.

**ZubiDubi solves this market-structure problem: delayed-redemption assets need programmable, capital-efficient early-exit liquidity.**

## The Solution

ZubiDubi creates programmable term-liquidity books.

Makers publish strategies that say:

> "I will buy this maturing claim, but only at a discount that compensates me for time to maturity, oracle-backed value, risk tier, current inventory, and available liquidity."

Takers sell maturing claims and receive liquid tokens immediately.

The maker pays liquid tokens now and receives the claim now. That means the future redemption risk is held by the maker as an asset, not as an unpaid liability. Nobody depends on a maker keeping funds, approvals, or promises available in the future.

## How One Trade Works

1. A holder selects a maturing claim and amount.
2. The solver discovers active maker strategies from The Graph.
3. The route executor asks SwapVM to quote each candidate strategy.
4. SwapVM prices the fill with a maturity-aware term curve.
5. The route executor checks deliverable maker liquidity as:

```text
min(Aqua virtual balance, maker wallet balance, maker allowance)
```

6. Makers that cannot actually pay are skipped or partially filled.
7. The route splits across the best executable makers.
8. Aqua atomically pulls USDC/WETH from maker wallets.
9. The taker's maturing claim moves to makers.
10. The seller receives liquid tokens and the DAO fee is paid.

If the requested route cannot fully fill, the transaction reverts. There is no half-settled trade.

## Core Innovation

### 1. Reusable SwapVM Instruction Library

ZubiDubi is not one app-specific mega-opcode. It adds a reusable SwapVM instruction library for term-liquidity markets:

| Instruction | What it enforces |
| --- | --- |
| `BACKING_ORACLE_CHECK` | Oracle-backed par value, staleness, allowed asset pair, maturity window, optional secondary-oracle deviation bounds |
| `EXPOSURE_CAP` | Maker receipt inventory, max exposure, max quote notional, executable liquidity caps |
| `DISCOUNT_CURVE_1D` | Maturity-aware quote from time, base discount, annualized rate, convexity, risk tier, liquidity depth, and maker inventory |

Other Aqua apps can reuse these instructions with different routers, fee policies, or frontend markets.

### 2. Term-Structure Curve

The discount is a real term-structure primitive:

```text
backingValue   = amountIn * oracleBackingPrice
termDiscount   = annualRate * secondsToMaturity / YEAR
convexPremium  = convexityBps * (secondsToMaturity / YEAR)^2
inventoryFee   = inventorySlope * makerInventory / maxExposure
liquidityFee   = liquiditySlope * fillOut / availableMakerLiquidity
totalDiscount  = baseDiscount + termDiscount + convexPremium + riskTier + inventoryFee + liquidityFee
amountOut      = backingValue * (1 - min(totalDiscount, maxDiscount))
```

Curve families:

- **Family 0: linear** - discount grows linearly with time to maturity.
- **Family 1: convex** - adds a true quadratic premium using full-precision math so longer-dated claims discount more steeply.

Additional guardrails:

- max discount
- max receipt exposure
- max quote-token notional
- allowed token pair
- min and max maturity
- stale oracle protection
- optional secondary oracle deviation haircut
- liquidity-depth penalty
- risk-tier haircut

### 3. Wallet-Native Liquidity

Makers do not deposit into a pool. They keep USDC/WETH in their wallet and approve Aqua. Aqua tracks the strategy virtually and pulls funds only when a taker fill executes.

This lets one maker wallet quote multiple assets and maturities with the same capital base.

### 4. Deliverability-Aware Routing

The solver can discover candidate strategies offchain, but contracts are the source of truth. Before settlement, the route executor checks the maker's live wallet state and Aqua virtual state.

Makers are skipped when:

- their wallet balance moved
- their allowance was revoked
- their Aqua virtual balance is insufficient
- their exposure cap would be exceeded
- their oracle is stale
- their maturity or asset pair is outside the maker's policy

### 5. Shared Term-Risk Budgets

Aqua makes it possible for one wallet balance to quote many strategies, but that also creates a coordination problem: sibling strategies can all believe the same reserve is available until one of them fills.

ZubiDubi adds an explicit maker-level budget layer in `ZubiDubiRouteExecutor`:

- a maker creates a `budgetId` with max receipt exposure and max quote-token spend
- multiple Aqua strategies can be assigned to that same budget
- quotes are capped by the remaining global receipt and quote budget
- execution consumes the budget immediately, so sibling strategies lose capacity in future quotes
- the budget is indexed by The Graph and shown in maker portfolio and playground proof views

This turns wallet-held Aqua liquidity into a coordinated term-liquidity book instead of independent strategies racing the same maker balance.

## Architecture

```text
Holder wallet
  |
  | sells maturing claim
  v
ZubiDubiRouteExecutor
  |
  | quotes/splits candidate makers
  v
AquaSwapVMRouter + SwapVM instructions
  |
  | BACKING_ORACLE_CHECK -> EXPOSURE_CAP -> DISCOUNT_CURVE_1D
  v
Aqua settlement
  |
  | pulls maker USDC/WETH only if route is executable
  v
Maker wallets receive claims, seller receives liquid tokens, DAO fee accrues

The Graph + Substreams
  |
  | index strategies, fills, maker exposure, receipt lifecycle, DAO fees
  v
Solver API + frontend
```

## Live Sepolia Deployment

| Component | Address | Purpose |
| --- | --- | --- |
| Aqua | `0x30aefbDE9EC52A23E597e338F02f35Da909D7183` | shared liquidity settlement |
| AquaSwapVMRouter | `0x3d39B155De93CB9C340577E06b801C4956ed2a57` | modified router with reusable term-liquidity instructions |
| ZubiDubiRouteExecutor | `0x99488C09A54092Aa3C7e725137B45f3612CC5be1` | route splitting, deliverability checks, DAO fee, shared term-risk budgets |
| Original PT-zbETH receipt | `0xb7877571932A025E03a7B9616F254B361FD1759F` | WETH-backed receipt |
| Pyth ETH/USD adapter | `0xE5179Bf17673A8Ab717F941a5A5BfedE64a2a2a4` | optional dual-oracle path |
| Subgraph endpoint | `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.5` | live indexed market book |

Public Sepolia maturing assets use real Sepolia tokens and real Chainlink feeds:

| Asset | Address | Backing | Maturity | Live payout routes |
| --- | --- | --- | --- | --- |
| PT-zbETH-30D | `0xc53C8D1fFBbb502E1a9004a93Ea33Adc2039F513` | WETH 1:1 | 2026-10-10 | USDC, WETH |
| PT-zbETH-180D | `0x4Ef8c0e1a313dFf9c25512Fb6dF10C871879A029` | WETH 1:1 | 2027-03-09 | USDC |
| PT-zbUSD-30D | `0xa6D3A922AA36b37cD9E3fB7A0436aC7df310ae57` | USDC 1:1 | 2026-10-10 | USDC |
| PT-zbUSD-180D | `0x4bd685DA37569691Cc7427B7Ce509a23bc70b044` | USDC 1:1 | 2027-03-09 | WETH |
| PT-zbLINK-30D | `0x6D6FDf4D13d2B440CfbfD464A11C55af05964e96` | LINK 1:1 | 2026-10-10 | USDC |
| PT-zbLINK-180D | `0x5e34350A960911490B9D78f3424BB4303EF29757` | LINK 1:1 | 2027-03-09 | WETH |

All market config is in:

```text
config/zubidubi-markets.json
```

Live shared term-risk budget proof:

- Budget-aware executor: `0x99488C09A54092Aa3C7e725137B45f3612CC5be1`
- Budget ID: `0x25df91de3b0b88921665b1290762b8328e4239985cab7fb629b0d44fb642012a`
- Budget setup tx: `0xbfeb5d8d2054ff1957e572149f1921b4c91fa9c25849416c3ccb09f28101a2ed`
- Assigned sibling strategies: `PT-zbETH-30D/USDC` and `PT-zbETH-180D/USDC`
- Indexed by Subgraph Studio `v0.9.5` with `assignmentCount = 2` and `pressurePenaltyBps = 125`
- Solver quote now returns budget fields: `budgetRemainingIn = 0.006`, `budgetRemainingOut = 50`

## Repository Map

### Contracts and SwapVM changes

| Path | Purpose |
| --- | --- |
| `swap-vm/src/instructions/AquaExitTerm.sol` | reusable term-liquidity instruction library and args builder |
| `swap-vm/src/opcodes/AquaOpcodes.sol` | Aqua opcode table with `BACKING_ORACLE_CHECK`, `EXPOSURE_CAP`, `DISCOUNT_CURVE_1D` |
| `swap-vm/src/routers/AquaSwapVMRouter.sol` | deployable Aqua router with unused external delegation pruned to stay under EIP-170 |
| `swap-vm/src/ZubiDubiExitReceipt.sol` | backed maturing receipt contract with `issue`, `previewIssue`, and maturity-gated `redeem` |
| `swap-vm/src/ZubiDubiRouteExecutor.sol` | multi-maker solver/router settlement contract |
| `swap-vm/src/instructions/ChainlinkRatioOracleAdapter.sol` | onchain ratio adapter for real Chainlink-backed pairs |
| `swap-vm/src/instructions/PythOracleAdapter.sol` | optional Pyth adapter for dual-oracle routes |
| `swap-vm/src/ZubiDubiDemoSeller.sol` | demo seller wrapper for route execution |
| `swap-vm/src/ZubiDubiDemoTaker.sol` | demo taker helper |

### Deployment and live demo scripts

| Path | Purpose |
| --- | --- |
| `swap-vm/script/DeployZubiDubiSepolia.s.sol` | base Sepolia deployment |
| `swap-vm/script/DeployZubiDubiSepoliaStack.s.sol` | router, receipt, executor stack |
| `swap-vm/script/DeployZubiDubiSepoliaAssetSet.s.sol` | six PT-style Sepolia receipt assets and ratio oracles |
| `swap-vm/script/RunZubiDubiSepoliaDemo.s.sol` | simple live strategy/fill demo |
| `swap-vm/script/RunZubiDubiSepoliaRoutedDemo.s.sol` | routed fill demo with multiple curves |
| `swap-vm/script/RunZubiDubiSepoliaMultiAssetBook.s.sol` | ships the multi-asset public book |
| `swap-vm/script/ZubiDubiConfig.sol` | shared addresses and token config |

### SDK changes

| Path | Purpose |
| --- | --- |
| `sdks/typescript/swap-vm/src/swap-vm/instructions/aqua-exit-term/` | TypeScript args class, coder, tests and opcode declarations |
| `sdks/typescript/swap-vm/src/swap-vm/programs/aqua-program-builder.ts` | builder methods: `aquaExitBackingOracleCheck`, `aquaExitExposureCap`, `aquaExitDiscountCurve1D`, `aquaExitTermLibrary` |
| `sdks/typescript/swap-vm/src/swap-vm/instructions/index.ts` | local ZubiDubi Aqua opcode table alignment |

### The Graph

| Path | Purpose |
| --- | --- |
| `subgraph/schema.graphql` | standardized market, strategy, fill, exposure, fee and receipt entities |
| `subgraph/src/aqua.ts` | indexes Aqua ship/push/pull/dock lifecycle |
| `subgraph/src/router.ts` | indexes SwapVM fill events |
| `subgraph/src/route-executor.ts` | indexes routed fills, maker skips, DAO fees and shared term-risk budgets |
| `subgraph/src/receipt.ts` | indexes receipt issue/redeem lifecycle |
| `subgraph/queries/solver.graphql` | query shape consumed by solver |
| `subgraph/STANDARDIZATION.md` | explanation of Graph standardization and composability |
| `substreams/aqua-liquidity/` | reusable Rust Substreams package for Aqua lifecycle deltas |

### Solver and API

| Path | Purpose |
| --- | --- |
| `scripts/zubidubi-solver-core.mjs` | Graph discovery, route quote, benchmark field, maker strategy byte builder |
| `scripts/zubidubi-solver-api.mjs` | local API: `GET /health`, `GET /pitch`, `GET /markets`, `GET|POST /quote`, `POST /strategies/build` |
| `scripts/zubidubi-graph-solver.mjs` | CLI graph solver, optional execute mode |
| `scripts/update-pyth-sepolia.mjs` | refreshes Pyth price before dual-oracle fills |

### Frontend

| Path | Purpose |
| --- | --- |
| `frontend/src/routes/index.tsx` | landing narrative |
| `frontend/src/routes/markets.tsx` | live subgraph market board |
| `frontend/src/routes/sell.tsx` | swap-style early-exit page, quote, benchmark, execute |
| `frontend/src/routes/make.tsx` | maker strategy builder with live dual-axis curve editor, real `approve` + `Aqua.ship` |
| `frontend/src/routes/portfolio.tsx` | holdings, strategies, route history, acquisition, redemption |
| `frontend/src/routes/playground.tsx` | live judge demo cockpit: scenario picker, Graph market state, solver quote preview, route split proof, protocol timeline |
| `frontend/src/services/markets/` | Graph market queries and mappers |
| `frontend/src/services/solver/` | solver quote client, route execution, quote benchmarks |
| `frontend/src/services/maker/` | strategy builder API client and Aqua ship transaction |
| `frontend/src/services/portfolio/` | receipt balance reads, `issue`, `redeem`, claim history |
| `frontend/src/services/playground/` | deploy-safe playground scenarios, quote mapping, proof catalog, and route preview model |
| `frontend/src/components/zubi/make/` | modular raw-SVG Time/Exposure curve editor for `BACKING_ORACLE_CHECK -> EXPOSURE_CAP -> DISCOUNT_CURVE_1D` strategy parameters |
| `frontend/src/components/zubi/AcquireDemoClaims.tsx` | popup flow to deposit backing and mint a maturing claim |
| `frontend/src/components/zubi/QuoteBenchmarkPanel.tsx` | quote context and maturity/par benchmark |
| `frontend/src/components/zubi/playground/` | modular playground panels for scenarios, market state, route split, protocol timeline, main proof catalog, detailed visual test map, copyable test commands, GitHub proof links, skipped-maker reasons, and live activity |
| `frontend/public/test-results/latest.json` | deploy-safe latest known proof status artifact for the Playground |

## Frontend Product Flow

The frontend is not static. It uses the same live systems as the contracts and scripts.

| Page | Live behavior |
| --- | --- |
| `/markets` | reads Subgraph Studio market data every 15 seconds |
| `/sell` | asks solver API for fresh route quote, blocks if insufficient liquidity, executes `approve` + `routeExactIn` |
| `/make` | builds encoded SwapVM strategy via `POST /strategies/build`, then executes `approve(quoteToken -> Aqua)`, `Aqua.ship(...)`, and optional shared term-risk budget registration |
| `/portfolio` | reads wallet receipt balances from contracts, maker strategies, shared budgets and routes from The Graph, submits real `issue()` and `redeem()` |
| `/playground` | deployable judge cockpit with live Graph markets, solver quotes, route split previews, budget/skip reasons, protocol proof timeline, activity tape, main proof catalog, copyable commands, GitHub proof links, latest proof status, and visual test map for curve, routing, guardrail, receipt, fork, and indexing tests |

## Tests and Proofs

### Main contract tests

```bash
cd swap-vm
forge test --match-contract AquaExitTermTest -vv
forge test --match-contract ZubiDubiRouteExecutorTest -vv
forge test --match-contract ZubiDubiDemoTest -vv
forge test --match-contract ZubiDubiExitReceiptTest -vv
```

The route executor suite includes shared-budget proofs:

- sibling strategies assigned to one budget cannot collectively exceed the maker's global reserve
- once one strategy fills, budget exposure/spend is consumed and the next sibling quote loses capacity

### Invariants

```bash
cd swap-vm
forge test --match-contract AquaExitCurveInvariants -vv
forge test --match-contract ZubiDubiRouteInvariants -vv
```

Invariant coverage:

- discount never negative
- discount never above par
- amountOut monotonic in time
- convex discount always at least linear discount
- maker payout capped at `min(wallet balance, allowance)`
- route atomicity
- fee and recipient value conservation
- same-maker multi-strategy liquidity is not double counted

### Sepolia fork proof

```bash
npm run zubidubi:sepolia-inventory-benchmark
```

This proves inventory-aware pricing against real Sepolia USDC and the real Chainlink ETH/USD feed. The same `0.0002 PT-zbETH` quote moves from `508095` USDC base units to `503204` after maker inventory increases, and a larger follow-up is rejected when it would exceed the maker exposure cap.

### Mainnet fork proof with real Pendle PT

```bash
MAINNET_RPC_URL=https://eth.drpc.org npm run zubidubi:pendle-benchmark
```

This uses real mainnet:

- `PT-USD3-17DEC2026`
- mainnet USDC
- Pendle RouterStatic implied PT rate
- Chainlink USDC/USD

Latest demo result:

```text
Pendle RouterStatic implied PT -> asset rate: 0.965766193005277136
ZubiDubi fresh-maker routed PT -> USDC rate: 0.976660800000000000
ZubiDubi after 200 PT maker inventory rate: 0.963875710000000000
Fresh ZubiDubi vs Pendle: +112 bps
Inventory penalty vs fresh ZubiDubi: -131 bps
```

The point is not that ZubiDubi is always cheaper. The point is that a maker-specific executable term curve can be compared against an external market benchmark, then transparently reprices as inventory changes.

## Running Locally

Install root dependencies:

```bash
npm install
```

Run the solver API:

```bash
npm run zubidubi:solver-api
```

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Run the Graph-backed solver:

```bash
npm run zubidubi:graph-quote
```

Execute the routed demo path from the solver:

```bash
ZUBIDUBI_EXECUTE=1 npm run zubidubi:graph-quote
```

Check Substreams package:

```bash
npm run zubidubi:substreams:check
```

Refresh Pyth Sepolia price before a dual-oracle live route:

```bash
npm run zubidubi:pyth:update-sepolia
```

## Environment

Required for local frontend:

```text
VITE_PRIVY_APP_ID=
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.5
VITE_SOLVER_API_URL=http://localhost:8787
```

Required for contract scripts and solver:

```text
SEPOLIA_RPC_URL=
PRIVATE_KEY=
MAINNET_RPC_URL=        # only for Pendle fork proof
PYTH_HERMES_API_KEY=    # only for live Pyth update path
```

No `.env` files are committed.

## Why This Fits Aqua / SwapVM

ZubiDubi is not a generic DeFi dashboard. It uses the core ideas of Aqua and SwapVM directly:

- **Aqua strategy:** wallet-held maker liquidity, virtually tracked across many term-liquidity strategies.
- **SwapVM instructions:** reusable executable logic for oracle backing, exposure caps, and maturity curves.
- **Onchain execution:** token transfers happen onchain through Aqua and `ZubiDubiRouteExecutor`.
- **Shared budget coordination:** sibling maker strategies can share one global term-risk budget rather than racing the same wallet liquidity independently.
- **Modified SwapVM contracts allowed:** the router is modified and redeployed to support the new instruction library.
- **Revenue path:** each routed fill pays a DAO/protocol fee from output proceeds.
- **Live proof:** real Sepolia transfers, real Chainlink feeds, real maturing receipt contracts, and a real Pendle PT mainnet fork.

## Final Submission Summary

ZubiDubi turns delayed-redemption DeFi positions into a programmable, self-custodial term-liquidity market.

Holders get instant liquidity for maturing claims. Makers earn the discount for underwriting duration and redemption risk without locking capital in isolated pools. Aqua handles self-custodial settlement. SwapVM makes the maker's term-risk policy executable. The Graph makes the market discoverable. The frontend makes the full lifecycle usable.

That is the project.
