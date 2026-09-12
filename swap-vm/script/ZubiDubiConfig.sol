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
        address link;
        address chainlinkEthUsd;
        address chainlinkUsdcUsd;
        address chainlinkLinkUsd;
    }

    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    address internal constant SEPOLIA_AQUA = 0x30aefbDE9EC52A23E597e338F02f35Da909D7183;
    address internal constant SEPOLIA_AQUA_SWAP_VM_ROUTER = 0x3d39B155De93CB9C340577E06b801C4956ed2a57;
    address internal constant SEPOLIA_ROUTE_EXECUTOR = 0x5b9f90FDe93d0284A3a937078D6DDEF678816127;
    address internal constant SEPOLIA_EXIT_RECEIPT = 0xb7877571932A025E03a7B9616F254B361FD1759F;
    address internal constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address internal constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address internal constant SEPOLIA_LINK = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address internal constant SEPOLIA_CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address internal constant SEPOLIA_CHAINLINK_USDC_USD = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;
    address internal constant SEPOLIA_CHAINLINK_LINK_USD = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
    address internal constant SEPOLIA_PYTH_CURRENT = 0xDd24F84d36BF92C65F92307595335bdFab5Bbd21;
    address internal constant SEPOLIA_PYTH_UPGRADED = 0xBb86bCc951A62DF86826219d9251Ee05F2c1e286;
    address internal constant SEPOLIA_PYTH_ETH_USD_ADAPTER = 0x6d735402E116BcfC5044B6645e090667e68E2eB8;
    address internal constant SEPOLIA_PT_ZBETH_30D = 0xc53C8D1fFBbb502E1a9004a93Ea33Adc2039F513;
    address internal constant SEPOLIA_PT_ZBETH_180D = 0x4Ef8c0e1a313dFf9c25512Fb6dF10C871879A029;
    address internal constant SEPOLIA_PT_ZBUSD_30D = 0xa6D3A922AA36b37cD9E3fB7A0436aC7df310ae57;
    address internal constant SEPOLIA_PT_ZBUSD_180D = 0x4bd685DA37569691Cc7427B7Ce509a23bc70b044;
    address internal constant SEPOLIA_PT_ZBLINK_30D = 0x6D6FDf4D13d2B440CfbfD464A11C55af05964e96;
    address internal constant SEPOLIA_PT_ZBLINK_180D = 0x5e34350A960911490B9D78f3424BB4303EF29757;

    address internal constant MAINNET_WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant MAINNET_CHAINLINK_USDC_USD = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address internal constant MAINNET_CHAINLINK_ETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address internal constant MAINNET_PYTH = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 internal constant PYTH_ETH_USD_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 internal constant MAINNET_PYTH_ETH_USD_ID = PYTH_ETH_USD_ID;
    address internal constant MAINNET_PENDLE_ROUTER_STATIC = 0x263833d47eA3fA4a30f269323aba6a107f9eB14C;
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
            link: SEPOLIA_LINK,
            chainlinkEthUsd: SEPOLIA_CHAINLINK_ETH_USD,
            chainlinkUsdcUsd: SEPOLIA_CHAINLINK_USDC_USD,
            chainlinkLinkUsd: SEPOLIA_CHAINLINK_LINK_USD
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

    function sepoliaMaturingReceiptAsset(uint256 index) internal pure returns (TokenConfig memory) {
        if (index == 0) {
            return _sepoliaPtZbEth("PT-zbETH-30D", SEPOLIA_PT_ZBETH_30D);
        }
        if (index == 1) {
            return _sepoliaPtZbEth("PT-zbETH-180D", SEPOLIA_PT_ZBETH_180D);
        }
        if (index == 2) {
            return _sepoliaPtZbUsd("PT-zbUSD-30D", SEPOLIA_PT_ZBUSD_30D);
        }
        if (index == 3) {
            return _sepoliaPtZbUsd("PT-zbUSD-180D", SEPOLIA_PT_ZBUSD_180D);
        }
        if (index == 4) {
            return _sepoliaPtZbLink("PT-zbLINK-30D", SEPOLIA_PT_ZBLINK_30D);
        }
        if (index == 5) {
            return _sepoliaPtZbLink("PT-zbLINK-180D", SEPOLIA_PT_ZBLINK_180D);
        }
        revert("ZubiDubiConfig: unknown Sepolia maturing asset");
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

    function _sepoliaPtZbEth(string memory symbol, address token) private pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: symbol,
            token: token,
            decimals: 18,
            priceFeed: SEPOLIA_CHAINLINK_ETH_USD,
            priceFeedDecimals: 8,
            isReceipt: true
        });
    }

    function _sepoliaPtZbUsd(string memory symbol, address token) private pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: symbol,
            token: token,
            decimals: 18,
            priceFeed: SEPOLIA_CHAINLINK_USDC_USD,
            priceFeedDecimals: 8,
            isReceipt: true
        });
    }

    function _sepoliaPtZbLink(string memory symbol, address token) private pure returns (TokenConfig memory) {
        return TokenConfig({
            symbol: symbol,
            token: token,
            decimals: 18,
            priceFeed: SEPOLIA_CHAINLINK_LINK_USD,
            priceFeedDecimals: 8,
            isReceipt: true
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
