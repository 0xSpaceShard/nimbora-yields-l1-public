// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StrategyBase} from "./StrategyBase.sol";
import {ErrorLib} from "../lib/ErrorLib.sol";

/// @title Saving Dai
/// @author @nimbora 2024
contract TemplateStrategy is StrategyBase {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _poolingManager,
        address _underlyingToken,
        address _yieldToken,
        address _bridge
    ) external initializer {
        _strategyBase__init(_poolingManager, _underlyingToken, _yieldToken, _bridge);
    }

    /// @inheritdoc	StrategyBase
    function addressToApprove() external view override returns (address) {
        return (yieldToken);
    }

    /// @inheritdoc	StrategyBase
    function depositCalldata(uint256 _amount) external view override returns (address target, bytes memory cdata) {
        // deposit logic
    }

    /// @inheritdoc	StrategyBase
    function _withdraw(uint256 _amount) internal override returns (uint256) {
        // Withdraw logic
    }

    /// @inheritdoc	StrategyBase
    function _underlyingToYield(uint256 _amount) internal view override returns (uint256) {
        // deposit logic
        return _amount;
    }

    /// @inheritdoc	StrategyBase
    function _yieldToUnderlying(uint256 _amount) internal view override returns (uint256) {
        return _amount;
    }
}
