// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";

contract ZubiDubiExitReceiptTest is Test {
    TokenMock public weth;
    ZubiDubiExitReceipt public receipt;

    address public owner = vm.addr(0xA11CE);
    address public seller = vm.addr(0x5E11);

    function setUp() public {
        weth = new TokenMock("Wrapped Ether", "WETH");
        receipt = new ZubiDubiExitReceipt(
            owner,
            weth,
            uint40(block.timestamp + 30 days),
            1e18,
            "ZubiDubi ETH Exit Receipt",
            "zbETH"
        );
    }

    function test_ZubiDubiExitReceipt_RedeemsUnderlyingOnlyAfterMaturity() public {
        vm.prank(owner);
        receipt.mint(seller, 2 ether);

        weth.mint(owner, 2 ether);
        vm.prank(owner);
        weth.approve(address(receipt), 2 ether);
        vm.prank(owner);
        receipt.fund(2 ether);

        assertEq(receipt.previewRedeem(2 ether), 2 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                ZubiDubiExitReceipt.ZubiDubiExitReceiptNotMatured.selector,
                block.timestamp,
                uint40(block.timestamp + 30 days)
            )
        );
        vm.prank(seller);
        receipt.redeem(2 ether, seller);

        vm.warp(block.timestamp + 30 days);

        vm.prank(seller);
        uint256 assets = receipt.redeem(2 ether, seller);

        assertEq(assets, 2 ether);
        assertEq(receipt.balanceOf(seller), 0);
        assertEq(weth.balanceOf(seller), 2 ether);
    }
}
