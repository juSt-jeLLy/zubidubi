// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { ITakerCallbacks } from "./interfaces/ITakerCallbacks.sol";
import { ISwapVM } from "./interfaces/ISwapVM.sol";
import { SwapVM } from "./SwapVM.sol";

contract ZubiDubiDemoTaker is ITakerCallbacks {
    Aqua public immutable AQUA;
    SwapVM public immutable SWAPVM;
    address public immutable owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "ZubiDubiDemoTaker: not owner");
        _;
    }

    modifier onlySwapVM() {
        require(msg.sender == address(SWAPVM), "ZubiDubiDemoTaker: not SwapVM");
        _;
    }

    constructor(Aqua aqua, SwapVM swapVM, address owner_) {
        AQUA = aqua;
        SWAPVM = swapVM;
        owner = owner_;
    }

    function swap(
        ISwapVM.Order calldata order,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata takerTraitsAndData
    ) external onlyOwner returns (uint256 amountIn, uint256 amountOut, bytes32 orderHash) {
        return SWAPVM.swap(order, tokenIn, tokenOut, amount, takerTraitsAndData);
    }

    function preTransferInCallback(
        address maker,
        address,
        address tokenIn,
        address,
        uint256 amountIn,
        uint256,
        bytes32 orderHash,
        bytes calldata
    ) external onlySwapVM {
        ERC20(tokenIn).approve(address(AQUA), amountIn);
        AQUA.push(maker, address(SWAPVM), orderHash, tokenIn, amountIn);
    }

    function preTransferOutCallback(
        address,
        address,
        address,
        address,
        uint256,
        uint256,
        bytes32,
        bytes calldata
    ) external onlySwapVM { }
}
