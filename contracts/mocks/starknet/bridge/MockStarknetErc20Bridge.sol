// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StarknetErc20BridgeMock {
    IERC20 public underlying;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    constructor(IERC20 _underlying) {
        underlying = _underlying;
    }

    function deposit(uint256 _amount, uint256) external payable {
        underlying.transferFrom(msg.sender, address(this), _amount);
        totalDeposited += _amount;
    }

    function withdraw(uint256 amount, address recipient) external {
        underlying.transfer(recipient, amount);
        totalWithdrawn += amount;
    }

    function depositCancelRequest(uint256 _amount, uint256 _l2Receiver, uint256 _nonce) external {}

    function depositReclaim(uint256 _amount, uint256 _l2Receiver, uint256 _nonce) external {
        underlying.transfer(msg.sender, _amount);
    }

    receive() external payable {}
}
