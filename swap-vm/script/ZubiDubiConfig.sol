// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

library ZubiDubiConfig {
    struct TokenConfig {
        string symbol;
        address token;
        uint8 decimals;
        address priceFeed;
        uint8 priceFeedDecimals;
        bool isReceipt;
    }

    struct NetworkConfig {
        uint256 chainId;
        address aqua;
        address aquaSwapVMRouter;
        address routeExecutor;
        address exitReceipt;
        address weth;
        address usdc;
        address chainlinkEthUsd;
    }

    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    address internal constant SEPOLIA_AQUA = 0x30aefbDE9EC52A23E597e338F02f35Da909D7183;
    address internal constant SEPOLIA_AQUA_SWAP_VM_ROUTER = 0x3d39B155De93CB9C340577E06b801C4956ed2a57;
    address internal constant SEPOLIA_ROUTE_EXECUTOR = 0x95d74BF2a83bc3ba50dc5c377cE8fB1478Ae5708;
    address internal constant SEPOLIA_EXIT_RECEIPT = 0xb7877571932A025E03a7B9616F254B361FD1759F;
    address internal constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address internal constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address internal constant SEPOLIA_CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    address internal constant MAINNET_WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant MAINNET_CHAINLINK_USDC_USD = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address internal constant MAINNET_CHAINLINK_ETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address internal constant MAINNET_PYTH = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 internal constant MAINNET_PYTH_ETH_USD_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    address internal constant MAINNET_PENDLE_USD3_MARKET_17DEC2026 = 0x4A5067C3fF1abb7449244025B0e37fEAF77D8E3e;
    address internal constant MAINNET_PT_USD3_17DEC2026 = 0x7f47c3e6b2c00fC4eB4d5Ae50d0Ab0Ab6888Eb4D;

    function sepolia() internal pure returns (NetworkConfig memory) {
        return NetworkConfig({
            chainId: SEPOLIA_CHAIN_ID,
            aqua: SEPOLIA_AQUA,
            aquaSwapVMRouter: SEPOLIA_AQUA_SWAP_VM_ROUTER,
            routeExecutor: SEPOLIA_ROUTE_EXECUTOR,
            exitReceipt: SEPOLIA_EXIT_RECEIPT,
            weth: SEPOLIA_WETH,
            usdc: SEPOLIA_USDC,
            chainlinkEthUsd: SEPOLIA_CHAINLINK_ETH_USD
        });
    }

    function sepoliaReceiptAsset() internal pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: "zbETH",
            token: SEPOLIA_EXIT_RECEIPT,
            decimals: 18,
            priceFeed: SEPOLIA_CHAINLINK_ETH_USD,
            priceFeedDecimals: 8,
            isReceipt: true
        });
    }

    function sepoliaQuoteAsset() internal pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: "USDC",
            token: SEPOLIA_USDC,
            decimals: 6,
            priceFeed: address(0),
            priceFeedDecimals: 0,
            isReceipt: false
        });
    }

    function mainnetPendlePtUsd3Asset() internal pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: "PT-USD3-17DEC2026",
            token: MAINNET_PT_USD3_17DEC2026,
            decimals: 6,
            priceFeed: MAINNET_CHAINLINK_USDC_USD,
            priceFeedDecimals: 8,
            isReceipt: true
        });
    }

    function mainnetUsdcAsset() internal pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: "USDC",
            token: MAINNET_USDC,
            decimals: 6,
            priceFeed: MAINNET_CHAINLINK_USDC_USD,
            priceFeedDecimals: 8,
            isReceipt: false
        });
    }
}
