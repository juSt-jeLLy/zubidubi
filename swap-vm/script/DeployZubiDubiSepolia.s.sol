// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { AquaSwapVMRouter } from "../src/routers/AquaSwapVMRouter.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";

contract DeployZubiDubiSepolia is Script {
    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;

    address public constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address public constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address public constant SEPOLIA_CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    function run() external {
        require(block.chainid == SEPOLIA_CHAIN_ID, "DeployZubiDubiSepolia: wrong chain");

        uint256 deployerPrivateKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address owner = vm.envOr("ZUBIDUBI_OWNER", deployer);

        vm.startBroadcast(deployerPrivateKey);

        Aqua aqua = new Aqua();
        AquaSwapVMRouter router = new AquaSwapVMRouter(
            address(aqua),
            SEPOLIA_WETH,
            owner,
            "ZubiDubiAquaSwapVMRouter",
            "1.0.0"
        );
        ZubiDubiExitReceipt receipt = new ZubiDubiExitReceipt(owner);

        vm.stopBroadcast();

        console2.log("ZubiDubi Sepolia Aqua:", address(aqua));
        console2.log("ZubiDubi Sepolia AquaSwapVMRouter:", address(router));
        console2.log("ZubiDubi Sepolia ExitReceipt:", address(receipt));
        console2.log("Sepolia WETH:", SEPOLIA_WETH);
        console2.log("Sepolia USDC:", SEPOLIA_USDC);
        console2.log("Sepolia Chainlink ETH/USD:", SEPOLIA_CHAINLINK_ETH_USD);

        string memory root = "zubidubi";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "owner", owner);
        vm.serializeAddress(root, "aqua", address(aqua));
        vm.serializeAddress(root, "aquaSwapVMRouter", address(router));
        vm.serializeAddress(root, "exitReceipt", address(receipt));
        vm.serializeAddress(root, "weth", SEPOLIA_WETH);
        vm.serializeAddress(root, "usdc", SEPOLIA_USDC);
        string memory json = vm.serializeAddress(root, "chainlinkEthUsd", SEPOLIA_CHAINLINK_ETH_USD);

        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubi.json"));
    }
}
