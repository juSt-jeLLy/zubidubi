# ZubiDubi Markets

Design a DeFi web app frontend for "ZubiDubi" — a protocol for early, self-custodial

exit liquidity on maturing DeFi assets (e.g. Pendle PT tokens, LRT receipts). Style:

clean, modern DeFi/fintech — dark mode default, data-dense but not cluttered, subtle

motion on state changes (numbers ticking, cards flipping to show skip reasons).

NAVBAR (persistent, top):

- Logo, left

- Center/left nav links: Markets, Sell, Make, Portfolio

- Right: Connect Wallet button (shows truncated address + network badge once connected)

- Small "Playground" link, de-emphasized (footer or far right, smaller text) —

  this is a verification/testing page for power users, not primary nav weight

PAGE 1 — Landing

- First screen introduces ZubiDubi as self-custodial term liquidity for

  maturing DeFi assets.

- Clearly states the DeFi problem, the Aqua/SwapVM mechanism, and the primary

  actions: explore markets, sell a position, or make a strategy.

PAGE 2 — Markets

- Hero: one-line value prop + a live stat strip (total open maker liquidity, active

  markets, avg discount)

- Grid of market cards, one per asset (e.g. zbETH, PT-USD3): current best discount %,

  days to maturity, open maker liquidity, number of active strategies. Click → Sell

  page pre-filtered to that asset.

- Below the fold: compact recent-activity ticker (fills, new strategies shipped) —

  a scrolling/paginated list, not a full dashboard.

PAGE 3 — Sell (taker flow)

- Step 1: asset + amount input (token selector, amount field, live "you receive"

  estimate)

- Step 2: quote breakdown card — expandable list of contributing makers, each row

  showing maker address/ENS, amount filled, discount %, and a status badge

  (filled ✓ / skipped — insolvent / skipped — exposure cap). This is the signature

  screen of the app — make it visually clear and satisfying, e.g. a stacked bar

  showing each maker's contribution to the total fill.

- Step 3 (only for real-asset markets like PT-USD3): a small benchmark strip —

  "Our quote: X% · Pendle market rate: Y%" side by side

- Step 4: approve + confirm button, then a success state with tx hash, net received,

  effective discount, fee taken

PAGE 4 — Make (maker flow)

- Form, grouped into collapsible sections: Pair selection · Pricing (base discount,

  annual rate, max discount) · Curve shape (linear/convex toggle + convexity slider)

  · Risk tier · Maturity window (min/max sliders) · Exposure limits · Oracle safety

  (primary + optional secondary oracle, deviation tolerance)

- Live curve preview chart (discount % vs. time-to-maturity, updates as the user

  drags sliders) — this is the second signature screen, make the chart prominent,

  large, and reactive

- Approve + Ship button, then a confirmation state

- Below the form (once wallet connected and has strategies): a compact list of the

  maker's own open strategies with exposure-used bars and a dock/withdraw action

PAGE 5 — Portfolio

- Two tabs: "Holdings" (receipts owned, maturity countdown per item, redeem button

  once matured) and "My Strategies" (if the connected wallet is also a maker —

  exposure used, fees earned, dock action, same cards as bottom of Make page)

PAGE 6 — Playground (secondary nav weight)

- Split into two halves: "Live Playground" (buttons that trigger real testnet

  contract calls — ship a demo strategy, get a quote, execute a route, redeem —

  showing real transaction results) and "Verified Properties" (a static table of

  invariant/fuzz test results — property name, description, status, pulled from a

  checked-in test report)

General: mobile-responsive, wallet connection persists across pages, loading and

empty states designed intentionally (not blank), error states for reverted txs

shown clearly with the on-chain revert reason when available.


so now dont use color gradiesnt in dark theme and maybe yello theme so now build this

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/64bea773-c5e1-4730-a67a-7f6f3ad93292).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
