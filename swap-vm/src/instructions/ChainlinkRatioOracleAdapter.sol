// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

/// @title ChainlinkRatioOracleAdapter
/// @notice Derives a real token/token price from two Chainlink token/USD feeds.
/// @dev Returns base/quote scaled to 1e18, shaped like Chainlink AggregatorV3.
///      Example: base = LINK/USD, quote = ETH/USD => LINK priced in WETH.
contract ChainlinkRatioOracleAdapter {
    using SafeCast for int256;

    uint8 internal constant _DECIMALS = 18;

    IPriceOracle public immutable baseUsdFeed;
    IPriceOracle public immutable quoteUsdFeed;
    uint32 public immutable maxStaleness;

    error ChainlinkRatioOracleAdapterStale(uint256 currentTime, uint256 updatedAt, uint32 maxStaleness);
    error ChainlinkRatioOracleAdapterZeroPrice();

    constructor(IPriceOracle baseUsdFeed_, IPriceOracle quoteUsdFeed_, uint32 maxStaleness_) {
        baseUsdFeed = baseUsdFeed_;
        quoteUsdFeed = quoteUsdFeed_;
        maxStaleness = maxStaleness_;
    }

    function decimals() external pure returns (uint8) {
        return _DECIMALS;
    }

    function description() external pure returns (string memory) {
        return "Chainlink token/USD ratio adapter";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return latestRoundData();
    }

    function latestRoundData() public view returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
        (uint256 basePrice, uint256 baseUpdatedAt) = _normalizedPrice(baseUsdFeed);
        (uint256 quotePrice, uint256 quoteUpdatedAt) = _normalizedPrice(quoteUsdFeed);

        updatedAt = baseUpdatedAt < quoteUpdatedAt ? baseUpdatedAt : quoteUpdatedAt;
        if (maxStaleness > 0 && block.timestamp > updatedAt + maxStaleness) {
            revert ChainlinkRatioOracleAdapterStale(block.timestamp, updatedAt, maxStaleness);
        }
        if (basePrice == 0 || quotePrice == 0) revert ChainlinkRatioOracleAdapterZeroPrice();

        answer = int256(basePrice * 1e18 / quotePrice);
        return (1, answer, updatedAt, updatedAt, 1);
    }

    function _normalizedPrice(IPriceOracle feed) private view returns (uint256 price, uint256 updatedAt) {
        int256 answer;
        (, answer, , updatedAt, ) = feed.latestRoundData();
        price = answer.toUint256();

        uint8 feedDecimals = feed.decimals();
        if (feedDecimals < 18) {
            price *= 10 ** (18 - feedDecimals);
        } else if (feedDecimals > 18) {
            price /= 10 ** (feedDecimals - 18);
        }
    }
}
