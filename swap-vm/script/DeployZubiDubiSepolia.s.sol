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

contract DeployZubiDubiSepolia is Script {
    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        require(block.chainid == config.chainId, "DeployZubiDubiSepolia: wrong chain");

        uint256 deployerPrivateKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address owner = vm.envOr("ZUBIDUBI_OWNER", deployer);

        vm.startBroadcast(deployerPrivateKey);

        Aqua aqua = new Aqua();
        AquaSwapVMRouter router = new AquaSwapVMRouter(
            address(aqua),
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
            "ZubiDubi ETH Exit Receipt",
            "zbETH"
        );
        ZubiDubiRouteExecutor routeExecutor = new ZubiDubiRouteExecutor(aqua, router, owner, 10);

        vm.stopBroadcast();

        console2.log("ZubiDubi Sepolia Aqua:", address(aqua));
        console2.log("ZubiDubi Sepolia AquaSwapVMRouter:", address(router));
        console2.log("ZubiDubi Sepolia RouteExecutor:", address(routeExecutor));
        console2.log("ZubiDubi Sepolia ExitReceipt:", address(receipt));
        console2.log("Sepolia WETH:", config.weth);
        console2.log("Sepolia USDC:", config.usdc);
        console2.log("Sepolia Chainlink ETH/USD:", config.chainlinkEthUsd);

        string memory root = "zubidubi";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "owner", owner);
        vm.serializeAddress(root, "aqua", address(aqua));
        vm.serializeAddress(root, "aquaSwapVMRouter", address(router));
        vm.serializeAddress(root, "routeExecutor", address(routeExecutor));
        vm.serializeAddress(root, "exitReceipt", address(receipt));
        vm.serializeAddress(root, "weth", config.weth);
        vm.serializeAddress(root, "usdc", config.usdc);
        string memory json = vm.serializeAddress(root, "chainlinkEthUsd", config.chainlinkEthUsd);

        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubi.json"));
    }
}
