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
- Sell a mock withdrawal receipt redeemable for 1 WETH in 14 days.
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

- Linear term discount.
- Piecewise term curve by maturity buckets.
- Convex discount for long-dated receipts.
- Oracle depeg haircut.
- Queue-depth haircut.
- Maker inventory/exposure skew.
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

For the hackathon MVP, one combined instruction is enough.

### MVP instruction

`_aquaExitTermSwap1D`

Responsibilities:

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

### Later instruction split

If we want the system to look more like a reusable instruction library, split into:

- `BACKING_ORACLE_CHECK`
- `EXIT_DISCOUNT_CURVE`
- `EXPOSURE_CAP`
- `AQUA_EXIT_SWAP`
- `DAO_REVENUE_FEE`

For the first build, one combined opcode is faster and easier to test.

## Contract components

### Modified SwapVM

Files likely involved:

- `swap-vm/src/instructions/AquaExitTerm.sol`
- `swap-vm/src/opcodes/AquaOpcodes.sol`
- `swap-vm/src/routers/AquaSwapVMRouter.sol`
- `swap-vm/test/AquaExitTerm.t.sol`

We append the new instruction at the end of the Aqua opcode table to preserve existing opcode positions.

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
- Builder method like `aquaExitTermSwap1D(args)`.
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

- Official Aqua and SwapVM sources are vendored locally, with SwapVM based on the production `release/1.0.2` line and the SDK aligned to the official `swap-vm/v0.4.1` release.
- Custom `AquaExitTerm` SwapVM instruction is implemented for maturity, oracle, exposure, liquidity, risk-tier, max-discount, max-notional, allowed-asset, and staleness checks.
- Sepolia contracts are deployed for Aqua, modified `AquaSwapVMRouter`, `ZubiDubiExitReceipt`, and `ZubiDubiRouteExecutor`.
- Routed Sepolia demo executed real token transfers with live Chainlink ETH/USD and Sepolia USDC.
- `ZubiDubiRouteExecutor` supports multi-maker quote discovery, deliverable balance checks, partial fills, best-price sorting, max-fill limits, atomic execution, maker skip events, and protocol/DAO fee events.
- The Graph subgraph is deployed on Subgraph Studio and indexes Aqua strategies, SwapVM fills, ZubiDubi routes, maker skips, receipt lifecycle, maker exposure, and DAO/protocol fees.
- Graph-backed solver app script added at `scripts/zubidubi-graph-solver.mjs`; it queries live indexed strategies, decodes executable SwapVM orders, and uses Sepolia RPC for final `quoteExactIn` freshness checks.
- Graph-backed solver quote validated against live Sepolia: it found 3 indexed strategies and quoted a 0.003 zbETH exit through `ZubiDubiRouteExecutor` using Graph-discovered order data.

Next build targets:

- Add optional execution mode to the Graph-backed solver so it can submit the routed exit after quoting.
- Add a frontend that uses the same Graph solver data for market discovery, route preview, risk panels, fee analytics, and live fill history.
- Add a reusable Aqua Substreams module for standardized shared-liquidity balance deltas if we want the strongest possible Graph bounty angle.

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
- Phase 4: TypeScript SDK support added for encoding and building the custom `aquaExitTermSwap1D` instruction.
- Phase 5: executable Foundry demo added in `swap-vm/test/ZubiDubiDemo.t.sol`.
- Phase 6: receipt token upgraded into an underlying-backed delayed-redemption receipt with maturity-gated redemption.
- Phase 7: term curve upgraded with hard max exposure and maker inventory pricing.
- Phase 8: route executor upgraded with protocol fee revenue and partial-fill recovery through binary search.
- Phase 9: maker risk policy added to the custom opcode: max notional, allowed asset pair, maturity range, stale oracle protection, liquidity-depth penalty, and risk-tier haircut.
- Phase 10: route tests added for revoked approvals, moved maker wallet balances, same-maker double counting, max fills, protocol fees, multi-maker splits, multi-asset markets, and Sepolia real Chainlink/USDC execution.
- Sepolia: deployed Aqua, modified AquaSwapVMRouter, zbETH receipt token, route executor, and live routed demo with real Sepolia USDC and Chainlink ETH/USD.
- The Graph: local subgraph added for live Sepolia indexing of Aqua strategies, SwapVM fills, ZubiDubi routes, maker skips, maker exposure, receipt maturity, and protocol/DAO fee accrual.

