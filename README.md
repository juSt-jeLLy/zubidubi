# ZubiDubi

Self-custodial term liquidity for delayed-redemption DeFi assets on Aqua + SwapVM.

**Pitch:** ZubiDubi is a self-custodial term-liquidity network for Pendle-like maturing DeFi assets, where makers quote programmable risk curves through Aqua and sellers get instant USDC without locked pools.

ZubiDubi lets a seller exit a delayed asset such as an LRT withdrawal receipt, Pendle PT, vault withdrawal share, or Sepolia `zbETH` receipt into wallet-held maker liquidity. Makers publish Aqua strategies, SwapVM prices each fill with a maturity/oracle/exposure curve, The Graph reconstructs the live market book, and the ZubiDubi route executor splits the exit across deliverable makers atomically.

## Design Decision: free tradability (general case)

`zbETH` is deliberately a **freely tradable, delayed-redemption receipt** — it can be sold anywhere.

This is an explicit product decision: we model the **general case** of a maturing claim (the same category as a real Pendle PT), where the token can already be traded elsewhere. Real PTs trade freely at a discounted fair value before maturity. The value of ZubiDubi is not in gating transfers — it is in **pricing the fair early-exit discount** (time-to-maturity, oracle backing, exposure, liquidity depth, risk tier) and giving takers **instant, atomically-settled exit liquidity** from wallet-held maker funds.

So the question "if it's freely tradable, why is your curve the only exit?" has a direct answer: it is not the only exit, and it is not trying to be. It is a price-discovery + instant-liquidity primitive for assets that are tradable but not *instantly redeemable* — liquidity ≠ redemption, and that mismatch is the product.

## Term-Structure Curves

The discount engine is a real term-structure primitive, not a single formula:

- **curve family 0 (linear):** discount grows linearly with time to maturity (backward-compatible with every strategy shipped before the upgrade — legacy 166-byte args keep exact pricing).
- **curve family 1 (convex):** adds a quadratic convexity premium so long-dated receipts are discounted more steeply than a straight line, mirroring how duration risk is repriced in real yield curves. `convexityBps` sets the bend.
- **annualized risk-tier haircut:** `riskTierBps` is an *annualized* asset-class premium (LRT depeg risk, LST slashing tail risk, vault share liquidity class), not a flat add — the same tier rents more haircut the longer the remaining duration.
- Combined with oracle backing value, cross-provider deviation bounds, inventory exposure slope, liquidity-depth penalty, and max-discount guardrails, the instruction set supports one maker wallet quoting many assets and maturities on one programmable curve.

Core guarantees are defended by Foundry invariant suites (`test/invariants/`): makers can never be pulled for more than `min(wallet balance, allowance)`, routes are fully atomic (full fill or nothing moves), value is conserved across the route, the discount is never negative or above par, amountOut is monotonic in time, and the convex family always discounts at least the linear one.

## Live Sepolia Stack

- Aqua: `0x30aefbDE9EC52A23E597e338F02f35Da909D7183`
- AquaSwapVMRouter (curve-family router, EIP-170 24,337 bytes): `0x3d39B155De93CB9C340577E06b801C4956ed2a57`
- ZubiDubiRouteExecutor (10 bps DAO fee, max 8 fills): `0x95d74BF2a83bc3ba50dc5c377cE8fB1478Ae5708`
- ZubiDubiExitReceipt (original PT-zbETH, backed by WETH): `0xb7877571932A025E03a7B9616F254B361FD1759F`
- Pyth ETH/USD adapter for dual-oracle routes: `0x6d735402E116BcfC5044B6645e090667e68E2eB8`
- Subgraph Studio: `https://thegraph.com/studio/subgraph/zubidubi`
- Subgraph endpoint (v0.8.2): `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.8.2`

Public Sepolia maturing asset universe:

| Asset | Address | Maturity | Backing |
| --- | --- | --- | --- |
| PT-zbETH-30D | `0x78890Cd804F902E2BBd84A6984130423879BE45b` | 2026-10-10 16:39:36 UTC | WETH, 1:1 |
| PT-zbETH-60D | `0xD49F34d689c79e5a25d674ab684F33873a514d96` | 2026-11-09 16:39:36 UTC | WETH, 1:1 |
| PT-zbETH-90D | `0xa35CBAe88c35b4F06a9992942e889A82388D2Ac8` | 2026-12-09 16:39:36 UTC | WETH, 1:1 |
| PT-zbETH-180D | `0x680Bc9CD0005461A95c75F4A1d3cbADdc7104caB` | 2027-03-09 16:39:36 UTC | WETH, 1:1 |
| PT-zbETH-360D | `0x4f7c1919AABC995f41Ad12cfaE25EBF638E8aDE4` | 2027-09-05 16:39:36 UTC | WETH, 1:1 |

## Graph-Backed Solver

```bash
npm run zubidubi:graph-quote
```

The solver flow is:

1. Query active ZubiDubi Aqua strategies from The Graph.
2. Decode indexed SwapVM order bytes.
3. Quote against the live Sepolia route executor.
4. Return route preview, maker candidates, skipped makers, and net seller output.
5. Optional: `ZUBIDUBI_EXECUTE=1` mints fresh backed receipts and atomically executes the route (see the Submit-Execute section below).

