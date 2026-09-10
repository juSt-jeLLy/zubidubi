# ZubiDubi

Self-custodial term liquidity for delayed-redemption DeFi assets.

## One-line pitch

AquaExit Term Curve lets makers provide wallet-native exit liquidity for LRTs, LST withdrawal receipts, PT/yield tokens, vault withdrawal shares, and other delayed-redemption assets. A custom SwapVM instruction prices each fill from a term-discount curve using redemption time, oracle backing value, depeg risk, and maker exposure, while Aqua pulls maker funds only at atomic settlement.

## Why this project exists

DeFi has many assets that trade like liquid tokens but represent positions that are not instantly redeemable.

Examples:

- LRTs backed by restaked ETH with withdrawal queues and slashing or depeg risk.
- LST withdrawal receipts that redeem later.
- PT/yield tokens whose value converges to redemption value at maturity.
- Vault shares with withdrawal epochs or delayed exits.
- Unstaking claims and other delayed redemption receipts.

The problem is not that these assets cannot be traded at all. The problem is that their liquidity is fragmented, risk-adjusted, and maturity-dependent.

When users need to exit early, especially during stress, they face three bad options:

- Wait for the protocol withdrawal queue.
- Sell into thin or fragmented markets.
- Accept opaque RFQ/OTC pricing.

Meanwhile, liquidity providers who could buy these assets at a discount must normally lock USDC/ETH into separate pools for every asset, maturity, and risk profile. That creates idle TVL and splits liquidity across many isolated venues.

The core DeFi problem:

Delayed-redemption assets do not have a capital-efficient, programmable exit-liquidity market.

## Research-backed validation

This is a real DeFi market-structure problem, not a generic payments or dashboard idea.

External research and protocol docs support three parts of the thesis:

1. LSTs and LRTs are liquid wrappers around assets with real redemption, slashing, depeg, and liquidity risks.
2. Yield-bearing assets and PT/YT markets create maturity-based pricing, where time to redemption directly changes fair value.
3. Liquidity for these assets fragments across protocols, assets, and maturities, forcing LPs to choose where to lock capital.

Useful references:

- SoK: Liquid Staking Tokens and Emerging Trends in Restaking: `https://arxiv.org/`
- Assessing Liquidity Risk in DeFi: `https://www.cork.tech/`
- Restaking risk: slashing, depegs, and exit queue attacks: `https://www.zealynx.io/`
- Common Vulnerabilities: Liquid Restaking Protocols: `https://sigmaprime.io/`
- 1inch Principal Tokens Explained: `https://1inch.com/blog/post/what-are-principal-tokens`
- Pendle Documentation: `https://docs.pendle.finance/pendle-v2/Introduction`
- Pendle: A Yield Derivatives Layer for DeFi: `https://consensys.io/blog/pendle-a-yield-derivatives-layer-for-defi`

The research-backed conclusion:

DeFi already has many assets that are tradable today but redeemable later. Their fair price depends on time, risk, backing value, and liquidity stress. ZubiDubi turns that into an Aqua-native liquidity primitive where makers quote those risks from wallet-held liquidity instead of locking capital into many separate pools.

## The combined idea

This project combines two ideas into one larger primitive.

### AquaExit

AquaExit is the exit-liquidity side.

Makers keep liquid assets such as USDC, WETH, or ETH in their own wallets. They publish strategies that say:

"I am willing to buy delayed-redemption assets, but only at a discount that compensates me for duration, depeg risk, oracle risk, and my current exposure."

Takers sell delayed-redemption assets and receive liquid tokens immediately.

### AquaTerm

AquaTerm is the term-structure side.

The price is not a fixed limit price and not a constant-product pool price. It is a maturity-aware discount curve.

The longer the redemption delay, the larger the discount. As the asset approaches redemption, the price rolls toward backing value. The same maker balance can support multiple assets and maturities through one programmable curve.

### Combined primitive

AquaExit Term Curve is a self-custodial market where one maker wallet can quote many delayed-exit assets using executable term-discount curves.

This is not a generic payment app and not a simple swap UI. It is a new Aqua-native DeFi position:

Wallet-native term liquidity for delayed exits.

## What the taker does

A taker holds a delayed-redemption asset and wants liquid tokens now.

Examples:

- Sell an LRT during stress for USDC now.
- Sell a mock withdrawal receipt redeemable for 1 WETH after maturity.
- Sell a PT token before maturity.
- Sell a vault withdrawal share before the next withdrawal epoch.

The taker flow:

1. Taker selects asset and amount to exit.
2. Solver/router finds maker strategies that can buy the asset.
3. SwapVM prices the fill using the maker's term curve.
4. Aqua atomically pulls liquid assets from maker wallets.
5. Taker transfers the delayed asset to makers.
6. Taker receives USDC/WETH immediately.

There is a real swap:

Taker gives delayed asset.
Maker gives liquid asset.

## What the maker/LP does

A maker wants to earn yield by buying delayed-redemption assets at a fair discount without locking capital into pools.

The maker configures a strategy:

- Asset class: LRT, LST receipt, PT, vault share, or mock exit receipt.
- Payment token: USDC or WETH.
- Max exposure.
- Base spread.
- Duration discount rate.
- Depeg haircut.
- Oracle staleness limit.
- Max accepted maturity.
- Optional inventory penalty.
- Optional DAO/protocol fee.

The maker approves Aqua and ships the strategy.

Important: maker funds remain in the maker wallet until a fill actually happens. Aqua tracks the strategy virtually and settles only at execution time.

## Why Aqua is essential

Without Aqua:

- Makers must deposit USDC/WETH into a pool.
- Capital is locked even when no one exits.
- Every asset and maturity needs separate liquidity.
- LPs cannot reuse the same wallet capital across strategies.
- Liquidity fragments across PT maturities, LRT assets, and receipt markets.