Note: the local opcode args are now 138 bytes because maker risk policy is encoded directly in the curve. The current Sepolia deployment below uses this upgraded format.

Current size check: the production `AquaSwapVMRouter` compiles under the EIP-170 runtime limit at 24,407 bytes, with 169 bytes of margin. The debug router is oversized, but it is not the router intended for deployment.

Current Sepolia deployment:

- Aqua: `0xd265362BC3F34FBc7f5F7a075899dA9E3E20Da8e`.
- AquaSwapVMRouter: `0xd4F7a64301416947D0f62c98B80F588ddEbCb741`.
- ZubiDubiRouteExecutor: `0x2D1d8B08A810766f702ef29A01b6219964073a8d`.
- ZubiDubiExitReceipt: `0x9c99F37e5Ad3F974eeb5a50F929EEa9fa70D3581`.
- Routed Sepolia demo final sell tx: `0xca274ac4f8904d06674eca90c681a3d1338766aa3d74a7fa64df67001d85827c`.

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

Live Sepolia routed proof:

- Route executor: `0x21dBAcFBbe7E047Efe94F846BA24FF031379B947`.
- Seller contract: `0xdFDC728088897f167e1A1378eE404e2Ae6E4A5c1`.
- Routed swap transaction: `0x811129fc13da8099509b6d06f3c3da850959ec7b6c65f8a399679a14e0045f18`.
- Seller sold `0.003 zbETH`.
- Seller received `7.251837 USDC`.
- Maker wallet received the delayed-exit receipt exposure.

## Final submission story

Title:

AquaExit Term Curve

Problem:

Delayed-redemption DeFi assets are liquid wrappers around illiquid exits. Liquidity fragments across assets and maturities, and LPs must lock idle capital to provide exits.

Solution:

Makers publish self-custodial term-liquidity strategies through Aqua. Takers sell delayed assets for liquid tokens immediately. SwapVM prices each fill from a maturity/risk/exposure curve and Aqua settles atomically from maker wallets.

Technical contribution:

Custom SwapVM instruction for term-discount pricing of delayed-redemption assets, integrated into a modified AquaSwapVMRouter and mirrored in the TypeScript SDK.

Demo proof:

A Foundry/UI demo shows a taker selling a delayed-exit token into multiple Aqua maker positions. The router computes discounts onchain, pulls USDC from maker wallets through Aqua, transfers the claim tokens to makers, and distributes earnings according to filled exposure.

## Short Discord check-in message

Hey @Stepan @Belac, we are building AquaExit Term Curve for the Aqua track.

The problem: many DeFi assets are liquid wrappers around delayed exits, like LRTs, LST withdrawal receipts, PT/yield tokens, and vault withdrawal shares. In stress, users need immediate exit liquidity, but LPs do not want to lock idle USDC/ETH into separate pools for every asset and maturity.

AquaExit lets makers publish self-custodial exit-liquidity strategies through Aqua. Their funds stay in their wallets, while takers can sell delayed-redemption assets for liquid tokens immediately. A custom SwapVM instruction prices each fill using redemption delay, oracle backing value, depeg/risk haircut, and maker exposure. Settlement is atomic: maker pays USDC/WETH now and receives the claim token now, so there is no future allowance/rug-pull dependency.

We plan to demo a modified AquaSwapVMRouter with one exit split across multiple Aqua maker positions, plus fair claim distribution and maker earnings by filled exposure. Does this feel aligned with Aqua's goal of novel LST/LRT/yield-bearing strategies?