This makes The Graph part of the core app path, not just a dashboard: Graph handles scalable market discovery, while Sepolia contracts handle final balance, allowance, quote, and settlement checks.

## Solver API

```bash
npm run zubidubi:solver-api
```

The API exposes the solver as a product surface for the frontend and demo automation:

- `GET /health` checks the service.
- `GET /pitch` returns the judge-facing product thesis.
- `GET /markets` returns the live Graph-indexed term book, recent fills, and protocol totals.
- `GET /quote?tokenIn=0x78890Cd804F902E2BBd84A6984130423879BE45b&amountIn=0.003` returns a route preview for a specific maturing asset.
- `POST /quote` accepts `{ "tokenIn": "0x...", "amountIn": "0.003" }`.

The API does not trust indexed liquidity blindly. It uses The Graph to discover executable Aqua strategies, then calls the Sepolia `ZubiDubiRouteExecutor.quoteExactIn` function for fresh balance, allowance, Aqua virtual balance, fee, and route-split checks.

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

## Convex Term Curve

Family 1 (convex) is a **true quadratic convexity premium**:

```text
premiumBps = convexityBps * (secondsToMaturity / YEAR) ^ 2
```

computed in full precision (`Math.mulDiv`), so `convexityBps` is an annualized curvature: premium ≈ `convexityBps` at one year, and scales with the square of remaining time. This makes the premium measurable (never truncating to zero) even for small convexities at short maturities — e.g. `convexityBps = 150` quotes a 1 bps premium at 30 days.

## Current Proof

Hardened curve-family stack deployed and filled live on Sepolia (`2026-09-10`). Deploy (block 11676033):

- Deploy `AquaSwapVMRouter`: `0x240535fd3b5c42087a84aedc0a515ee99f3b02a4b8d211d0809236880dbdd4ba`
- Deploy `ZubiDubiExitReceipt`: `0x9453d2362987b4bb39bbdc510f5489079244acbe61d7e68865ee6e8c2874adb5`
- Deploy `ZubiDubiRouteExecutor`: `0x32be16feff1d92c133346bf109836a5fc2364a90805e4ef9a12d5541e48b1e71`

Routed fill on the hardened stack, minted by depositing WETH before selling:

| Fill tx | Block | Strategy | zbETH in | USDC out (net) |
| --- | --- | --- | --- | --- |
| `0x77518aa1...db46da7` | 11676051 | **convex (50/600, convexity=5000)** | 0.003 | 7.152727 |

- Convex-family A/B/C from the live quote tape on the hardened stack, same amount: convex gross `7,159,886` USDC units, linear gross `7,111,608`, steep linear gross `6,966,040`. The solver selected the best executable maker strategy and settled atomically.
- The convex order **executed as the fill** in settlement tx `0x77518aa1...db46da7`.
- DAO/protocol fee (10 bps of gross) is indexed by the live subgraph: `7,159` USDC base units accrued on the hardened stack, fee recipient = owner.
- Sepolia `zbETH` receipts are backed by real WETH (`expiry()` = Pendle-PT-style maturity `1791643032`); the sold `0.003 zbETH` was issued by depositing `0.003 WETH` before the Aqua exit.
- Live Graph-backed solver now re-quotes the next `0.003 zbETH` exit at `7.104497 USDC` net after inventory/exposure repricing from the first routed fill.

## Graph-Backed Solver with Submit-Execute

Quote-only:

```bash
npm run zubidubi:graph-quote
```

Quote + atomically execute the routed exit (mints backed receipts, then `routeExactIn`):

```bash
ZUBIDUBI_EXECUTE=1 npm run zubidubi:graph-quote
```

Set `ZUBIDUBI_AMOUNT_IN` for size and `ZUBIDUBI_RECIPIENT` to route USDC proceeds elsewhere.

## Real Asset Fork Proof

ZubiDubi also has a mainnet-fork proof using a real Pendle Principal Token instead of the Sepolia demo receipt:

- Pendle market: `USD3 17DEC2026` at `0x4A5067C3fF1abb7449244025B0e37fEAF77D8E3e`
- PT tokenIn: `PT-USD3-17DEC2026` at `0x7f47c3e6b2c00fC4eB4d5Ae50d0Ab0Ab6888Eb4D`
- Maturity: `1797465600`
- Quote tokenOut: mainnet USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Oracle: Chainlink USDC/USD at `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6`

```bash
MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract ZubiDubiPendleMainnetForkTest -vv
```

The fork proof routes an early exit of `220 PT-USD3-17DEC2026` across Aqua makers and settles real ERC20 transfers on forked Ethereum mainnet. Without `MAINNET_RPC_URL`, the test skips cleanly.

Benchmark the ZubiDubi routed PT quote against Pendle RouterStatic's own implied PT-to-asset rate:

```bash
npm run zubidubi:pendle-benchmark
```

For live Sepolia dual-oracle routes, update the deployed Pyth ETH/USD price first:

```bash
npm run zubidubi:pyth:update-sepolia
```

See `plan.md` for the full product, technical, and bounty-alignment plan.
