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

    address internal constant SEPOLIA_AQUA = 0xf2A123D6a9Be099283b836EB5D74c08a3F3e013e;
    address internal constant SEPOLIA_AQUA_SWAP_VM_ROUTER = 0x6BeA330Bd4Ca9B631B2f935C30047C76EC2DAb99;
    address internal constant SEPOLIA_ROUTE_EXECUTOR = 0x21dBAcFBbe7E047Efe94F846BA24FF031379B947;
    address internal constant SEPOLIA_EXIT_RECEIPT = 0x23F341b571434cD17b1232703Cd41569C58106EB;
    address internal constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address internal constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address internal constant SEPOLIA_CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

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
}
