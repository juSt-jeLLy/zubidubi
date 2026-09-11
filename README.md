# ZubiDubi

**Self-custodial term-liquidity networks for delayed-redemption DeFi assets.**
Makers quote programmable term-risk curves from their own wallets. Sellers get instant USDC/WETH. No pools. No locked capital. No future liabilities.

---

> **The core DeFi problem:** assets that trade like liquid tokens but represent positions that are *not* instantly redeemable — vault withdrawal shares, restaking receipts, principal-token claims, bridge receipts. When a holder needs liquidity *now*, they face three bad options: wait for a withdrawal queue, sell into thin fragmented markets, or accept opaque RFQ pricing. Meanwhile, anyone who *would* buy the claim at a fair discount has to lock capital into one isolated pool per asset, per maturity, per risk profile.

**ZubiDubi is the missing primitive: a programmable, wallet-native term-liquidity book where one maker wallet underwrites many delayed exits with a single executable term curve — and every fill settles atomically onchain.**

**Live on Sepolia right now.** Six public maturing receipt assets, seven shipped maker strategies, a live subgraph-indexed market book, a Graph-backed solver, and a frontend that issues, sells, and redeems from a connected wallet.

---

## Why this exists

DeFi has a growing class of assets that are *tradable today but redeemable later*:

- Restaked-asset receipts with withdrawal queues, slashing and depeg risk.
- Staking/LST withdrawal receipts that redeem at a future point.
- Principal-token receipts whose value converges to par at maturity.
- Vault withdrawal shares gated by withdrawal epochs.
- Bridge withdrawal receipts and delayed settlement claims.

Their fair price depends on **time, risk, backing value, and liquidity stress**. But today there is no capital-efficient, programmable market where a holder can exit early at a *fair, risk-adjusted, maturity-aware* price — and no way for an LP to earn that duration risk without fragmenting idle capital across dozens of pools.

**The result is a market-structure gap:** delayed-redemption assets do not have a programmable exit-liquidity market.

## What we built

ZubiDubi is a **term-liquidity network** with three layers:

1. **A backed, transferable maturing claim** (`ZubiDubiExitReceipt`) — deposit real backing (WETH/USDC/LINK on Sepolia), receive a 1:1 maturing receipt with onchain `expiry()`.
2. **A wallet-native order book** (Aqua + a modified `AquaSwapVMRouter`) — makers keep USDC/WETH in their own wallets, publish term-discount strategies, and Aqua pulls funds **only when a trade executes**.
3. **A pricing + routing engine** (`ZubiDubiRouteExecutor` + modular SwapVM instruction library) — every fill is priced by a real term-structure curve (time-to-maturity, oracle backing, inventory, liquidity depth, risk tier, max-discount guardrails) and split atomically across the best executable makers.

### How a single exit works

1. A holder selects a maturing claim and amount.
2. The solver discovers live maker strategies from the indexed market book.
3. SwapVM prices each candidate fill with the maker's term curve (the longer the delay, the deeper the discount; the more the maker already holds, the more it reprices).
4. The router checks **real deliverability** per maker — `min(Aqua virtual balance, wallet balance, allowance)` — and skips anyone who cannot actually pay.
5. Aqua pulls USDC/WETH from maker wallets; the taker's claim moves to the makers; settlement is **one atomic transaction** or it fully reverts.

> **Design principle — no future liability:** the maker pays liquid tokens *now* and receives the claim *now*. The future redemption risk is held by the maker as an *asset*, never as an unpaid obligation. Nobody trusts a counterparty to keep an allowance open later — there is nothing left to trust.

---

## The term-structure engine

The discount is a real yield-curve primitive, not a flat fee:

```text
backingValue   = amountIn × oracleBackingPrice
termDiscount   = annualizedRate × secondsToMaturity / YEAR
convexPremium  = convexityBps × (secondsToMaturity / YEAR)²        # family 1, full precision
totalDiscount  = baseSpread + termDiscount + convexPremium
               + riskTierHaircut + inventoryPenalty + liquidityDepthPenalty
amountOut      = backingValue × (1 − min(totalDiscount, maxDiscount))
```

