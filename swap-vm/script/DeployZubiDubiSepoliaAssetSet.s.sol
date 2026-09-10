// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { PythOracleAdapter, IPyth } from "../src/instructions/PythOracleAdapter.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

/// @notice Deploys the Sepolia demo asset universe: five PT-style WETH-backed
///         receipt assets plus a Pyth ETH/USD adapter for dual-oracle routes.
contract DeployZubiDubiSepoliaAssetSet is Script {
    struct ReceiptSpec {
        string key;
        string name;
        string symbol;
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

        ReceiptSpec[5] memory specs = [
            ReceiptSpec("ptZbEth30d", "ZubiDubi PT-zbETH 30D backed by WETH", "PT-zbETH-30D", uint40(30 days), 1e18),
            ReceiptSpec("ptZbEth60d", "ZubiDubi PT-zbETH 60D backed by WETH", "PT-zbETH-60D", uint40(60 days), 1e18),
            ReceiptSpec("ptZbEth90d", "ZubiDubi PT-zbETH 90D backed by WETH", "PT-zbETH-90D", uint40(90 days), 1e18),
            ReceiptSpec("ptZbEth180d", "ZubiDubi PT-zbETH 180D backed by WETH", "PT-zbETH-180D", uint40(180 days), 1e18),
            ReceiptSpec("ptZbEth360d", "ZubiDubi PT-zbETH 360D backed by WETH", "PT-zbETH-360D", uint40(360 days), 1e18)
        ];

        vm.startBroadcast(deployerPrivateKey);

        PythOracleAdapter pythEthUsd = new PythOracleAdapter(IPyth(pyth), ethUsdPriceId, pythMaxAge);

        ZubiDubiExitReceipt[5] memory receipts;
        for (uint256 i = 0; i < specs.length; i++) {
            receipts[i] = new ZubiDubiExitReceipt(
                owner,
                IERC20(config.weth),
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
        json = vm.serializeAddress(root, "underlying", config.weth);
        json = vm.serializeAddress(root, "quoteToken", config.usdc);
        json = vm.serializeAddress(root, "chainlinkEthUsd", config.chainlinkEthUsd);
        json = vm.serializeAddress(root, "pyth", pyth);
        json = vm.serializeAddress(root, "pythEthUsdAdapter", address(pythEthUsd));
        json = vm.serializeBytes32(root, "pythEthUsdPriceId", ethUsdPriceId);
        json = vm.serializeUint(root, "pythMaxAge", pythMaxAge);

        for (uint256 i = 0; i < specs.length; i++) {
            json = vm.serializeString(root, string.concat(specs[i].key, "Symbol"), specs[i].symbol);
            json = vm.serializeString(root, string.concat(specs[i].key, "Name"), specs[i].name);
            json = vm.serializeAddress(root, string.concat(specs[i].key, "Address"), address(receipts[i]));
            json = vm.serializeUint(root, string.concat(specs[i].key, "Maturity"), receipts[i].maturity());
            json = vm.serializeUint(root, string.concat(specs[i].key, "AssetsPerReceipt"), specs[i].assetsPerReceipt);
        }

        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubiAssets.json"));
    }
}
