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

struct StrategyReportAndId {
    StrategyReport strategyReport;
    uint256 index;
}

uint256 constant DEPOSIT = 0;
uint256 constant REPORT = 1;
uint256 constant WITHDRAWAL = 2;
uint256 constant L2_HANDLER_SELECTOR = 0x10e13e50cb99b6b3c8270ec6e16acfccbe1164a629d74b43549567a77593aff;

bytes32 constant OWNER_ROLE = keccak256("0x00");
bytes32 constant RELAYER_ROLE = keccak256("0x01");
bytes32 constant PAUSER_ROLE = keccak256("0x02");

interface IPoolingManagerBase {
    // Events
    event PendingRequestsExecuted(uint256 strategyReportsFailedLength);
    event ReportHandled(
        uint256 epoch,
        uint256 strategyReportL1Length,
        StrategyReport[] strategyReportL1
    );
    event StrategyRegistered(address strategy, StrategyInfo strategyInfo);

    function bridgeEthFeesMultiplicator(
        BridgeInteractionInfo[] calldata bridgeDepositInfo
    ) external view returns (uint256);

    function registerStrategy(
        address _strategy,
        address _underlying,
        address _bridge
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
