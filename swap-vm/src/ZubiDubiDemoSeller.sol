// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ISwapVM } from "./interfaces/ISwapVM.sol";
import { ZubiDubiRouteExecutor } from "./ZubiDubiRouteExecutor.sol";

contract ZubiDubiDemoSeller {
    using SafeERC20 for IERC20;

    address public immutable owner;
    ZubiDubiRouteExecutor public immutable routeExecutor;

    modifier onlyOwner() {
        require(msg.sender == owner, "ZubiDubiDemoSeller: not owner");
        _;
    }

    constructor(ZubiDubiRouteExecutor routeExecutor_, address owner_) {
        routeExecutor = routeExecutor_;
        owner = owner_;
    }

    function sellExactIn(
        ISwapVM.Order[] calldata orders,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external onlyOwner returns (uint256 totalIn, uint256 totalOut) {
        IERC20(tokenIn).forceApprove(address(routeExecutor), amountIn);
        return routeExecutor.routeExactIn(orders, tokenIn, tokenOut, amountIn, minAmountOut, recipient);
    }
}
