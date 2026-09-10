// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

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
            "ZubiDubi Principal Token (PT) backed by WETH",
            "PT-zbETH"
        );
    }

    function test_ZubiDubiExitReceipt_ExpiryMatchesMaturity() public view {
        assertEq(receipt.expiry(), receipt.maturity());
        assertGt(receipt.expiry(), block.timestamp);
    }

    function test_ZubiDubiExitReceipt_FreelyTradableBeforeMaturityLikePendlePt() public {
        // Exactly like a Pendle PT: no transfer restrictions pre-maturity.
        weth.mint(seller, 2 ether);
        vm.prank(seller);
        weth.approve(address(receipt), 2 ether);
        vm.prank(seller);
        receipt.issue(2 ether, seller);

        address alice = vm.addr(0xA11CE);
        address bob = vm.addr(0xB0B);

        vm.prank(seller);
        receipt.transfer(alice, 1 ether);
        assertEq(receipt.balanceOf(alice), 1 ether);
        assertEq(receipt.balanceOf(seller), 1 ether);

        // A third party can also move it freely — no whitelist, no gate.
        vm.prank(alice);
        receipt.transfer(bob, 0.5 ether);
        assertEq(receipt.balanceOf(alice), 0.5 ether);
        assertEq(receipt.balanceOf(bob), 0.5 ether);
    }

    function test_ZubiDubiExitReceipt_PendleStyleRedeemForUser() public {
        weth.mint(seller, 2 ether);
        vm.prank(seller);
        weth.approve(address(receipt), 2 ether);
        vm.prank(seller);
        receipt.issue(2 ether, seller);

        address redeemer = vm.addr(0x5E11);
        vm.prank(seller);
        receipt.transfer(redeemer, 2 ether);

        vm.warp(block.timestamp + 30 days);

        // Pendle-style redeem(user, amount) burns the caller's receipts and sends
        // the underlying to that same user.
        vm.prank(redeemer);
        uint256 assets = receipt.redeem(redeemer, 2 ether);

        assertEq(assets, 2 ether);
        assertEq(receipt.balanceOf(redeemer), 0);
        assertEq(weth.balanceOf(redeemer), 2 ether);
    }

    function test_ZubiDubiExitReceipt_RedeemsUnderlyingOnlyAfterMaturity() public {
        weth.mint(seller, 2 ether);
        vm.prank(seller);
        weth.approve(address(receipt), 2 ether);
        vm.prank(seller);
        uint256 receiptAmount = receipt.issue(2 ether, seller);

        assertEq(receiptAmount, 2 ether);
        assertEq(weth.balanceOf(address(receipt)), 2 ether);
        assertEq(receipt.balanceOf(seller), 2 ether);
        assertEq(receipt.previewIssue(2 ether), 2 ether);
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

    function test_ZubiDubiExitReceipt_IssueRevertsOnZeroReceiver() public {
        weth.mint(seller, 2 ether);
        vm.prank(seller);
        weth.approve(address(receipt), 2 ether);
        vm.prank(seller);
        vm.expectRevert(ZubiDubiExitReceipt.ZubiDubiExitReceiptZeroReceiver.selector);
        receipt.issue(2 ether, address(0));
    }

    function test_ZubiDubiExitReceipt_IssueRevertsOnMissingAllowance() public {
        weth.mint(seller, 2 ether);
        vm.prank(seller);
        // No allowance approved: issue() must cleanly revert inside the
        // underlying safeTransferFrom instead of minting a claim it cannot back.
        vm.expectRevert();
        receipt.issue(2 ether, seller);

        // Sanity: the receipt contract holds nothing and the seller still has both assets.
        assertEq(weth.balanceOf(address(receipt)), 0);
        assertEq(weth.balanceOf(seller), 2 ether);
        assertEq(receipt.balanceOf(seller), 0);
    }

    function test_ZubiDubiExitReceipt_IssueRevertsWhenReceiptAmountRoundsToZero() public {
        ZubiDubiExitReceipt receipt2 = new ZubiDubiExitReceipt(
            owner,
            weth,
            uint40(block.timestamp + 30 days),
            3e18,
            "ZubiDubi ETH Exit Receipt",
            "zbETH"
        );

        weth.mint(seller, 1 wei);
        vm.prank(seller);
        weth.approve(address(receipt2), 1 wei);

        vm.prank(seller);
        vm.expectRevert(ZubiDubiExitReceipt.ZubiDubiExitReceiptZeroAmount.selector);
        receipt2.issue(1 wei, seller);

        assertEq(weth.balanceOf(address(receipt2)), 0);
        assertEq(receipt2.balanceOf(seller), 0);
    }

    function test_ZubiDubiExitReceipt_RedeemForUserCannotBeForcedByThirdParty() public {
        weth.mint(seller, 2 ether);
        vm.prank(seller);
        weth.approve(address(receipt), 2 ether);
        vm.prank(seller);
        receipt.issue(2 ether, seller);

        vm.warp(block.timestamp + 30 days);

        address thirdParty = vm.addr(0xBAD);
        vm.prank(thirdParty);
        vm.expectRevert(
            abi.encodeWithSelector(
                ZubiDubiExitReceipt.ZubiDubiExitReceiptUnauthorizedRedeemer.selector,
                thirdParty,
                seller
            )
        );
        receipt.redeem(seller, 2 ether);

        assertEq(receipt.balanceOf(seller), 2 ether);
        assertEq(weth.balanceOf(seller), 0);
    }

    function test_ZubiDubiExitReceipt_IssueRoundingRoundTripsForNonUnityRate() public {
        ZubiDubiExitReceipt receipt2 = new ZubiDubiExitReceipt(
            owner,
            weth,
            uint40(block.timestamp + 30 days),
            2e18,
            "ZubiDubi ETH Exit Receipt",
            "zbETH"
        );

        // 3 WETH in => 1.5 receipts (each redeemable for 2 WETH).
        assertEq(receipt2.previewIssue(3 ether), 1.5 ether);
        assertEq(receipt2.previewRedeem(1.5 ether), 3 ether);

        weth.mint(seller, 3 ether);
        vm.prank(seller);
        weth.approve(address(receipt2), 3 ether);
        vm.prank(seller);
        uint256 minted = receipt2.issue(3 ether, seller);

        assertEq(minted, 1.5 ether);
        assertEq(receipt2.balanceOf(seller), 1.5 ether);
        assertEq(weth.balanceOf(address(receipt2)), 3 ether);

        vm.warp(block.timestamp + 30 days);
        vm.prank(seller);
        uint256 redeemed = receipt2.redeem(1.5 ether, seller);

        assertEq(redeemed, 3 ether);
        assertEq(weth.balanceOf(seller), 3 ether);
    }

    function test_ZubiDubiExitReceipt_IssueDustTruncatesOnNonUnityRate() public {
        ZubiDubiExitReceipt receipt3 = new ZubiDubiExitReceipt(
            owner,
            weth,
            uint40(block.timestamp + 30 days),
            3e18,
            "ZubiDubi ETH Exit Receipt",
            "zbETH"
        );

        // 4 WETH in => 1.3333... receipts; redeem dust is truncated below 4 WETH.
        uint256 receiptAmount = receipt3.previewIssue(4 ether);
        assertEq(receiptAmount, 1_333_333_333_333_333_333);

        weth.mint(seller, 4 ether);
        vm.prank(seller);
        weth.approve(address(receipt3), 4 ether);
        vm.prank(seller);
        uint256 minted = receipt3.issue(4 ether, seller);

        assertEq(minted, receiptAmount);
        assertLt(receipt3.previewRedeem(minted), 4 ether);

        vm.warp(block.timestamp + 30 days);
        vm.prank(seller);
        uint256 redeemed = receipt3.redeem(minted, seller);

        assertEq(redeemed, receipt3.previewRedeem(minted));
        assertLt(redeemed, 4 ether);
    }

    function test_ZubiDubiExitReceipt_OnlyOwnerCanMintForFixtures() public {
        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, seller)
        );
        receipt.mint(seller, 1 ether);
    }

    function test_ZubiDubiExitReceipt_OwnerCanFundAndMintForFixtures() public {
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
