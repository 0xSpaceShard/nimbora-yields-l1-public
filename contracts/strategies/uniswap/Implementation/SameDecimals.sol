// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

// OpenZeppelin imports
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// Local imports
import {ErrorLib} from "../../../lib/ErrorLib.sol";
import {UniswapV3StrategyBase} from "../UniswapV3StrategyBase.sol";

contract UniswapV3StrategySameDecimals is UniswapV3StrategyBase {
    constructor() initializer {}

    function initialize(
        address _l2PoolingManager,
        address _underlyingToken,
        address _yieldToken,
        address _uniswapRouter,
        address _uniswapFactory,
        address _chainlinkPricefeed,
        uint256 _minReceivedAmountFactor,
        uint24 _poolFee
    ) external initializer {
        _initializeUniswapV3StrategyBase(
            _l2PoolingManager,
            _underlyingToken,
            _yieldToken,
            _uniswapRouter,
            _uniswapFactory,
            _chainlinkPricefeed,
            _minReceivedAmountFactor,
            _poolFee
        );
    }
}
