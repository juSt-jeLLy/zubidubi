// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ChainlinkRatioOracleAdapter } from "../src/instructions/ChainlinkRatioOracleAdapter.sol";
import { IPriceOracle } from "../src/instructions/interfaces/IPriceOracle.sol";
import { PythOracleAdapter, IPyth } from "../src/instructions/PythOracleAdapter.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

/// @notice Deploys the Sepolia demo asset universe: PT-style receipts backed by
///         real Sepolia WETH, USDC, and LINK, plus real Chainlink ratio adapters
///         for non-USD payout routes. No deployed mock tokens or mock feeds.
contract DeployZubiDubiSepoliaAssetSet is Script {
    struct ReceiptSpec {
        string key;
        string name;
        string symbol;
        address underlying;
        string underlyingSymbol;
        uint40 tenor;
        uint256 assetsPerReceipt;
    }

    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        require(block.chainid == config.chainId, "DeployZubiDubiSepoliaAssetSet: wrong chain");

        uint256 deployerPrivateKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address owner = vm.envOr("ZUBIDUBI_OWNER", deployer);
        address pyth = vm.envOr("ZUBIDUBI_PYTH", ZubiDubiConfig.SEPOLIA_PYTH_UPGRADED);
        bytes32 ethUsdPriceId = vm.envOr("ZUBIDUBI_PYTH_ETH_USD_ID", ZubiDubiConfig.PYTH_ETH_USD_ID);
        uint256 pythMaxAge = vm.envOr("ZUBIDUBI_PYTH_MAX_AGE", uint256(0));

        ReceiptSpec[6] memory specs = [
            ReceiptSpec("ptZbEth30d", "ZubiDubi PT-zbETH 30D backed by WETH", "PT-zbETH-30D", config.weth, "WETH", uint40(30 days), 1e18),
            ReceiptSpec("ptZbEth180d", "ZubiDubi PT-zbETH 180D backed by WETH", "PT-zbETH-180D", config.weth, "WETH", uint40(180 days), 1e18),
            ReceiptSpec("ptZbUsd30d", "ZubiDubi PT-zbUSD 30D backed by USDC", "PT-zbUSD-30D", config.usdc, "USDC", uint40(30 days), 1e6),
            ReceiptSpec("ptZbUsd180d", "ZubiDubi PT-zbUSD 180D backed by USDC", "PT-zbUSD-180D", config.usdc, "USDC", uint40(180 days), 1e6),
            ReceiptSpec("ptZbLink30d", "ZubiDubi PT-zbLINK 30D backed by LINK", "PT-zbLINK-30D", config.link, "LINK", uint40(30 days), 1e18),
            ReceiptSpec("ptZbLink180d", "ZubiDubi PT-zbLINK 180D backed by LINK", "PT-zbLINK-180D", config.link, "LINK", uint40(180 days), 1e18)
        ];

        vm.startBroadcast(deployerPrivateKey);

        PythOracleAdapter pythEthUsd = new PythOracleAdapter(IPyth(pyth), ethUsdPriceId, pythMaxAge);
        ChainlinkRatioOracleAdapter ethUsdcOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkEthUsd), IPriceOracle(config.chainlinkUsdcUsd), 2 days);
        ChainlinkRatioOracleAdapter ethWethOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkEthUsd), IPriceOracle(config.chainlinkEthUsd), 2 days);
        ChainlinkRatioOracleAdapter ethLinkOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkEthUsd), IPriceOracle(config.chainlinkLinkUsd), 2 days);
        ChainlinkRatioOracleAdapter usdcUsdcOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkUsdcUsd), IPriceOracle(config.chainlinkUsdcUsd), 2 days);
        ChainlinkRatioOracleAdapter usdcWethOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkUsdcUsd), IPriceOracle(config.chainlinkEthUsd), 2 days);
        ChainlinkRatioOracleAdapter usdcLinkOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkUsdcUsd), IPriceOracle(config.chainlinkLinkUsd), 2 days);
        ChainlinkRatioOracleAdapter linkUsdcOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkLinkUsd), IPriceOracle(config.chainlinkUsdcUsd), 2 days);
        ChainlinkRatioOracleAdapter linkWethOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkLinkUsd), IPriceOracle(config.chainlinkEthUsd), 2 days);
        ChainlinkRatioOracleAdapter linkLinkOracle = new ChainlinkRatioOracleAdapter(IPriceOracle(config.chainlinkLinkUsd), IPriceOracle(config.chainlinkLinkUsd), 2 days);

        ZubiDubiExitReceipt[6] memory receipts;
        for (uint256 i = 0; i < specs.length; i++) {
            receipts[i] = new ZubiDubiExitReceipt(
                owner,
                IERC20(specs[i].underlying),
                uint40(block.timestamp + specs[i].tenor),
                specs[i].assetsPerReceipt,
                specs[i].name,
                specs[i].symbol
            );
        }

        vm.stopBroadcast();

        console2.log("ZubiDubi Sepolia Pyth ETH/USD adapter:", address(pythEthUsd));
        for (uint256 i = 0; i < receipts.length; i++) {
            console2.log(specs[i].symbol, address(receipts[i]));
            console2.log("maturity:", receipts[i].maturity());
        }

        string memory root = "zubidubiSepoliaAssets";
        string memory json = vm.serializeUint(root, "chainId", block.chainid);
        json = vm.serializeAddress(root, "deployer", deployer);
        json = vm.serializeAddress(root, "owner", owner);
        json = vm.serializeAddress(root, "weth", config.weth);
        json = vm.serializeAddress(root, "usdc", config.usdc);
        json = vm.serializeAddress(root, "link", config.link);
        json = vm.serializeAddress(root, "chainlinkEthUsd", config.chainlinkEthUsd);
        json = vm.serializeAddress(root, "chainlinkUsdcUsd", config.chainlinkUsdcUsd);
        json = vm.serializeAddress(root, "chainlinkLinkUsd", config.chainlinkLinkUsd);
        json = vm.serializeAddress(root, "pyth", pyth);
        json = vm.serializeAddress(root, "pythEthUsdAdapter", address(pythEthUsd));
        json = vm.serializeBytes32(root, "pythEthUsdPriceId", ethUsdPriceId);
        json = vm.serializeUint(root, "pythMaxAge", pythMaxAge);
        json = vm.serializeAddress(root, "ethUsdcOracle", address(ethUsdcOracle));
        json = vm.serializeAddress(root, "ethWethOracle", address(ethWethOracle));
        json = vm.serializeAddress(root, "ethLinkOracle", address(ethLinkOracle));
        json = vm.serializeAddress(root, "usdcUsdcOracle", address(usdcUsdcOracle));
        json = vm.serializeAddress(root, "usdcWethOracle", address(usdcWethOracle));
        json = vm.serializeAddress(root, "usdcLinkOracle", address(usdcLinkOracle));
        json = vm.serializeAddress(root, "linkUsdcOracle", address(linkUsdcOracle));
        json = vm.serializeAddress(root, "linkWethOracle", address(linkWethOracle));
        json = vm.serializeAddress(root, "linkLinkOracle", address(linkLinkOracle));

        for (uint256 i = 0; i < specs.length; i++) {
            json = vm.serializeString(root, string.concat(specs[i].key, "Symbol"), specs[i].symbol);
            json = vm.serializeString(root, string.concat(specs[i].key, "Name"), specs[i].name);
            json = vm.serializeAddress(root, string.concat(specs[i].key, "Address"), address(receipts[i]));
            json = vm.serializeAddress(root, string.concat(specs[i].key, "Underlying"), specs[i].underlying);
            json = vm.serializeString(root, string.concat(specs[i].key, "UnderlyingSymbol"), specs[i].underlyingSymbol);
            json = vm.serializeUint(root, string.concat(specs[i].key, "Maturity"), receipts[i].maturity());
            json = vm.serializeUint(root, string.concat(specs[i].key, "AssetsPerReceipt"), specs[i].assetsPerReceipt);
        }

        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubiAssets.json"));
    }
}
