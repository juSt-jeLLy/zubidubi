// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ZubiDubiExitReceipt
/// @notice Delayed-redemption receipt representing a claim on an underlying asset after maturity.
contract ZubiDubiExitReceipt is ERC20, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint40 public immutable maturity;
    uint256 public immutable assetsPerReceipt;

    error ZubiDubiExitReceiptNotMatured(uint256 currentTime, uint40 maturity);

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

    function fund(uint256 assets) external {
        underlying.safeTransferFrom(msg.sender, address(this), assets);
    }

    function previewRedeem(uint256 receiptAmount) public view returns (uint256 assets) {
        assets = receiptAmount * assetsPerReceipt / 1e18;
    }

    function redeem(uint256 receiptAmount, address receiver) external returns (uint256 assets) {
        if (block.timestamp < maturity) revert ZubiDubiExitReceiptNotMatured(block.timestamp, maturity);

        assets = previewRedeem(receiptAmount);
        _burn(msg.sender, receiptAmount);
        underlying.safeTransfer(receiver, assets);
    }
}