With Aqua:

- Makers keep funds in their own wallets.
- One wallet balance can support many strategies.
- Funds are pulled only when a trade executes.
- The same maker can quote multiple assets and maturities.
- The strategy can check executable liquidity at fill time.
- Takers still get real onchain settlement.

Aqua gives us the shared-liquidity layer.

## Why SwapVM is essential

This cannot be modeled as a simple existing AMM curve.

The price depends on:

- Time to redemption.
- Oracle backing value.
- Current market/depeg conditions.
- Maker exposure.
- Asset risk haircut.
- Maturity curve.
- Trade direction.
- Solvency at execution.

SwapVM is where this logic belongs. The custom instruction computes the price during execution and writes the swap amounts into the VM context before settlement.

SwapVM gives us the programmable pricing and validation layer.

## Not a limit-order project

This is not primarily a limit order.

A normal limit order is:

"Sell amount X at price Y."

AquaExit Term Curve is:

"Provide reusable exit liquidity where price changes with maturity, oracle backing, risk, and inventory."

So the main router should be a modified Aqua AMM-style router:

- Use `AquaSwapVMRouter`.
- Add Aqua-compatible custom instructions.
- Do not deploy full `SwapVMRouter`.
- Do not depend on `LimitSwapVMRouter` unless we later build a separate limit-order variant.

## Discord feedback we must respect

The 1inch team emphasized that projects should clearly explain the DeFi problem and avoid designs where one side can rug future obligations.

This affects our architecture.

Bad design:

- Taker buys a future promise.
- Maker/writer keeps funds in wallet.
- Later the maker can revoke allowance or move funds.
- Future settlement can fail.

That becomes trust-based or CeFi-like.

Our design:

- Taker sells the delayed asset now.
- Maker pays liquid tokens now.
- Maker receives the claim/receipt/token now.
- The future risk is held by the maker as an asset, not as an unpaid liability.

Every trade settles atomically. No one relies on a maker keeping future allowance after the trade.

## Core financial model

The delayed asset is priced as a claim on future backing value.

Simple MVP formula:

```text
backingValue = amountIn * oracleBackingPrice

durationDiscount = annualizedDurationRate * secondsToMaturity / 365 days
exposurePenalty = inventorySlope * exposureAfterFill / maxExposure
liquidityPenalty = liquiditySlope * quotedOutput / availableMakerLiquidity
totalDiscount = baseSpread + durationDiscount + riskTierHaircut + exposurePenalty + liquidityPenalty

amountOut = backingValue * (1 - totalDiscount)
```

Example:

- Taker sells a claim redeemable for 1 WETH in 30 days.
- WETH oracle price is 3000 USDC.
- Base spread is 1%.
- Duration rate is 12% APR.
- 30-day duration discount is about 1%.
- Exposure penalty is based on how much receipt exposure the maker already owns.
- Liquidity penalty grows when the fill consumes more of the maker's available quote liquidity.
- Total discount is bounded by the maker's max discount.
- Taker receives the oracle backing value minus all approved risk discounts.
- Maker receives the claim and expects redemption value around 3000 USDC.

The maker earns the discount for taking duration, liquidity, and redemption risk.

## Advanced curve extensions

The MVP can start with a simple linear discount. The bigger project can add richer curves.

Possible curve variants:

- Linear term discount: **implemented (family 0, default).**
- Piecewise/convex term curve: **implemented (family 1, convex)** — quadratic convexity premium for long-dated receipts, tuned with `convexityBps`.
- Oracle depeg haircut: implemented (cross-provider deviation bound + haircut).
- Queue-depth haircut.
- Maker inventory/exposure skew: implemented.
- Maker max notional and allowed asset-pair limits.
- Maker maturity window limits.
- Maker risk-tier haircut.
- Volatility-adjusted spread.
- Minimum and maximum price guardrails.
- DAO fee extracted from discount spread.

The important point: the curve is not an existing SwapVM curve from the incubator's exclusion list.

It is not:

- Constant product.
- Concentrated liquidity.
- Stableswap.
- Pegged square-root curve.
- Time-decaying virtual reserve MEV protection.
- Existing flat/dynamic fee instruction.

It is a term-liquidity curve for delayed-redemption assets.

## Custom SwapVM instructions

ZubiDubi now uses a reusable AquaExit instruction library instead of relying on one large SwapVM instruction.

### Reusable instruction library

The instruction set is split into three composable opcodes:

- `_aquaExitBackingOracleCheck`
- `_aquaExitExposureCap`
- `_aquaExitDiscountCurve1D`

Responsibilities across the library:

- Parse the maker's term curve parameters.
- Read oracle backing value.
- Check oracle staleness.
- Compute time to redemption.
- Compute time discount.
- Apply maker inventory/exposure penalty.
- Enforce max maker receipt exposure.
- Set `ctx.swap.amountOut` for exact-in exits.
- Set `ctx.swap.amountIn` for exact-out exits if needed.
- Revert if discount or maturity violates maker limits.

One Aqua opcode slot is reserved for index stability. Current contracts, tests, Sepolia scripts, SDK helpers, Graph-indexed strategies, and solver paths all use the modular instruction sequence.

### Instruction roles

- `BACKING_ORACLE_CHECK`: validates token pair, maturity window, oracle freshness, and positive normalized backing value.
- `EXPOSURE_CAP`: enforces maker receipt exposure and quote-token notional limits before a fill can execute.
- `EXIT_DISCOUNT_CURVE`: computes exact-in or exact-out pricing from backing value, time to maturity, max discount, inventory exposure, liquidity depth, and risk tier.