- **Linear family (0):** discount grows linearly with time to maturity — byte-for-byte backward compatible with every legacy strategy.
- **Convex family (1):** a true quadratic convexity premium (`Math.mulDiv`, full precision) so long-dated receipts are discounted more steeply than a straight line. `convexityBps` is an annualized curvature: `150 bps` quotes a ~1 bps premium at 30 days — measurable, never truncated to zero.
- **Annualized risk-tier haircut:** `riskTierBps` is an asset-class premium (depeg, slashing tail risk, share liquidity class) charged *per year of remaining delay*, not as a flat add.
- **Guardrails:** oracle staleness windows, cross-provider deviation bounds, maturity windows, max notional, allowed asset pairs, max discount, inventory/exposure caps, and liquidity-depth penalties — all enforced at fill time.

One maker wallet can therefore quote **many assets and maturities** from one curve, with the same USDC balance backing every strategy.

---

## Architecture

```text
 holder                         maker/LP
   │  sells maturing claim        │  keeps USDC/WETH in wallet, ships curve
   ▼                              ▼
ZubiDubiExitReceipt          AquaSwapVMRouter (modified, EIP-170)
   │                              │  modular SwapVM instructions:
   │                              │  BACKING_ORACLE_CHECK → EXPOSURE_CAP → DISCOUNT_CURVE_1D
   ▼                              ▼
ZubiDubiRouteExecutor  ──quotes/splits──►  multiple maker strategies
   │  atomic settle (approve → routeExactIn)
   ▼
 Aqua pulls liquid tokens from maker wallets; taker's claim moves to makers; DAO fee paid

 Indexing + discovery (The Graph / Substreams)
   │  markets, strategies, fills, snapshots, exposure, fees
   ├──► Solver API  ──►  Frontend (/markets /sell /make /portfolio /playground)
   └──► Graph-backed solver  ──►  CLI / automation
```

**Key architectural decisions**

| Decision | Why |
| --- | --- |
| Makers stay self-custodial | No idle locked TVL; one wallet balance underwrites many strategies; funds leave the wallet only on a real fill |
| Reusable modular instruction library | `BACKING_ORACLE_CHECK`, `EXPOSURE_CAP`, `DISCOUNT_CURVE_1D` are composable opcodes — reusable by any Aqua app, with the DAO fee kept at route level |
| Route executor quotes & settles | Fresh balance/allowance checks at execution time; the index is for *discovery*, the chain is the source of *truth* |
| The Graph reconstructs the book | `Market`, `ZubiDubiStrategy` (executable order bytes), `RouteFill` tape, `StrategySnapshot`, `MakerExposure`, `RouteFee` — one query surface for app + solver |
| Substreams extraction | A reusable `aqua-liquidity` extractor streams strategy lifecycle deltas for cross-chain scale |
| Free tradability (deliberate) | The receipts are freely transferable — like any real delayed-redemption claim. We don't gate transfers; we price the fair early-exit discount. Liquidity ≠ redemption, and that mismatch is the product |

---

## Contracts — in detail

All sources live in `swap-vm/src/` and are deployed on Sepolia (see the live stack below).

### `ZubiDubiExitReceipt.sol`
A standard, freely tradable ERC20 delayed-redemption receipt — the same shape as a real principal-token claim.

- Immutable **underlying**, **maturity** (`expiry()`), and **assetsPerReceipt** (1:1 par backing).
- `issue(assets, receiver)` — pulls real backing from the caller (via `transferFrom`) and mints the maturing claim to `receiver`.
- `previewIssue(assets)` — onchain quote for the frontend.
- `redeem(receiptAmount, receiver)` — maturity-gated 1:1 redemption after `expiry()`.
- Stock ERC20 — fully transferable, so it can be routed anywhere (and through ZubiDubi) before maturity.

### `instructions/AquaExitTerm.sol` — the reusable term-liquidity instruction library
Three composable opcodes, each with a dedicated role:

- **`BACKING_ORACLE_CHECK`** (`_aquaExitBackingOracleCheck`) — validates token pair, maturity window, oracle freshness, positive normalized backing value, and optional cross-provider deviation bounds (`_oracleDeviationBps`).
- **`EXPOSURE_CAP`** (`_aquaExitExposureCap`) — enforces maker receipt inventory and quote-token notional limits before a fill can execute.
- **`DISCOUNT_CURVE_1D`** (`_aquaExitDiscountCurve1D`) — prices exact-in/exact-out from backing value, time to maturity, curve family (linear/convex), max discount, inventory exposure, liquidity depth, and risk tier.

