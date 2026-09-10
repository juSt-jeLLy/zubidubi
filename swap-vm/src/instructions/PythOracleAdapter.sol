// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title PythOracleAdapter
/// @notice Adapts Pyth's onchain price feed into the Chainlink-shaped IPriceOracle
///         interface used by the AquaExit term-curve instructions.
/// @dev Reads Pyth getPriceUnsafe() for a fixed priceId and normalizes the answer
///      to 8 decimals (Chainlink convention), enforcing a max-age guard so the
///      returned price is not silently stale. Deploy one instance per price id.
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint32 publishTime;
    }

    function getPriceUnsafe(bytes32 id) external view returns (Price memory price);
}

contract PythOracleAdapter {
    error PythOracleAdapterZeroPrice();
    error PythOracleAdapterStale(uint256 publishTime, uint256 maxAge, uint256 currentTime);

    uint8 internal constant _DECIMALS = 8;

    IPyth public immutable pyth;
    bytes32 public immutable priceId;
    uint256 public immutable maxAge;

    constructor(IPyth pyth_, bytes32 priceId_, uint256 maxAge_) {
        pyth = pyth_;
        priceId = priceId_;
        maxAge = maxAge_;
    }

    function decimals() external pure returns (uint8) {
        return _DECIMALS;
    }

    function description() external view returns (string memory) {
        return "Pyth (adapted to Chainlink V3 shape)";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return latestRoundData();
    }

    function latestRoundData() public view returns (uint80, int256, uint256, uint256, uint80) {
        IPyth.Price memory p = pyth.getPriceUnsafe(priceId);

        uint256 publishTime = uint256(p.publishTime);
        if (maxAge > 0 && block.timestamp > publishTime + maxAge) {
            revert PythOracleAdapterStale(publishTime, maxAge, block.timestamp);
        }
        if (p.price <= 0) revert PythOracleAdapterZeroPrice();

        // Normalize Pyth's decimal exponent to 8 decimals (Chainlink convention).
        // price = p.price * 10^p.expo ; want answer = price * 10^8.
        int256 shift = 8 + int256(p.expo);
        int256 answer;
        if (shift >= 0) {
            answer = int256(p.price) * int256(_pow10(uint256(shift)));
        } else {
            answer = int256(p.price) / int256(_pow10(uint256(-shift)));
        }

        return (1, answer, publishTime, publishTime, 1);
    }

    function _pow10(uint256 exp) internal pure returns (uint256 result) {
        result = 1;
        while (exp > 0) {
            result *= 10;
            exp--;
        }
    }
}