The DAO/protocol revenue fee stays in `ZubiDubiRouteExecutor`, because fees are route-level accounting rather than per-curve math. This keeps the opcodes reusable for any app that wants term liquidity without forcing one fee policy.

## Contract components

### Modified SwapVM

Files likely involved:

- `swap-vm/src/instructions/AquaExitTerm.sol`
- `swap-vm/src/opcodes/AquaOpcodes.sol`
- `swap-vm/src/routers/AquaSwapVMRouter.sol`
- `swap-vm/test/AquaExitTerm.t.sol`

We append the new instructions at the end of the Aqua opcode table to preserve existing opcode positions where possible. Because the modular library adds bytecode, the ZubiDubi deployable Aqua router prunes the unused external-delegation `Extruction` Aqua opcode slot. `Extruction` remains available in the repository and regular/limit opcode sets; it is simply not part of this custom Aqua router because ZubiDubi uses native audited-local instruction code for the exit curve.

### Underlying-backed delayed receipt asset

For Sepolia and local tests, ZubiDubi uses a real receipt contract rather than a bare mock token.

Contract:

- `ZubiDubiExitReceipt`

It represents a transferable delayed-redemption claim. The receipt stores:

- The underlying asset, such as WETH.
- The maturity timestamp.
- The amount of underlying assets redeemable per receipt.

Before maturity, sellers can exit through ZubiDubi by selling the receipt into Aqua maker liquidity. After maturity, receipt holders can redeem the receipt for the underlying. This makes `zbETH` a concrete delayed claim, not a hardcoded token with no economic anchor.

### Oracle mock

Use a mock oracle in tests first.

Later, on a fork, use a real Chainlink/Pyth-style oracle if available for the selected asset pair.

### Optional lens/quoter

For UI and solver:

- Quote available maker strategies.
- Show effective discount.
- Show split route across makers.
- Show maker exposure.

## SDK changes

Because we add a new SwapVM opcode, the TypeScript SDK needs matching encoding support.

Likely files:

- `sdks/typescript/swap-vm/src/swap-vm/instructions/aqua-exit-term/`
- `sdks/typescript/swap-vm/src/swap-vm/instructions/index.ts`
- `sdks/typescript/swap-vm/src/swap-vm/programs/aqua-program-builder.ts`

SDK should expose:

- Args class for term curve config.
- Args coder.
- Opcode constant.
- Builder method like `aquaExitTermLibrary(args)` to emit the backing/oracle check, exposure cap, and discount curve sequence.
- Tests proving encoding/decoding.

## Routing across multiple Aqua positions

This is important because the Discord feedback specifically asked about efficient routing and fair earning distribution.

The router/solver should support splitting one taker exit across multiple makers.

Example:

- Taker wants to sell 100 delayed ETH claims.
- Maker A has best discount but only 20 ETH capacity.
- Maker B has slightly worse discount and 50 ETH capacity.
- Maker C fills the remaining 30 ETH.

The solver route:

1. Reads active AquaExit strategies.
2. Quotes each strategy.
3. Checks maker virtual balance, wallet balance, and allowance.
4. Uses binary search to find the largest valid partial fill when a full quote exceeds maker exposure or deliverable balance.
5. Sorts by best output after discount.
6. Splits fill across makers.
7. Executes atomically or reverts the whole route.

Fair distribution:

- Each maker pays only their filled amount.
- Each maker receives claim tokens proportional to their fill.
- Each maker earns their own discount.
- DAO fee can be taken per fill from the spread.

## Revenue model

The DAO incubator wants revenue-sharing strategies.

AquaExit can create revenue from every fill.

Possible fee design:

- Taker pays no explicit extra fee.
- Maker discount includes spread.
- Protocol/DAO takes a small fee from the liquid token output or from maker spread.

Example:

- Gross discount: 2.5%.
- DAO fee: 10 bps of notional or 5% of maker spread.
- Maker still earns most of the discount.
- DAO earns from the first fill.

The current implementation charges an output fee in `ZubiDubiRouteExecutor`, so routes quote and enforce `minAmountOut` on the net seller amount while the protocol fee is transferred to a configured fee recipient.

## Bounty alignment

### ETHGlobal Aqua bounty

Requirement: create a custom Aqua app.

Fit: AquaExit is a custom Aqua strategy for delayed-redemption liquidity.

Requirement: sophisticated DeFi position.

Fit: maker positions are term-discount curves with oracle/risk/exposure pricing.

Requirement: use SwapVM, optional custom opcodes.

Fit: new custom SwapVM instruction prices the delayed asset at execution.

Requirement: onchain token transfers.

Fit: taker transfers delayed asset, maker transfers USDC/WETH through Aqua.

Requirement: official Aqua/SwapVM contracts.

Fit: start from official local Aqua and production `release/1.0.2` SwapVM, then redeploy modified `AquaSwapVMRouter`.

### 1inch DAO Aqua Revenue Stream Incubator

In-scope categories this hits:

- Novel Aqua strategies.
- New SwapVM instructions.
- Inventory/oracle-based pricing and market-making innovations.
- Strategies for underserved LST/LRT/yield-bearing asset classes.
- Revenue-generating onchain liquidity strategy.
- New functionality for the 1inch ecosystem through a reusable term-discount instruction.

Out-of-scope checks:

- Not a core-team constant product AMM.
- Not concentrated liquidity.
- Not stableswap.
- Not the existing pegged curve.
- Not only a flat/dynamic fee.
- Not unrelated to trading/liquidity.

Novelty framing:

AquaExit is not "another LRT swapper." It is a reusable term-liquidity primitive for delayed-redemption assets.

Incubator framing:

The incubator explicitly calls out LST/LRT and yield-bearing assets as underserved asset classes. ZubiDubi is built exactly for that category: it gives those assets a programmable exit-liquidity layer, prices them through oracle and term-structure logic, and creates a direct revenue path through per-fill DAO fees.

