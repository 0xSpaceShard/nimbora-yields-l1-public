// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.20;

contract StarknetEthBridgeMock {
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    function deposit(uint256 amount, uint256 l2Recipient) external payable {
        totalDeposited += amount;
    }

    function withdraw(uint256 amount, address recipient) external {
        payable(recipient).transfer(amount);
        totalWithdrawn += amount;
    }

    receive() external payable {}
}
