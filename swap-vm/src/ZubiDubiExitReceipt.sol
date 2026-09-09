// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ZubiDubiExitReceipt
/// @notice Demo receipt token representing a delayed ETH-denominated redemption claim.
contract ZubiDubiExitReceipt is ERC20, Ownable {
    constructor(address owner) ERC20("ZubiDubi ETH Exit Receipt", "zbETH") Ownable(owner) { }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