Legacy 166-byte strategies parse as the linear family with zero behavior change; opcode slot `0x23` stays reserved for index stability.

### `routers/AquaSwapVMRouter.sol` — the modified router
The deployable ZubiDubi router integrates the term-liquidity library into the Aqua AMM-style router and stays **under EIP-170**: 24,337 runtime bytes (239 bytes of margin). The unused external-delegation slot (`Extruction`) is pruned from this router build to make room; it remains available in the repo's other opcode sets.

### `ZubiDubiRouteExecutor.sol` — the routing engine
- Discovers candidate strategies (from the solver/indexer, intentionally unsorted) and checks **deliverable liquidity** as `min(Aqua virtual balance, wallet balance, allowance)`.
- Skips makers with only virtual liquidity, revoked allowances, or moved wallet balances.
- Sorts by best net output, splits the exit greedily, binary-searches partial fills, and enforces a deterministic max-fill limit.
- **Never overcounts** the same maker wallet across multiple strategies.
- Settles **atomically** — full fill or full revert.
- Charges a protocol/DAO fee (10 bps of output) to a configured fee recipient and emits fee events.

### Supporting contracts
- `ZubiDubiDemoSeller.sol` / `ZubiDubiDemoTaker.sol` — demo counterparties for the Foundry proof.
- Chainlink ratio-oracle adapters — onchain price composition for every receipt/payout pair.

---

## Live Sepolia stack

| Component | Address | Notes |
| --- | --- | --- |
| Aqua | `0x30aefbDE9EC52A23E597e338F02f35Da909D7183` | shared wallet-liquidity settlement |
| `AquaSwapVMRouter` (modified) | `0x3d39B155De93CB9C340577E06b801C4956ed2a57` | term-curve library, 24,337 bytes |
| `ZubiDubiRouteExecutor` | `0x95d74BF2a83bc3ba50dc5c377cE8fB1478Ae5708` | 10 bps DAO fee, max 8 fills |
| `ZubiDubiExitReceipt` | `0xb7877571932A025E03a7B9616F254B361FD1759F` | original WETH-backed receipt |
| Pyth ETH/USD adapter | `0xE5179Bf17673A8Ab717F941a5A5BfedE64a2a2a4` | dual-oracle path |
| Subgraph | `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.3` | live market book |

**Public maturing asset universe** — six PT-style receipts backed 1:1 by real Sepolia WETH, USDC and LINK, priced with real Chainlink feeds:

| Asset | Address | Maturity | Backing | Live payout routes |
| --- | --- | --- | --- | --- |
| PT-zbETH-30D | `0xc53C8D1fFBbb502E1a9004a93Ea33Adc2039F513` | 2026-10-11 | WETH 1:1 | USDC, WETH |
| PT-zbETH-180D | `0x4Ef8c0e1a313dFf9c25512Fb6dF10C871879A029` | 2027-03-10 | WETH 1:1 | USDC |
| PT-zbUSD-30D | `0xa6D3A922AA36b37cD9E3fB7A0436aC7df310ae57` | 2026-10-11 | USDC 1:1 | USDC |
| PT-zbUSD-180D | `0x4bd685DA37569691Cc7427B7Ce509a23bc70b044` | 2027-03-10 | USDC 1:1 | WETH |
| PT-zbLINK-30D | `0x6D6FDf4D13d2B440CfbfD464A11C55af05964e96` | 2026-10-11 | LINK 1:1 | USDC |
| PT-zbLINK-180D | `0x5e34350A960911490B9D78f3424BB4303EF29757` | 2027-03-10 | LINK 1:1 | WETH |

### Onchain proof (hardened convexity-fixed stack, deployed block 11676033)