## Comparison to past winners

### ArcBook

ArcBook created executable curves for order books.

AquaExit creates executable term-discount curves for delayed exits.

### RiverSwap

RiverSwap used SwapVM to create a new LP fee/AMM market structure.

AquaExit uses SwapVM to create a new exit-liquidity underwriting structure.

### Lotus

Lotus created one-way directional liquidity for big holders.

AquaExit creates one-way exit liquidity for delayed-redemption assets.

### TenorFi

TenorFi transformed volatile funding-rate exposure into an Aqua-native derivative.

AquaExit transforms withdrawal-duration and redemption-risk exposure into an Aqua-native trading primitive.

## Why this is better than a generic Aqua strategy manager

A tool like "Aqua Mux" may help users allocate liquidity across strategies, but unless it ships a novel strategy, it is mostly infrastructure.

AquaExit is the actual strategy:

- It has a concrete DeFi market problem.
- It has a new LP position.
- It has a custom curve.
- It needs SwapVM changes.
- It has a direct taker swap.
- It supports revenue sharing.
- It targets LST/LRT/yield-bearing assets, explicitly named in the incubator.

## MVP scope

Build the smallest version that proves the primitive.

### Contracts

- Add `AquaExitTerm.sol` instruction.
- Append opcode to `AquaOpcodes.sol`.
- Deploy modified `AquaSwapVMRouter`.
- Add `MockExitReceipt`.
- Add mock oracle.
- Add Foundry tests.

### SDK

- Add TypeScript args coder and opcode.
- Add builder support.
- Add encoding tests.

### Demo

- Maker has USDC in wallet.
- Maker approves Aqua.
- Maker ships AquaExit strategy.
- Taker has delayed-exit token.
- Taker sells delayed-exit token.
- SwapVM computes term discount.
- Aqua pulls USDC from maker.
- Taker receives USDC.
- Maker receives delayed-exit token.

### UI

MVP UI can include:

- Maker create strategy screen.
- Taker exit screen.
- Quote view with discount breakdown.
- Route split across makers.
- Transaction status.
- Maker earnings/exposure panel.

## Implementation status

Completed so far:

