// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.20;

contract StarknetEthBridgeMock {
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    function deposit(uint256 amount, uint256) external payable {
        totalDeposited += amount;
    }

    function withdraw(uint256 amount, address recipient) external {
        payable(recipient).transfer(amount);
        totalWithdrawn += amount;
    }

    function depositCancelRequest(uint256 _amount, uint256 _l2Receiver, uint256 _nonce) external {}

    function depositReclaim(uint256 _amount, uint256, uint256) external {
        payable(msg.sender).transfer(_amount);
    }

    receive() external payable {}
}