- **Routed fill** — `0x77518aa105405c1986fd2499f414285ac6ba62f2f7fc10542953f74dbdb46da7` (block 11676051): `0.003 zbETH` sold for **`7.152727` USDC net**. The route selected the best of three live curves — convex gross `7.159886`, linear gross `7.111608`, steep linear gross `6.966040`.
- The sold `zbETH` was issued by depositing real `0.003 WETH` into `issue()` — every demo token is a backed maturing claim.
- The 10 bps DAO fee (`7,159` USDC base units) was transferred to the fee recipient and is indexed live.
- After the fill, inventory/exposure repricing moved the next `0.003 zbETH` quote to **`7.104497` USDC net** — proof that maker inventory is priced into the curve.

### Real-asset mainnet fork proof

ZubiDubi also routes a **real principal token** — not a demo receipt — on a mainnet fork:

- Token: `PT-USD3-17DEC2026` (`0x7f47c3e6b2c00fC4eB4d5Ae50d0Ab0Ab6888Eb4D`, maturity `2026-12-17`), payout in real mainnet USDC (`0xA0b86991...6eB48`), par value via real Chainlink USDC/USD (`0x8fFfFfd4...`).
- Result: an early exit of `220 PT-USD3-17DEC2026` routed across maker curves and settled with real ERC20 transfers — **`212.469044` USDC net** after the DAO fee.
- Fresh-maker quote `0.9766608` vs post-inventory quote `0.9638757` — the same maker reprices after buying exposure (`-131 bps`), and the executed rate beats the external implied market rate by `+112 bps` for the seller.

```bash
MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract ZubiDubiPendleMainnetFork -vv   # real-asset fork proof
```

---

## Indexing layer (The Graph + Substreams)

The Graph is part of the core app path, not a dashboard. The subgraph (`subgraph/`) reconstructs a solver-grade book:

- **`Market`** — strategy counts, virtual receipt/quote liquidity, exposure, volume, routes, DAO revenue.
- **`ZubiDubiStrategy`** — stores executable SwapVM order bytes so the solver can rebuild routes from indexed data.
- **`RouteFill`** — per-maker fill tape with execution price and tx hash.
- **`StrategySnapshot`** — strategy timeline across ship / push / pull / swap / dock.
- **`MakerExposure`** — concentration and inventory pressure.
- **`RouteFee`** — DAO revenue with market-level rollups.

`substreams/aqua-liquidity/` is a reusable Aqua shared-liquidity extractor (Rust, `wasm32`): it streams standardized `SHIPPED / PUSHED / PULLED / DOCKED` deltas — the fast, cross-chain extraction path that feeds the subgraph as the market grows.

## Graph-backed solver + API

```bash
npm run zubidubi:graph-quote                        # quote only
ZUBIDUBI_EXECUTE=1 npm run zubidubi:graph-quote     # quote + atomic execute
npm run zubidubi:solver-api                         # product API for the frontend
```

The solver discovers executable strategies *from the index*, decodes their SwapVM orders, then calls `ZubiDubiRouteExecutor.quoteExactIn` for **fresh** balance/allowance/virtual-liquidity checks before returning a route. The API exposes `GET /health`, `GET /pitch`, `GET /markets`, and `GET|POST /quote` (which returns `422 insufficient_liquidity` with requested/available/shortfall amounts when makers cannot fill). Pyth pull-based feeds refresh via `npm run zubidubi:pyth:update-sepolia`.

---

## Frontend

The app (`frontend/`, TanStack Start + Vite + Privy) uses the same live paths as the CLI:

| Route | What it does |
| --- | --- |
| `/` | Narrative landing with a direct **Get demo assets** CTA into the acquire flow |
| `/markets` | Live subgraph market board — strategies, liquidity, maturities, activity (15s refresh) |
| `/sell` | Swap-style early-exit terminal: live solver quote, per-maker fill breakdown, benchmark panel, then real `approve()` + `routeExactIn()` from the connected wallet |
| `/make` | Maker strategy builder — encodes the modular instruction program via the solver API and ships it onchain (`approve(quoteToken → Aqua)` + `Aqua.ship(...)`) |
| `/portfolio` | Live holdings, wallet receipt balances, **Acquire demo claims** (dropdown → popup → deposit backing → `issue()` to wallet), redeem-at-maturity with real `redeem()` txs |
| `/playground` | Verification console — Graph solver, oracle, invariant and demo-run proofs |