- **Convexity fixed + redeployed + proven live** (2026-09-10): the convex premium is now a true quadratic `convexityBps * (time/YEAR)^2` (full-precision `Math.mulDiv`, no truncation for short-dated/small-`convexityBps` strategies; regression test `test_AquaExitTerm_ConvexCurve_ShortDatedSmallConvexityStillQuotesPremium`). Hardened stack deployed at block `11676033`: router `0x3d39B155...` (24,337 B), executor `0x95d74BF2...`, receipt `0xb7877571...`. Live quote tape on the hardened stack shows convex gross `7.159886 USDC`, linear gross `7.111608 USDC`, and steep linear gross `6.966040 USDC`; the selected convex order executed in `0x77518aa1...db46da7` for `7.152727 USDC` net after the 10 bps DAO fee.
- **Graph-backed solver gained submit-execute mode**: `ZUBIDUBI_EXECUTE=1 npm run zubidubi:graph-quote` discovers strategies from the live subgraph, quotes them, mints fresh backed receipts (WETH deposit -> `issue()`), and atomically executes `routeExactIn` — proven live on the hardened stack at block 11676051.
- **Subgraph redeployed as `v0.8.0`** against the hardened stack (all datasources start at block `11676033`), synced to head: 3 active strategies, 1 routed fill indexed, solver re-quotes the next 0.003 zbETH exit at 7.104497 USDC net after inventory/exposure repricing.
- **Five Sepolia PT-style maturing assets deployed** (2026-09-10): `PT-zbETH-30D`, `PT-zbETH-60D`, `PT-zbETH-90D`, `PT-zbETH-180D`, and `PT-zbETH-360D`, each backed 1:1 by real Sepolia WETH with maturity-gated redemption. This turns the public testnet demo into a multi-maturity term book instead of one receipt market.
- **Pyth dual-oracle deployment path added**: deployed Sepolia Pyth ETH/USD adapter `0x6d735402E116BcfC5044B6645e090667e68E2eB8`, added `scripts/update-pyth-sepolia.mjs`, and wired `RunZubiDubiSepoliaRoutedDemo` to optionally use a secondary oracle with deviation/haircut settings. Live dual-oracle fills require a `PYTH_HERMES_API_KEY` update before execution because Pyth is pull-based.
- **Pendle benchmark path added**: `npm run zubidubi:pendle-benchmark` now compares the ZubiDubi routed quote for real `PT-USD3-17DEC2026` against Pendle RouterStatic's own `getPtToAssetRate(market)` value on mainnet fork.
- **Five public Sepolia Aqua strategies shipped** through `RunZubiDubiSepoliaMultiAssetBook`: one USDC exit strategy for each PT-zbETH maturity bucket, with different curve/risk parameters so the indexed market looks like a term-liquidity book, not one hardcoded token.
- **Subgraph `v0.8.2` deployed and verified for the five-asset book** after `v0.8.1` exposed a hosted indexing error at the first new strategy block. The mapping now treats known Sepolia receipt metadata as deterministic config instead of making historical token-metadata calls for the demo asset universe. Live query health: `_meta.hasIndexingErrors = false`, 8 active strategies, 6 markets, and the five new maturity buckets indexed with 25 USDC virtual quote liquidity each.
- **Graph-backed solver verified against a new maturity bucket**: `ZUBIDUBI_TOKEN_IN=0x78890Cd804F902E2BBd84A6984130423879BE45b ZUBIDUBI_AMOUNT_IN=0.003 npm run zubidubi:graph-quote` discovers the `PT-zbETH-30D` strategy from Subgraph Studio `v0.8.2` and re-quotes it through Sepolia `ZubiDubiRouteExecutor` at `7.224472 USDC` net.
- **Solver/product API added**: `npm run zubidubi:solver-api` exposes `GET /health`, `GET /pitch`, `GET /markets`, and `GET|POST /quote`. The API uses The Graph for market discovery and Sepolia `ZubiDubiRouteExecutor.quoteExactIn` for fresh executable route previews, so the future frontend can use the same path as the CLI solver.
- **Narrative sharpened**: the README now leads with the exact product thesis — ZubiDubi is a self-custodial term-liquidity network for Pendle-like maturing DeFi assets, where makers quote programmable risk curves through Aqua and sellers get instant USDC without locked pools.
- Foundry invariant suites added: `test/invariants/AquaExitCurveInvariants.t.sol` (discount >= 0 and < par, amountOut monotonic in time, convex >= linear discount over a warped-time tape) and `test/invariants/ZubiDubiRouteInvariants.t.sol` (maker payouts capped at min(wallet, allowance), route atomicity, fee/recipient value conservation, same-maker multi-strategy dedup).
- Official Aqua and SwapVM sources are vendored locally, with SwapVM based on the production `release/1.0.2` line and the SDK aligned to the official `swap-vm/v0.4.1` release.
- Custom `AquaExitTerm` SwapVM instruction is implemented for maturity, oracle, exposure, liquidity, risk-tier, max-discount, max-notional, allowed-asset, and staleness checks.
- Sepolia contracts are deployed for Aqua, modular-instruction `AquaSwapVMRouter`, `ZubiDubiExitReceipt`, and `ZubiDubiRouteExecutor`.
- Routed Sepolia demo executed real token transfers with live Chainlink ETH/USD and Sepolia USDC.
- `ZubiDubiRouteExecutor` supports multi-maker quote discovery, deliverable balance checks, partial fills, best-price sorting, max-fill limits, atomic execution, maker skip events, and protocol/DAO fee events.
- The Graph subgraph is deployed on Subgraph Studio and indexes Aqua strategies, SwapVM fills, ZubiDubi routes, maker skips, receipt lifecycle, maker exposure, and DAO/protocol fees.
- Graph-backed solver app script added at `scripts/zubidubi-graph-solver.mjs`; it queries live indexed strategies, decodes executable SwapVM orders, and uses Sepolia RPC for final `quoteExactIn` freshness checks.
- Graph-backed solver quote validated against live Sepolia: it found 3 indexed strategies and quoted a 0.003 zbETH exit through `ZubiDubiRouteExecutor` using Graph-discovered order data.
- Upgraded Graph layer to `v0.5.2` with a solver-grade market book, per-route maker fills, execution price history, strategy snapshots, market-level volume, market-level exposure, and market-level DAO fee accrual.
- Deployed the upgraded Subgraph Studio version at `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.5.2` and validated live queries against real Sepolia events.
- Added reusable Aqua Liquidity Substreams package at `substreams/aqua-liquidity`; it extracts standardized Aqua `SHIPPED`, `PUSHED`, `PULLED`, and `DOCKED` events from EVM blocks, compiles with `cargo check`, and builds successfully to `wasm32-unknown-unknown`.
- Built AquaExit as a reusable SwapVM instruction library: backing/oracle validation, exposure-cap validation, and term-discount curve pricing. Sepolia demo scripts and the local TypeScript SDK build the modular sequence.
- Kept the deployable ZubiDubi `AquaSwapVMRouter` under EIP-170 by pruning the unused Aqua `Extruction` opcode slot while leaving `Extruction` available elsewhere in the repo. The current convexity-fixed production router runtime is 24,337 bytes, with 239 bytes of margin.
- Redeployed the modular-only instruction-library stack on Sepolia: Aqua, `AquaSwapVMRouter`, `ZubiDubiExitReceipt`, and `ZubiDubiRouteExecutor`.
- Removed the old single AquaExit opcode from the production opcode table, SDK builder, SDK opcode list, tests, and strategy scripts. Slot `0x23` is reserved for index stability; all current contracts, tests, Sepolia scripts, SDK helpers, Graph-indexed strategies, and solver paths use the modular opcode sequence.
- Executed a fresh modular routed Sepolia fill and redeployed the Subgraph Studio endpoint as `v0.5.2`; the root Graph-backed solver now queries the new subgraph, discovers 3 live strategies, and re-quotes through the new route executor.
- Redeployed the subgraph as **`v0.8.0`** (start block `11676033`, synced to head) after the receipt hardening patch: it indexes the hardened stack's 3 shipped strategies (convex-5000 + linear supports), 1 routed fill (block 11676051), DAO fee accrual, receipt issuance, and re-exposes executable order bytes; `npm run zubidubi:graph-quote` discovers all 3 and re-quotes the next 0.003 zbETH exit at **7.104497 USDC net** after inventory/exposure repricing. Older Studio versions v0.6.0/v0.6.1 (indexing_error, pre-fix era) are inert; only v0.8.0 serves traffic. Deleting a Studio version label is a dashboard action (Studio -> Deployments -> kebab -> Delete); the CLI has no per-version removal.
- Added a real-asset Pendle PT mainnet-fork proof. `ZubiDubiPendleMainnetForkTest` uses real `PT-USD3-17DEC2026` as `tokenIn`, real mainnet USDC as `tokenOut`, the PT's real Pendle maturity, and real Chainlink USDC/USD for par-value pricing. This turns the receipt story into a concrete maturing-asset market instead of only a backed Sepolia PT-style receipt.
- Upgraded the Sepolia `zbETH` demo token into a PT-style backed receipt issuance path: demos now wrap real Sepolia ETH into WETH, deposit WETH into `ZubiDubiExitReceipt.issue()`, mint `zbETH`, and then sell that backed maturing token through Aqua before maturity.

