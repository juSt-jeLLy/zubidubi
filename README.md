# ZubiDubi

Self-custodial term liquidity for delayed-redemption DeFi assets on Aqua + SwapVM.

**Pitch:** ZubiDubi is a self-custodial term-liquidity network for Pendle-like maturing DeFi assets, where makers quote programmable risk curves through Aqua and sellers get instant USDC without locked pools.

ZubiDubi lets a seller exit a delayed asset such as an LRT withdrawal receipt, Pendle PT, vault withdrawal share, or Sepolia `zbETH` receipt into wallet-held maker liquidity. Makers publish Aqua strategies, SwapVM prices each fill with a maturity/oracle/exposure curve, The Graph reconstructs the live market book, and the ZubiDubi route executor splits the exit across deliverable makers atomically.

## Design Decision: free tradability (general case)

`zbETH` is deliberately a **freely tradable, delayed-redemption receipt** — it can be sold anywhere.

This is an explicit product decision: we model the **general case** of a maturing claim (the same category as a real Pendle PT), where the token can already be traded elsewhere. Real PTs trade freely at a discounted fair value before maturity. The value of ZubiDubi is not in gating transfers — it is in **pricing the fair early-exit discount** (time-to-maturity, oracle backing, exposure, liquidity depth, risk tier) and giving takers **instant, atomically-settled exit liquidity** from wallet-held maker funds.

So the question "if it's freely tradable, why is your curve the only exit?" has a direct answer: it is not the only exit, and it is not trying to be. It is a price-discovery + instant-liquidity primitive for assets that are tradable but not *instantly redeemable* — liquidity ≠ redemption, and that mismatch is the product.

## Demo Receipt vs Real-World Assets

The public Sepolia assets are PT-style demo receipts backed by real Sepolia WETH, USDC, and LINK. They are not meant to pretend that a user magically creates yield by minting a receipt and redeeming the same amount later. The Sepolia `issue()` path exists so judges can verify a complete onchain lifecycle with real ERC20 transfers:

1. Deposit a real underlying token into the receipt contract.
2. Receive a transferable maturing claim.
3. Sell that claim before maturity through ZubiDubi at a risk-adjusted discount.
4. Let the buyer/maker hold the claim and redeem it at maturity.

In production, the receipt side would normally come from an existing DeFi position rather than from our demo issuer:

- Pendle Principal Tokens bought below par and redeemable at maturity.
- LST/LRT withdrawal receipts or unstaking claims.
- Vault withdrawal shares with epoch-based exits.
- Bridge withdrawal receipts or delayed settlement claims.
- Any transferable claim where redemption is delayed but the backing asset is known.

That is where the economics become real: the seller accepts less than future redemption value to get liquid USDC/WETH now, while the maker earns the discount for taking duration, liquidity, oracle, depeg, and inventory risk. ZubiDubi is the routing and pricing layer for that early-liquidity trade.

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
- Pyth ETH/USD adapter: `0xE5179Bf17673A8Ab717F941a5A5BfedE64a2a2a4`
- Subgraph Studio: `https://thegraph.com/studio/subgraph/zubidubi`
- Subgraph endpoint (v0.9.3): `https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.3`

Public Sepolia maturing asset universe (real tokens + real Chainlink feeds):

| Asset | Address | Maturity | Backing | Live payouts |
| --- | --- | --- | --- | --- |
| PT-zbETH-30D | `0xc53C8D1fFBbb502E1a9004a93Ea33Adc2039F513` | 2026-10-10 21:54:00 UTC | WETH, 1:1 | USDC, WETH |
| PT-zbETH-180D | `0x4Ef8c0e1a313dFf9c25512Fb6dF10C871879A029` | 2027-03-09 21:54:00 UTC | WETH, 1:1 | USDC |
| PT-zbUSD-30D | `0xa6D3A922AA36b37cD9E3fB7A0436aC7df310ae57` | 2026-10-10 21:54:00 UTC | USDC, 1:1 | USDC |
| PT-zbUSD-180D | `0x4bd685DA37569691Cc7427B7Ce509a23bc70b044` | 2027-03-09 21:54:00 UTC | USDC, 1:1 | WETH |
| PT-zbLINK-30D | `0x6D6FDf4D13d2B440CfbfD464A11C55af05964e96` | 2026-10-10 21:54:00 UTC | LINK, 1:1 | USDC |
| PT-zbLINK-180D | `0x5e34350A960911490B9D78f3424BB4303EF29757` | 2027-03-09 21:54:00 UTC | LINK, 1:1 | WETH |

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
- `GET /quote?tokenIn=0xc53C8D1fFBbb502E1a9004a93Ea33Adc2039F513&amountIn=0.003` returns a route preview for a specific maturing asset.
- `POST /quote` accepts `{ "tokenIn": "0x...", "amountIn": "0.003" }`.

The API does not trust indexed liquidity blindly. It uses The Graph to discover executable Aqua strategies, then calls the Sepolia `ZubiDubiRouteExecutor.quoteExactIn` function for fresh balance, allowance, Aqua virtual balance, fee, and route-split checks.

The upgraded subgraph also reconstructs a solver-grade market book:

- `Market`: active strategy count, virtual receipt/quote liquidity, exposure, volume, routes, and DAO revenue.
- `RouteFill`: maker-level fill tape with execution price.
- `StrategySnapshot`: strategy state timeline across ship, push, pull, swap, and dock events.
- `MakerExposure`: maker inventory pressure for routing and risk views.

## Frontend Wallet Flows

The frontend uses the same live paths as the scripts:

- `/markets` reads the Subgraph Studio `v0.9.3` market board.
- `/sell` asks the solver API for a fresh route preview and executes `approve()` plus `ZubiDubiRouteExecutor.routeExactIn()` from the connected Privy wallet.
- `/portfolio#acquire` discovers Sepolia receipt assets from The Graph, lets the user select one claim, reads the connected wallet's backing-token balance, previews `ZubiDubiExitReceipt.previewIssue()`, then submits `approve(underlying -> receipt)` and `issue(assets, receiver)` from the connected wallet.

The acquire flow does not mint arbitrary demo tokens. It requires the user to submit the real backing asset for the selected Sepolia receipt: WETH, USDC, or LINK.

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