### The end-to-end demo lifecycle

1. **Acquire** — pick a claim in the popup, enter the backing amount, `approve` + `issue()`; the maturing receipt lands in your wallet (real WETH/USDC/LINK transfers).
2. **Sell early** — the solver prices your claim on the live term book; sign one atomic `routeExactIn`; the maker's USDC/WETH lands in your wallet at a risk-adjusted discount.
3. **Redeem** — anyone holding a matured receipt redeems it 1:1 for the underlying after `expiry()`.

---

## What we changed, and where every file lives

### `swap-vm/` — contracts (the core innovation)

| File | What it is / what we changed |
| --- | --- |
| `src/instructions/AquaExitTerm.sol` | **Our reusable term-liquidity instruction library** — `BACKING_ORACLE_CHECK`, `EXPOSURE_CAP`, `DISCOUNT_CURVE_1D` (oracle/staleness/deviation, exposure & notional caps, linear+convex discount curve with risk-tier, inventory, liquidity-depth, max-discount) plus args coder/parser |
| `src/opcodes/AquaOpcodes.sol` | Aqua opcode table — modular instruction set wired in; slot `0x23` reserved for index stability |
| `src/routers/AquaSwapVMRouter.sol` | Custom Aqua router hosting the instruction library; EIP-170 pruned (unused `Extruction` slot removed for byte budget) |
| `src/ZubiDubiExitReceipt.sol` | Underlying-backed delayed-redemption receipt (`issue` / `previewIssue` / `redeem`, `expiry()`, `assetsPerReceipt`) |
| `src/ZubiDubiRouteExecutor.sol` | Multi-maker routing engine — deliverability checks, partial fills, binary search, atomic settlement, DAO fee |
| `src/ZubiDubiDemoSeller.sol`, `src/ZubiDubiDemoTaker.sol` | Demo counterparties for the onchain proof |
| `test/AquaExitTerm.t.sol` | Unit + integration suite for the instruction library |
| `test/ZubiDubiRouteExecutor.t.sol` | Multi-maker, revoked-allowance, moved-balance, max-fill, fee, partial-fill routing tests |
| `test/ZubiDubiDemo.t.sol` | Full end-to-end demo (4 makers, deliverability-aware split) |
| `test/ZubiDubiExitReceipt.t.sol` | Issue/preview/redeem lifecycle |
| `test/ZubiDubiSepoliaFork.t.sol` | Sepolia fork proof with real USDC + real Chainlink feed |
| `test/ZubiDubiPendleMainnetFork.t.sol` | **Real principal-token mainnet fork proof** (real asset, real USDC, real oracle) |
| `test/invariants/AquaExitCurveInvariants.t.sol` | **Invariants:** discount ≥ 0 and < par, amountOut monotonic in time, convex ≥ linear across a warped-time tape |
| `test/invariants/ZubiDubiRouteInvariants.t.sol` | **Invariants:** payouts capped at `min(wallet, allowance)`, route atomicity, fee/value conservation, same-maker dedup |
| `script/DeployZubiDubiSepolia*.s.sol` | Sepolia deployment scripts (stack, asset set) |
| `script/RunZubiDubiSepoliaRoutedDemo.s.sol` | Ships strategies + executes the routed fill demo |
| `script/RunZubiDubiSepoliaMultiAssetBook.s.sol` | Ships the public multi-asset, multi-maturity book |
| `script/ZubiDubiConfig.sol` | Addresses/curve parameters shared by scripts |
| `deployments/sepolia` | Verified deployment artifacts for every Sepolia contract |

### `aqua/` — vendored Aqua core (local copy, upstream-intact)
Settlement + strategy infrastructure ZubiDubi builds on; kept locally so the repo is self-contained.

### `sdks/` — TypeScript SDK (aligned to `swap-vm/v0.4.1`)

| File | What we changed |
| --- | --- |
| `typescript/swap-vm/src/swap-vm/instructions/aqua-exit-term/` | Args class + coder for the term-liquidity library |
| `typescript/swap-vm/src/swap-vm/programs/aqua-program-builder.ts` | `aquaExitTermLibrary()` builder that emits `BACKING_ORACLE_CHECK → EXPOSURE_CAP → DISCOUNT_CURVE_1D` |
| opcode list + tests | Opcode constants and encode/decode cross-validation tests |