Next build targets:

- ~~Add optional execution mode to the Graph-backed solver so it can submit the routed exit after quoting.~~ **Done** — `ZUBIDUBI_EXECUTE=1 npm run zubidubi:graph-quote` mints backed receipts and atomically executes the Graph-discovered route through `ZubiDubiRouteExecutor` (current hardened-stack proof tx `0x77518aa105405c1986fd2499f414285ac6ba62f2f7fc10542953f74dbdb46da7`, block 11676051).
- Add a frontend that uses the same Graph solver data for market discovery, route preview, risk panels, fee analytics, and live fill history.
- Install the Substreams CLI and run the Aqua Liquidity Substreams module against a live The Graph Market or Pinax endpoint for the strongest possible Graph bounty demo.
- Add a Pendle market benchmark panel to compare ZubiDubi maker quotes against Pendle's live implied PT pricing on the same asset.

## Graph layer: winner-level positioning

Past strong projects did not use indexing as a side dashboard. They used indexing as the market reconstruction layer.

ZubiDubi now follows that pattern:

- `Market` reconstructs the live zbETH/USDC exit-liquidity book across many Aqua strategies.
- `ZubiDubiStrategy` stores executable SwapVM order bytes so the app/solver can reconstruct routes from indexed data.
- `RouteFill` creates a fill tape with maker attribution, execution price, and transaction hash.
- `StrategySnapshot` creates a position timeline across ship, push, pull, swap, and dock events.
- `MakerExposure` lets the solver and UI show concentration risk and inventory pressure.
- `RouteFee` and market fee rollups prove DAO revenue from real fills.
- `substreams/aqua-liquidity` provides a reusable Substreams extractor for the same Aqua lifecycle events, giving the project a credible Substreams + Subgraph composition path.

What this fixes:

- The solver no longer needs to scan raw Aqua logs to discover strategies.
- The frontend can show a live market, route tape, maker exposure, and DAO revenue from one query surface.
- The demo can explain standards leverage clearly: shared entities for protocol/account/token/swap/revenue, with ZubiDubi-specific market and strategy extensions.

What still separates us from the most complete winners:

- No polished frontend yet.
- Public solver API exists locally (`npm run zubidubi:solver-api`) and is ready for the frontend/API deployment step; MCP remains optional polish.
- The Sepolia proof uses one maker wallet publishing multiple strategies; tests prove multi-maker routing, but the public demo should show at least 2-3 distinct maker EOAs.
- The Graph layer has a deployed Subgraph Studio endpoint and a reusable Substreams package, but the Substreams package still needs a live The Graph Market/Pinax run for maximum Graph-bounty strength.
- Dual-oracle and Pyth adapter support exists in contracts/tests and the Sepolia adapter is deployed; executing a public dual-oracle route requires refreshing the Pyth ETH/USD feed through Hermes before calling the route.
- Pendle PT real-asset proof and benchmark script exist on mainnet fork. Latest benchmark result: Pendle implied PT-to-asset rate `0.965423030282453957`, ZubiDubi routed PT-to-USDC rate `0.965617295454545454`, delta `1 bps`.

Current winner-track assessment without frontend:

- Stronger than a basic Aqua app because ZubiDubi now has a real DeFi problem, custom modular SwapVM instructions, onchain Sepolia transfers, DAO revenue, live Graph indexing, a Graph-backed solver, Substreams groundwork, invariant tests, and a real Pendle PT fork proof.
- Competitive with Ballast-style technical depth because both use real/forked assets, oracle-aware pricing, and custom SwapVM logic; ZubiDubi adds multi-strategy routing, revenue accounting, and receipt lifecycle hardening.
- Still behind ArcBook/Lotus/RiverSwap as a complete submission surface until the frontend/API layer and distinct public maker demo are added.
- The highest-leverage next contract/script upgrade is not another curve: it is a public multi-maker deployment script that funds 2-3 maker EOAs, ships different risk curves, executes one route across them, and leaves every event indexed by The Graph.

These are product-surface gaps, not core protocol gaps. The protocol, live deployment, and Graph-backed market reconstruction are now in place.

## Test plan

### Unit tests

- Discount calculation.
- Maturity handling.
- Oracle staleness rejection.
- Max maturity rejection.
- Max discount rejection.
- Exposure penalty.
- Exact-in quote.
- Exact-out quote if supported.

### Integration tests

- Maker ships strategy through Aqua.
- Taker fills against one maker.
- Taker fills across multiple makers.
- Maker insufficient wallet balance causes fill reduction/skip in solver.
- Maker insufficient allowance causes fill reduction/skip in solver.
- DAO fee is accounted correctly.
- Quote and swap match.

### Fork/demo tests

- Use real or realistic WETH/USDC style assets.
- Simulate depeg or long withdrawal delay.
- Compare naive flat-price exit vs AquaExit term-price exit.
- Show onchain transfer events.

## Key risks

### Risk: sounds like just an LRT swap

Mitigation:

Frame it as a term-liquidity primitive, not a token swapper.

### Risk: future settlement trust issue

Mitigation:

No future maker liability. Maker pays now and receives claim now.

### Risk: oracle complexity

Mitigation:

Start with mock oracle and clean interface. Add real fork oracle later.

### Risk: overbuilding

Mitigation:

First custom instruction can combine pricing checks. Split into multiple reusable opcodes after tests pass.

### Risk: free tradability undercuts the "early exit" framing

Mitigation:

Explicit decision (Option B / general case) recorded in the README: `zbETH` is deliberately a freely tradable, delayed-redemption receipt, the same category as a real Pendle PT. Real PTs trade freely at discounted fair value before maturity, so transfer gating is not the product. ZubiDubi's value is pricing the fair early-exit discount (time-to-maturity, oracle backing, exposure, liquidity depth, risk tier) and providing instant, atomically-settled exit liquidity from wallet-held maker funds. Liquidity ≠ redemption

This is consistent with the Pendle mainnet-fork proof, where the real PT is freely tradable by design. Restricting only the demo token would contradict that flagship proof and require whitelisting every Aqua/router/seller transfer path.

### Risk: router bytecode size

Mitigation:

Use `AquaSwapVMRouter`, not full `SwapVMRouter`.

## Suggested implementation phases

### Phase 1: spec and minimal instruction

- Define args packing.
- Implement `AquaExitTerm.sol`.
- Add opcode to Aqua opcode set.
- Write pure math tests.

### Phase 2: Aqua settlement test

- Create mock receipt token.
- Ship strategy.
- Execute swap through modified router.
- Assert balances and events.

### Phase 3: routed exit market

- Add onchain route executor.
- Accept candidate Aqua strategies from the solver/indexer layer.
- Check deliverable liquidity per maker as `min(Aqua virtual balance, wallet balance, allowance)`.
- Quote executable fills through the modified SwapVM router.
- Greedily split one taker exit across the best executable curves.
- Revert atomically if aggregate fill or minimum output cannot be met.

### Phase 4: SDK support

- Add TypeScript instruction encoder.
- Add builder method.
- Add cross-validation tests.

### Phase 5: demo polish

- Build UI or script demo.
- Add explanation diagrams.
- Add README.
- Add deployment script for Sepolia/Arc-compatible chain if needed.

## Current build status

### Completed

- Phase 1: custom `AquaExitTerm` SwapVM instruction added to the local `AquaSwapVMRouter` opcode table.
- Phase 2: Aqua settlement tests prove a taker can sell delayed-exit receipt tokens and receive maker wallet-held quote tokens.
- Phase 3: `ZubiDubiRouteExecutor` added. It quotes, filters, sorts, and atomically executes routed exits across multiple Aqua strategies.
- Phase 4: TypeScript SDK support added for encoding and building the modular `aquaExitTermLibrary()` instruction sequence.
- Phase 5: executable Foundry demo added in `swap-vm/test/ZubiDubiDemo.t.sol`.
- Phase 6: receipt token upgraded into an underlying-backed delayed-redemption receipt with maturity-gated redemption.
- Phase 7: term curve upgraded with hard max exposure and maker inventory pricing.
- Phase 8: route executor upgraded with protocol fee revenue and partial-fill recovery through binary search.
- Phase 9: maker risk policy added to the custom opcode: max notional, allowed asset pair, maturity range, stale oracle protection, liquidity-depth penalty, and risk-tier haircut.
- Phase 10: route tests added for revoked approvals, moved maker wallet balances, same-maker double counting, max fills, protocol fees, multi-maker splits, multi-asset markets, and Sepolia real Chainlink/USDC execution.
- Phase 11: `AquaExitTerm` split into reusable SwapVM instructions for backing/oracle checks, exposure caps, and discount-curve pricing. The SDK exposes `aquaExitTermLibrary()`, and Sepolia scripts now publish modular programs.
- Sepolia: deployed Aqua, modular-instruction AquaSwapVMRouter, zbETH receipt token, and route executor with real Sepolia USDC and Chainlink ETH/USD configuration.
- The Graph: local subgraph added for live Sepolia indexing of Aqua strategies, SwapVM fills, ZubiDubi routes, maker skips, maker exposure, receipt maturity, and protocol/DAO fee accrual.

Note: the local opcode args are now 171 bytes because maker risk policy and the term-structure curve family (linear/convex) are encoded directly in the curve. Legacy 166-byte strategies parse as linear with zero behavior change. The current Sepolia deployment below uses this upgraded format.

Current size check: the production `AquaSwapVMRouter` with the convexity-fixed curve-family library compiles under the EIP-170 runtime limit at 24,337 bytes, with 239 bytes of margin (24,576 limit). The debug router is oversized, but it is not the router intended for deployment.

Current Sepolia deployment (hardened fixed-convexity curve-family stack, 2026-09-10, block 11676033):

- Aqua: `0x30aefbDE9EC52A23E597e338F02f35Da909D7183`.
- AquaSwapVMRouter: `0x3d39B155De93CB9C340577E06b801C4956ed2a57`.
- ZubiDubiRouteExecutor: `0x95d74BF2a83bc3ba50dc5c377cE8fB1478Ae5708`.
- ZubiDubiExitReceipt: `0xb7877571932A025E03a7B9616F254B361FD1759F`.
- Deploy AquaSwapVMRouter tx: `0x240535fd3b5c42087a84aedc0a515ee99f3b02a4b8d211d0809236880dbdd4ba`.
- Deploy ZubiDubiExitReceipt tx: `0x9453d2362987b4bb39bbdc510f5489079244acbe61d7e68865ee6e8c2874adb5`.
- Deploy ZubiDubiRouteExecutor tx: `0x32be16feff1d92c133346bf109836a5fc2364a90805e4ef9a12d5541e48b1e71`.
- Routed fill on the hardened stack:
  - **convex (50/600, convexity=5000) `0x77518aa105405c1986fd2499f414285ac6ba62f2f7fc10542953f74dbdb46da7` — 0.003 zbETH sold for 7.152727 USDC net**
- Live quote tape before settlement: convex gross `7,159,886` USDC units vs linear `7,111,608` vs steep linear `6,966,040`; the solver selected the best executable route and paid a 10 bps DAO fee (`7,159` USDC base units).
- Live Graph-backed re-quote after settlement: next 0.003 zbETH exit quotes at `7.104497 USDC` net after inventory/exposure repricing.

