# ZubiDubi Aqua Liquidity Substreams

Reusable Substreams package for Aqua shared-liquidity flows.

## Why This Exists

The ZubiDubi subgraph gives the app a queryable market book. This Substreams module is the faster, composable extraction layer underneath that idea: it converts raw EVM blocks into standardized Aqua liquidity events.

That improves the Graph bounty story because ZubiDubi can show two Graph products working together:

- Substreams extracts reusable Aqua lifecycle deltas.
- Subgraph Studio stores and serves the ZubiDubi-specific market book, route tape, strategy snapshots, and DAO revenue analytics.

## Module

`map_aqua_liquidity_events`

Extracts:

- `SHIPPED`: maker publishes an executable Aqua strategy.
- `PUSHED`: strategy receives or rebalances virtual liquidity.
- `PULLED`: app pulls maker wallet liquidity during settlement.
- `DOCKED`: maker deactivates a strategy.

Output message:

```text
zubidubi.aqua.v1.AquaLiquidityEvents
```

## Build

Install the WASM target once:

```bash
rustup target add wasm32-unknown-unknown
```

Build:

```bash
cargo build --release --target wasm32-unknown-unknown
```

The Rust protobuf structs are committed under `src/pb/` so a local `protoc` install is not required for normal builds. Edit the `.proto` and regenerate only if the output schema changes.

Verified locally:

```bash
cargo check
cargo build --release --target wasm32-unknown-unknown
```

## Package And Run

After installing the Substreams CLI:

```bash
substreams pack
substreams run substreams.yaml map_aqua_liquidity_events \
  --start-block 11671900 \
  --stop-block +500 \
  -e <THE_GRAPH_MARKET_OR_PINAX_ETHEREUM_ENDPOINT>
```

## How ZubiDubi Uses This

For the hackathon demo, the live deployed subgraph is already enough for the app. This module is the next upgrade:

1. Stream Aqua lifecycle events with Substreams.
2. Sink those standardized deltas into the ZubiDubi subgraph or another data store.
3. Let the solver consume the richer market book from GraphQL.
4. Reuse the same Aqua delta module for future chains and future Aqua apps.

This is closer to the winner pattern: the project has a custom Aqua/SwapVM primitive plus a serious data plane for market reconstruction.
