// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../../interfaces/IStrategyBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPoolingManagerMock {
    function withdraw(address strategy, uint256 amount) external;

    function initAllowance(address strategy, address underlying) external;

    function deposit(address strategy, uint256 amount) external;

    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);
}

contract PoolingManagerMock is IPoolingManagerMock {
    uint256 public lastNav;
    uint256 public lastWithdrawalAmount;
    address public owner;

    constructor() {
        owner = address(msg.sender);
    }

    function initAllowance(address strategy, address underlying) external {
        IERC20(underlying).approve(
            IStrategyBase(strategy).addressToApprove(),
            type(uint256).max
        );
    }

    function withdraw(address strategy, uint256 amount) external {
        (lastNav, lastWithdrawalAmount) = IStrategyBase(strategy).withdraw(
            amount
        );
    }

    function deposit(address strategy, uint256 amount) external {
        (address target, bytes memory depositCalldata) = IStrategyBase(strategy)
            .getDepositCalldata(amount);
        (bool success, ) = target.call(depositCalldata);
        if (success) {
            lastNav = IStrategyBase(strategy).nav();
            lastWithdrawalAmount = 0;
        } else {
            lastNav = 123467890;
            lastWithdrawalAmount = 123467890;
        }
    }

    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool) {
        if (owner == address(account)) {
            return (true);
        } else {
            return (false);
        }
    }
}