Current mainnet-fork real asset:

- Pendle market: `USD3 17DEC2026`.
- Pendle market address: `0x4A5067C3fF1abb7449244025B0e37fEAF77D8E3e`.
- Pendle PT token: `PT-USD3-17DEC2026` at `0x7f47c3e6b2c00fC4eB4d5Ae50d0Ab0Ab6888Eb4D`.
- PT maturity: `1797465600` (`2026-12-17T00:00:00Z`).
- Mainnet USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`.
- Mainnet Chainlink USDC/USD: `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6`.
- Fork proof result: sold `220 PT-USD3-17DEC2026` for `212.261280 USDC` net after DAO fee.

### Demo Proof

`ZubiDubiDemo.t.sol` demonstrates the full ZubiDubi story:

- A taker wants to immediately exit `3 mxETH`, a delayed-redemption receipt.
- Four makers publish Aqua strategies with wallet-held liquidity.
- One maker has virtual Aqua liquidity but no real wallet USDC.
- The demo route checks deliverable liquidity as `min(Aqua balance, wallet balance, allowance)` and skips that maker.
- The remaining solvent makers fill the exit across their different term-discount curves.
- Aqua settles real token transfers: taker receives `8,821.65 mUSDC`, makers receive the delayed-exit receipt tokens, and Aqua virtual balances update.

`ZubiDubiRouteExecutor.t.sol` demonstrates the routed market layer:

- Candidate strategies can arrive unsorted from an offchain solver or The Graph indexer.
- The executor checks each maker's executable liquidity before selecting fills.
- Makers with only virtual Aqua balance but no wallet deliverability are skipped.
- Makers with revoked Aqua allowance are skipped.
- Makers whose wallet balance moved after publishing are skipped.
- The route fills best-price strategies first and splits the exit across multiple positions.
- The route charges protocol revenue from output token proceeds.
- The route cannot overcount the same maker wallet liquidity across multiple strategies.
- The route can binary-search down to a maker's largest executable partial fill.
- The route can enforce a deterministic max fills limit.
- If the candidate set cannot fill the requested amount, the whole route reverts.

Live Sepolia routed proof (hardened fixed-convexity curve-family stack, block 11676033):

- Route executor: `0x95d74BF2a83bc3ba50dc5c377cE8fB1478Ae5708`.
- Fill 1 (**convex 50/600, convexity=5000**): `0x77518aa105405c1986fd2499f414285ac6ba62f2f7fc10542953f74dbdb46da7` — sold `0.003 zbETH` for `7.152727 USDC` net. The route was selected from convex gross `7.159886 USDC`, linear gross `7.111608 USDC`, and steep linear gross `6.966040 USDC`, then settled atomically through the route executor.
- Maker wallet received the delayed-exit receipt exposure; route executor transferred the 10 bps DAO fee to the owner fee recipient at every fill.
- The sold `zbETH` was issued through `issue()` after depositing `0.003 WETH`, so every demo token is a backed maturing claim; the receipt contract tracks real WETH backing.
- The live Graph-backed solver (`npm run zubidubi:graph-quote`) discovers the 3 indexed strategies from `v0.8.0` and re-quotes the next 0.003 zbETH exit at `7.104497 USDC` net after inventory/exposure repricing; `ZUBIDUBI_EXECUTE=1` executes the route onchain.

## Final submission story

Title:

AquaExit Term Curve

Problem:

Delayed-redemption DeFi assets are liquid wrappers around illiquid exits. Liquidity fragments across assets and maturities, and LPs must lock idle capital to provide exits.

Solution:

Makers publish self-custodial term-liquidity strategies through Aqua. Takers sell delayed assets for liquid tokens immediately. SwapVM prices each fill from a maturity/risk/exposure curve and Aqua settles atomically from maker wallets.

Design decision (on purpose):

The demo receipt is a freely tradable, delayed-redemption claim — the same general case as a real Pendle PT, which can also be sold elsewhere pre-maturity. We do not gate transfers; we price the fair early-exit discount and provide instant, atomically-settled exit liquidity from wallet-held maker funds. Liquidity ≠ redemption.

Technical contribution:

Custom SwapVM instruction for term-discount pricing of delayed-redemption assets, integrated into a modified AquaSwapVMRouter and mirrored in the TypeScript SDK.

Demo proof:

A Foundry/UI demo shows a taker selling a delayed-exit token into multiple Aqua maker positions. The router computes discounts onchain, pulls USDC from maker wallets through Aqua, transfers the claim tokens to makers, and distributes earnings according to filled exposure.

## Short Discord check-in message

Hey @Stepan @Belac, we are building AquaExit Term Curve for the Aqua track.

The problem: many DeFi assets are liquid wrappers around delayed exits, like LRTs, LST withdrawal receipts, PT/yield tokens, and vault withdrawal shares. In stress, users need immediate exit liquidity, but LPs do not want to lock idle USDC/ETH into separate pools for every asset and maturity.

AquaExit lets makers publish self-custodial exit-liquidity strategies through Aqua. Their funds stay in their wallets, while takers can sell delayed-redemption assets for liquid tokens immediately. A custom SwapVM instruction prices each fill using redemption delay, oracle backing value, depeg/risk haircut, and maker exposure. Settlement is atomic: maker pays USDC/WETH now and receives the claim token now, so there is no future allowance/rug-pull dependency.

We plan to demo a modified AquaSwapVMRouter with one exit split across multiple Aqua maker positions, plus fair claim distribution and maker earnings by filled exposure. Does this feel aligned with Aqua's goal of novel LST/LRT/yield-bearing strategies?
