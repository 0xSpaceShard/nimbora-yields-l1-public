// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {StrategyBase} from "../StrategyBase.sol";
import {IChainlinkAggregator} from "../../interfaces/IChainlinkAggregator.sol";
import {ErrorLib} from "../../lib/ErrorLib.sol";

/// @title Uniswap v3 strategy
/// @author @nimbora 2024
contract UniswapV3Strategy is StrategyBase {
    uint256 private constant SLIPPAGE_PRECISION = 10 ** 18;

    ISwapRouter public uniswapRouter;
    IChainlinkAggregator public chainlinkPricefeed;
    uint256 public pricefeedPrecision;
    uint256 public minReceivedAmountFactor;
    uint24 public poolFee;
    address public wETH;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _poolingManager,
        address _underlyingToken,
        address _yieldToken,
        address _bridge,
        address _uniswapRouter,
        address _uniswapFactory,
        address _chainlinkPricefeed,
        uint256 _minReceivedAmountFactor,
        uint24 _poolFee
    ) external initializer {
        _strategyBase__init(_poolingManager, _underlyingToken, _yieldToken, _bridge);
        _uniswap__init(_uniswapRouter, _uniswapFactory, _underlyingToken, _yieldToken, _poolFee);
        _chainlink__init(_chainlinkPricefeed);

        _setSlippage(_minReceivedAmountFactor);
    }

    function _uniswap__init(
        address _uniswapRouter,
        address _uniswapFactory,
        address _underlyingToken,
        address _yieldToken,
        uint24 _poolFee
    ) internal {
        uniswapRouter = ISwapRouter(_uniswapRouter);
        IUniswapV3Factory uniswapFactory = IUniswapV3Factory(_uniswapFactory);
        address poolAddress = uniswapFactory.getPool(_underlyingToken, _yieldToken, _poolFee);
        if (poolAddress == address(0)) revert ErrorLib.PoolNotExist();
        poolFee = _poolFee;
        IERC20Metadata(_yieldToken).approve(_uniswapRouter, type(uint256).max);
    }

    function _chainlink__init(address _chainlinkPricefeed) internal {
        chainlinkPricefeed = IChainlinkAggregator(_chainlinkPricefeed);
        pricefeedPrecision = 10 ** chainlinkPricefeed.decimals();
    }

    function addressToApprove() external view override returns (address) {
        return (address(uniswapRouter));
    }

    function depositCalldata(uint256 _amount) external view override returns (address target, bytes memory cdata) {
        uint256 yieldAmount = _underlyingToYield(_amount);
        uint256 amountOutMinimum = _applySlippageDepositExactInputSingle(yieldAmount);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: underlyingToken,
            tokenOut: yieldToken,
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: _amount,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });
        cdata = abi.encodeWithSignature(
            "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
            params
        );
        target = address(uniswapRouter);
    }

    function _withdraw(uint256 _amount) internal override returns (uint256) {
        uint256 latestAnswer = uint256(_chainlinkLatestAnswer());
        uint256 yieldAmount = _calculateUnderlyingToYieldAmount(latestAnswer, _amount);
        uint256 amountInMaximum = _applySlippageWithdrawExactOutputSingle(yieldAmount);
        uint256 strategyYieldBalance = _yieldBalance();

        if (amountInMaximum > strategyYieldBalance) {
            uint256 underlyingAmount = _calculateYieldToUnderlyingAmount(latestAnswer, strategyYieldBalance);
            uint256 amountOutMinimum = _applySlippageDepositExactInputSingle(underlyingAmount);
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: yieldToken,
                tokenOut: underlyingToken,
                fee: poolFee,
                recipient: poolingManager,
                deadline: block.timestamp,
                amountIn: strategyYieldBalance,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            return uniswapRouter.exactInputSingle(params);
        } else {
            ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
                tokenIn: yieldToken,
                tokenOut: underlyingToken,
                fee: poolFee,
                recipient: poolingManager,
                deadline: block.timestamp,
                amountOut: _amount,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });
            uniswapRouter.exactOutputSingle(params);
            return (_amount);
        }
    }

    function setMinReceivedAmountFactor(uint256 _minReceivedAmountFactor) external {
        _assertOnlyRoleOwner();
        _setSlippage(_minReceivedAmountFactor);
    }

    function chainlinkLatestAnswer() external view returns (int256) {
        return _chainlinkLatestAnswer();
    }

    function applySlippageDepositExactInputSingle(uint256 amount) external view returns (uint256) {
        return _applySlippageDepositExactInputSingle(amount);
    }

    function applySlippageWithdrawExactOutputSingle(uint256 amount) external view returns (uint256) {
        return _applySlippageWithdrawExactOutputSingle(amount);
    }

    function _setSlippage(uint256 _minReceivedAmountFactor) internal {
        if (_minReceivedAmountFactor > SLIPPAGE_PRECISION || _minReceivedAmountFactor < (SLIPPAGE_PRECISION * 95) / 100)
            revert ErrorLib.InvalidSlippage();
        minReceivedAmountFactor = _minReceivedAmountFactor;
    }

    function _applySlippageDepositExactInputSingle(uint256 _amount) internal view returns (uint256) {
        return (minReceivedAmountFactor * _amount) / (SLIPPAGE_PRECISION);
    }

    function _applySlippageWithdrawExactOutputSingle(uint256 _amount) internal view returns (uint256) {
        return (SLIPPAGE_PRECISION * _amount) / (minReceivedAmountFactor);
    }

    function _chainlinkLatestAnswer() internal view returns (int256) {
        return chainlinkPricefeed.latestAnswer();
    }

    function _underlyingToYield(uint256 _amount) internal view override returns (uint256) {
        return _calculateUnderlyingToYieldAmount(uint256(_chainlinkLatestAnswer()), _amount);
    }

    function _yieldToUnderlying(uint256 _amount) internal view override returns (uint256) {
        return _calculateYieldToUnderlyingAmount(uint256(_chainlinkLatestAnswer()), _amount);
    }

    function _calculateUnderlyingToYieldAmount(
        uint256 _yieldPrice,
        uint256 _amount
    ) internal view virtual returns (uint256) {
        uint256 yPrecision = 10 ** IERC20Metadata(yieldToken).decimals();
        uint256 uPrecision = 10 ** IERC20Metadata(underlyingToken).decimals();
        return (pricefeedPrecision * _amount * yPrecision) / (_yieldPrice * uPrecision);
    }

    function _calculateYieldToUnderlyingAmount(
        uint256 _yieldPrice,
        uint256 _amount
    ) internal view virtual returns (uint256) {
        uint256 yPrecision = 10 ** IERC20Metadata(yieldToken).decimals();
        uint256 uPrecision = 10 ** IERC20Metadata(underlyingToken).decimals();
        return (_amount * _yieldPrice * uPrecision) / (pricefeedPrecision * yPrecision);
    }
}
