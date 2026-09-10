// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ZubiDubiExitReceipt
/// @notice Delayed-redemption receipt representing a claim on an underlying asset after maturity.
/// @dev Models a Pendle-style Principal Token (PT): a standard, freely tradable ERC20
///      (no transfer restrictions, exactly like a real Pendle PT) that:
///        - is backed 1:1 (per assetsPerReceipt) by a real underlying (e.g. WETH);
///        - exposes an onchain expiry() (the same view a Pendle PT exposes);
///        - can be redeemed for the underlying only after expiry (maturity).
///      Before maturity it trades freely at a discounted fair value; liquidity != redemption.
contract ZubiDubiExitReceipt is ERC20, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint40 public immutable maturity;
    uint256 public immutable assetsPerReceipt;

    error ZubiDubiExitReceiptNotMatured(uint256 currentTime, uint40 maturity);
    error ZubiDubiExitReceiptZeroReceiver();
    error ZubiDubiExitReceiptZeroAmount();
    error ZubiDubiExitReceiptUnauthorizedRedeemer(address caller, address user);

    constructor(
        address owner,
        IERC20 underlying_,
        uint40 maturity_,
        uint256 assetsPerReceipt_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) Ownable(owner) {
        underlying = underlying_;
        maturity = maturity_;
        assetsPerReceipt = assetsPerReceipt_;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function issue(uint256 assets, address receiver) external returns (uint256 receiptAmount) {
        if (receiver == address(0)) revert ZubiDubiExitReceiptZeroReceiver();

        receiptAmount = previewIssue(assets);
        if (receiptAmount == 0) revert ZubiDubiExitReceiptZeroAmount();
        underlying.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, receiptAmount);
    }

    function fund(uint256 assets) external {
        underlying.safeTransferFrom(msg.sender, address(this), assets);
    }

    function previewIssue(uint256 assets) public view returns (uint256 receiptAmount) {
        receiptAmount = assets * 1e18 / assetsPerReceipt;
    }

    function previewRedeem(uint256 receiptAmount) public view returns (uint256 assets) {
        assets = receiptAmount * assetsPerReceipt / 1e18;
    }

    /// @notice Pendle PT interface parity: returns the expiry (maturity) timestamp.
    function expiry() external view returns (uint256) {
        return maturity;
    }

    function redeem(uint256 receiptAmount, address receiver) external returns (uint256 assets) {
        if (block.timestamp < maturity) revert ZubiDubiExitReceiptNotMatured(block.timestamp, maturity);

        assets = previewRedeem(receiptAmount);
        _burn(msg.sender, receiptAmount);
        underlying.safeTransfer(receiver, assets);
    }

    /// @notice Pendle PT-style redeem: burns `receiptAmount` of the caller's receipts and
    ///         sends the underlying to that same user.
    function redeem(address user, uint256 receiptAmount) external returns (uint256 assets) {
        if (msg.sender != user) revert ZubiDubiExitReceiptUnauthorizedRedeemer(msg.sender, user);
        if (block.timestamp < maturity) revert ZubiDubiExitReceiptNotMatured(block.timestamp, maturity);

        assets = previewRedeem(receiptAmount);
        _burn(user, receiptAmount);
        underlying.safeTransfer(user, assets);
    }
}
