// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { AquaSwapVMRouter } from "../src/routers/AquaSwapVMRouter.sol";
import { ZubiDubiRouteExecutor } from "../src/ZubiDubiRouteExecutor.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

// Deploys Router + Receipt + RouteExecutor against an already-deployed Aqua.
contract DeployZubiDubiSepoliaStack is Script {
    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        require(block.chainid == config.chainId, "DeployZubiDubiSepoliaStack: wrong chain");

        // The Aqua deployed in the previous step.
        address aquaAddress = vm.envOr("ZUBIDUBI_AQUA", config.aqua);

        uint256 deployerPrivateKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address owner = vm.envOr("ZUBIDUBI_OWNER", deployer);

        vm.startBroadcast(deployerPrivateKey);

        AquaSwapVMRouter router = new AquaSwapVMRouter(
            aquaAddress,
            config.weth,
            owner,
            "ZubiDubiAquaSwapVMRouter",
            "1.0.0"
        );
        ZubiDubiExitReceipt receipt = new ZubiDubiExitReceipt(
            owner,
            IERC20(config.weth),
            uint40(block.timestamp + 30 days),
            1e18,
            "ZubiDubi Principal Token (PT) backed by WETH",
            "PT-zbETH"
        );
        ZubiDubiRouteExecutor routeExecutor = new ZubiDubiRouteExecutor(
            Aqua(aquaAddress),
            router,
            owner,
            10,
            8
        );

        vm.stopBroadcast();

        console2.log("ZubiDubi Sepolia Aqua:", aquaAddress);
        console2.log("ZubiDubi Sepolia AquaSwapVMRouter:", address(router));
        console2.log("ZubiDubi Sepolia RouteExecutor:", address(routeExecutor));
        console2.log("ZubiDubi Sepolia ExitReceipt:", address(receipt));

        string memory root = "zubidubi";
        string memory json = vm.serializeUint(root, "chainId", block.chainid);
        json = vm.serializeAddress(root, "deployer", deployer);
        json = vm.serializeAddress(root, "owner", owner);
        json = vm.serializeAddress(root, "aqua", aquaAddress);
        json = vm.serializeAddress(root, "aquaSwapVMRouter", address(router));
        json = vm.serializeAddress(root, "routeExecutor", address(routeExecutor));
        json = vm.serializeAddress(root, "exitReceipt", address(receipt));
        json = vm.serializeAddress(root, "weth", config.weth);
        json = vm.serializeAddress(root, "usdc", config.usdc);
        json = vm.serializeAddress(root, "chainlinkEthUsd", config.chainlinkEthUsd);

        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubi.json"));
    }
}