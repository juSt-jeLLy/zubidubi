use substreams::scalar::BigInt;
use substreams_ethereum::pb::eth::v2 as eth;
use substreams_ethereum::Event;

substreams_ethereum::init!();
substreams_ethereum::use_contract!(aqua, "../../subgraph/abis/Aqua.json");

pub mod pb {
    include!("pb/zubidubi.aqua.v1.rs");
}

use pb::{AquaLiquidityEvent, AquaLiquidityEvents};

#[substreams::handlers::map]
pub fn map_aqua_liquidity_events(block: eth::Block) -> Result<AquaLiquidityEvents, substreams::errors::Error> {
    let mut events = Vec::new();

    for log in block.logs() {
        let event_id = format!("{}-{}", hex::encode(&log.receipt.transaction.hash), log.index());
        let transaction_hash = format!("0x{}", hex::encode(&log.receipt.transaction.hash));
        let block_number = block.number;
        let log_index = u64::from(log.index());

        if let Some(event) = aqua::events::Shipped::match_and_decode(log) {
            events.push(AquaLiquidityEvent {
                event_id,
                event_type: "SHIPPED".to_string(),
                maker: address(&event.maker),
                app: address(&event.app),
                strategy_hash: bytes32(&event.strategy_hash),
                token: zero_address(),
                amount: "0".to_string(),
                strategy_data: format!("0x{}", hex::encode(event.strategy)),
                block_number,
                log_index,
                transaction_hash,
            });
            continue;
        }

        if let Some(event) = aqua::events::Pushed::match_and_decode(log) {
            events.push(AquaLiquidityEvent {
                event_id,
                event_type: "PUSHED".to_string(),
                maker: address(&event.maker),
                app: address(&event.app),
                strategy_hash: bytes32(&event.strategy_hash),
                token: address(&event.token),
                amount: bigint(&event.amount),
                strategy_data: String::new(),
                block_number,
                log_index,
                transaction_hash,
            });
            continue;
        }

        if let Some(event) = aqua::events::Pulled::match_and_decode(log) {
            events.push(AquaLiquidityEvent {
                event_id,
                event_type: "PULLED".to_string(),
                maker: address(&event.maker),
                app: address(&event.app),
                strategy_hash: bytes32(&event.strategy_hash),
                token: address(&event.token),
                amount: bigint(&event.amount),
                strategy_data: String::new(),
                block_number,
                log_index,
                transaction_hash,
            });
            continue;
        }

        if let Some(event) = aqua::events::Docked::match_and_decode(log) {
            events.push(AquaLiquidityEvent {
                event_id,
                event_type: "DOCKED".to_string(),
                maker: address(&event.maker),
                app: address(&event.app),
                strategy_hash: bytes32(&event.strategy_hash),
                token: zero_address(),
                amount: "0".to_string(),
                strategy_data: String::new(),
                block_number,
                log_index,
                transaction_hash,
            });
        }
    }

    Ok(AquaLiquidityEvents { events })
}

fn address(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}

fn bytes32(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}

fn bigint(value: &BigInt) -> String {
    value.to_string()
}

fn zero_address() -> String {
    "0x0000000000000000000000000000000000000000".to_string()
}
