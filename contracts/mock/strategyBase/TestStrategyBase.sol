// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../../strategies/StrategyBase.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IERC20Extended is IERC20 {
    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;
}

contract TestStrategyBase is StrategyBase {
    uint256 private _yieldFactor;
    uint256 private constant PRECISION = 1e18;

    function initialize(
        address _poolingManager,
        address _underlyingTokenAddress,
        address _yieldTokenAddress
    ) external virtual initializer {
        _initializeStrategyBase(
            _poolingManager,
            _underlyingTokenAddress,
            _yieldTokenAddress
        );
    }

    function addressToApprove() external view override returns (address) {
        return (yieldToken);
    }

    function checkOwnerValidOrRevert() external view {
        _assertOnlyRoleOwner();
    }

    function checkPoolingManagerOrRevert() external view {
        _assertOnlyPoolingManager();
    }

    function getDepositCalldata(
        uint256 amount
    )
        external
        view
        override
        returns (address target, bytes memory depositCalldata)
    {
        depositCalldata = abi.encodeWithSignature(
            "deposit(uint256,address)",
            amount,
            address(this)
        );
        target = yieldToken;
    }

    function _withdraw(uint256 amount) internal override returns (uint256) {
        uint256 yieldAmountToDeposit = IERC4626(yieldToken).previewWithdraw(
            amount
        );
        uint256 strategyYieldBalance = _yieldBalance();
        if (yieldAmountToDeposit > strategyYieldBalance) {
            uint256 assets = IERC4626(yieldToken).redeem(
                strategyYieldBalance,
                poolingManager,
                address(this)
            );
            return (assets);
        } else {
            IERC4626(yieldToken).withdraw(
                amount,
                poolingManager,
                address(this)
            );
            return (amount);
        }
    }

    function _underlyingToYield(
        uint256 amount
    ) internal view override returns (uint256) {
        return IERC4626(yieldToken).previewDeposit(amount);
    }

    function _yieldToUnderlying(
        uint256 amount
    ) internal view override returns (uint256) {
        return IERC4626(yieldToken).previewRedeem(amount);
    }
}
