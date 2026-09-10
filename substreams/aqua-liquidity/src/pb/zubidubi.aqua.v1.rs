#[derive(Clone, PartialEq, ::prost::Message)]
pub struct AquaLiquidityEvents {
    #[prost(message, repeated, tag = "1")]
    pub events: ::prost::alloc::vec::Vec<AquaLiquidityEvent>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct AquaLiquidityEvent {
    #[prost(string, tag = "1")]
    pub event_id: ::prost::alloc::string::String,
    #[prost(string, tag = "2")]
    pub event_type: ::prost::alloc::string::String,
    #[prost(string, tag = "3")]
    pub maker: ::prost::alloc::string::String,
    #[prost(string, tag = "4")]
    pub app: ::prost::alloc::string::String,
    #[prost(string, tag = "5")]
    pub strategy_hash: ::prost::alloc::string::String,
    #[prost(string, tag = "6")]
    pub token: ::prost::alloc::string::String,
    #[prost(string, tag = "7")]
    pub amount: ::prost::alloc::string::String,
    #[prost(string, tag = "8")]
    pub strategy_data: ::prost::alloc::string::String,
    #[prost(uint64, tag = "9")]
    pub block_number: u64,
    #[prost(uint64, tag = "10")]
    pub log_index: u64,
    #[prost(string, tag = "11")]
    pub transaction_hash: ::prost::alloc::string::String,
}