### `subgraph/` — The Graph indexer

| File | What it does |
| --- | --- |
| `schema.graphql` | `Market`, `ZubiDubiStrategy`, `RouteFill`, `StrategySnapshot`, `MakerExposure`, `RouteFee` entities |
| `src/aqua.ts` | Aqua strategy/lifecycle mappings |
| `src/router.ts`, `src/route-executor.ts` | Router deploy + route/fill mappings |
| `src/receipt.ts` | Receipt lifecycle (issue/redeem) mapping |
| `queries/solver.graphql` | Solver-grade discovery query used by the CLI + API |

### `substreams/aqua-liquidity/`
Rust Substreams module (`src/lib.rs` + protobuf types) extracting standardized Aqua `SHIPPED / PUSHED / PULLED / DOCKED` lifecycle deltas; compiles to `wasm32-unknown-unknown`.

### `scripts/`
| File | What it does |
| --- | --- |
| `zubidubi-graph-solver.mjs` | Graph-backed solver CLI (quote / submit-execute) |
| `zubidubi-solver-core.mjs` | Shared solver core: subgraph discovery + Order decoding + onchain `quoteExactIn` |
| `zubidubi-solver-api.mjs` | Product HTTP API for the frontend |
| `update-pyth-sepolia.mjs` | Pyth pull-feed refresh for dual-oracle routes |

### `frontend/`
| Path | What it is |
| --- | --- |
| `src/routes/` | Landing, markets, sell, make, portfolio, playground pages |
| `src/services/graph/` | Subgraph GraphQL client |
| `src/services/markets/` | Market-board query + mappers (live data, 15s refresh) |
| `src/services/solver/` | Quote client, benchmark panel data, route execution |
| `src/services/maker/` | Strategy build + `Aqua.ship` execution |
| `src/services/portfolio/` | Receipt contracts, `demoClaims.ts` (builds the claim list **from the live subgraph**), `issueClaim.ts` (approve + `issue` + previews), portfolio queries |
| `src/services/privy/`, `src/services/wallet/` | Wallet plumbing (Privy) |
| `src/components/zubi/` | `AcquireDemoClaims` (dropdown → popup acquire flow), `SectionBoundary`, `QuoteBenchmarkPanel`, `StrategyList`, `Navbar` |

### `config/zubidubi-markets.json`
Single source of truth for the public Sepolia market config (core contracts, quote assets, strategy presets) shared by scripts, SDK, and tooling.

---

## Tests & verification

```bash
cd swap-vm
forge test                                         # full suite
forge test --match-contract AquaExitTerm           # instruction library
forge test --match-contract ZubiDubiRouteExecutor  # routing engine
forge test --match-contract ZubiDubiDemo           # end-to-end demo
forge test --match-contract "Invariant"            # invariant suites (curve + route)

cd ../sdks && pnpm test                            # SDK encode/decode
cd ../subgraph && yarn build && yarn test          # subgraph mappings
cd ../substreams/aqua-liquidity && cargo build --target wasm32-unknown-unknown
```

**Invariants proven:** discount never negative or above par · amountOut monotonic in time · convex family always discounts ≥ linear · makers never pulled for more than `min(wallet balance, allowance)` · routes fully atomic · value conserved across the route · same-maker liquidity never double-counted.

---

## Quickstart

```bash
# 1. Contracts
cd swap-vm && forge build && forge test

# 2. Solver against the live Sepolia book
cd .. && npm run zubidubi:graph-quote

# 3. Product API (for the frontend)
npm run zubidubi:solver-api          # http://localhost:8787  (GET /health, /pitch, /markets, /quote)

# 4. Frontend
cd frontend && npm install && npm run dev          # http://localhost:8080

# 5. Real-asset mainnet fork proof
MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract ZubiDubiPendleMainnetFork -vv
```

---

*Built to be self-custodial, atomically settled, and indexable end-to-end — from a backed maturing claim, through a wallet-native term book, to instant, fairly-priced early exit liquidity. The detailed internal build log lives in [`plan.md`](plan.md).*