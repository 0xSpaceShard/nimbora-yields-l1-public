// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct StrategyInfo {
    address underlying;
    address bridge;
}

struct BridgeInteractionInfo {
    address bridge;
    uint256 amount;
}

struct StrategyReport {
    address l1Strategy;
    uint256 data1; // Can represent l1Nav or actionId
    uint256 amount;
}

uint256 constant DEPOSIT = 0;
uint256 constant REPORT = 1;
uint256 constant WITHDRAW = 2;
uint256 constant L2_HANDLER_SELECTOR = 0x10e13e50cb99b6b3c8270ec6e16acfccbe1164a629d74b43549567a77593aff;

bytes32 constant OWNER_ROLE = keccak256("0x00");
bytes32 constant RELAYER_ROLE = keccak256("0x01");

interface IPoolingManager {
    // Events
    event PendingRequestsExecuted(uint256[] indices);
    event MessageResentToL2();
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
    event ReportHandled(
        uint256 epoch,
        uint256 strategyReportL1Length,
        StrategyReport[] strategyReportL1
    );
    event StrategyRegistered(address strategy, StrategyInfo strategyInfo);

    // Functions
    function initialize(
        address _owner,
        uint256 _l2PoolingManager,
        address _starknetCore,
        address _relayer,
        address _ethBridge,
        address _ethWrapped
    ) external;

    function bridgeEthFeesMultiplicator(
        BridgeInteractionInfo[] calldata bridgeDepositInfo
    ) external view returns (uint256);

    function registerStrategy(
        address _strategy,
        address _underlying,
        address _bridge
    ) external payable;

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

    function executePendingRequests() external;

    function handleReport(
        uint256 epoch,
        BridgeInteractionInfo[] memory bridgeWithdrawInfo,
        StrategyReport[] memory strategyReportL2,
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        uint256 l2BridgeEthFee,
        uint256 l2MessagingEthFee,
        uint256 minSuccessCall
    ) external payable;
}
