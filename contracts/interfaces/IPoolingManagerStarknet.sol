// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoolingManagerStarknet {
    // Events
    event BridgeCancelDepositRequestClaimed(
        address l1BridgeAddress,
        uint256 amount,
        uint256 nonce
    );
    event CancelDepositRequestBridgeSent(
        address l1BridgeAddress,
        uint256 amount,
        uint256 nonce
    );

    // Functions
    function initialize(
        address _owner,
        uint256 _l2PoolingManager,
        address _starknetCore,
        address _relayer,
        address _ethBridge,
        address _ethWrapped
    ) external;

    function cancelDepositRequestBridge(
        address l1BridgeAddress,
        uint256 amount,
        uint256 nonce
    ) external;

    function claimBridgeCancelDepositRequestAndDeposit(
        address l1BridgeAddress,
        uint256 amount,
        uint256 nonce,
        uint256 l2BridgeEthFee
    ) external payable;
}
