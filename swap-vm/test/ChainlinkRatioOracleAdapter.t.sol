// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";

import { ChainlinkRatioOracleAdapter } from "../src/instructions/ChainlinkRatioOracleAdapter.sol";
import { IPriceOracle } from "../src/instructions/interfaces/IPriceOracle.sol";
import { MockPriceOracle } from "./mocks/MockPriceOracle.sol";

contract ChainlinkRatioOracleAdapterTest is Test {
    MockPriceOracle public ethUsd;
    MockPriceOracle public usdcUsd;

    function setUp() public {
        vm.warp(10 days);
        ethUsd = new MockPriceOracle(3000e8, 8);
        usdcUsd = new MockPriceOracle(1e8, 8);
    }

    function test_ChainlinkRatioOracleAdapter_DerivesBaseQuoteFromTwoRealFeedShapes() public {
        ChainlinkRatioOracleAdapter ethUsdc = new ChainlinkRatioOracleAdapter(IPriceOracle(address(ethUsd)), IPriceOracle(address(usdcUsd)), 2 days);
        (, int256 answer, , uint256 updatedAt, ) = ethUsdc.latestRoundData();

        assertEq(ethUsdc.decimals(), 18);
        assertEq(answer, 3000e18);
        assertEq(updatedAt, block.timestamp);
    }

    function test_ChainlinkRatioOracleAdapter_DerivesInverseQuote() public {
        ChainlinkRatioOracleAdapter usdcEth = new ChainlinkRatioOracleAdapter(IPriceOracle(address(usdcUsd)), IPriceOracle(address(ethUsd)), 2 days);
        (, int256 answer, , , ) = usdcEth.latestRoundData();

        assertEq(uint256(answer), uint256(1e18) / 3000);
    }

    function test_ChainlinkRatioOracleAdapter_RevertsWhenEitherFeedIsStale() public {
        ethUsd.setUpdatedAt(block.timestamp - 3 days);
        ChainlinkRatioOracleAdapter ethUsdc = new ChainlinkRatioOracleAdapter(IPriceOracle(address(ethUsd)), IPriceOracle(address(usdcUsd)), 2 days);

        vm.expectRevert();
        ethUsdc.latestRoundData();
    }
}
