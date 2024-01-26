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

// L2 Request
uint256 constant DEPOSIT = 0;
uint256 constant REPORT = 1;
uint256 constant WITHDRAWAL = 2;

// L2 Handler
uint256 constant L2_HANDLER_SELECTOR = 0x10e13e50cb99b6b3c8270ec6e16acfccbe1164a629d74b43549567a77593aff;

// Roles
bytes32 constant OWNER_ROLE = keccak256("0x00");
bytes32 constant RELAYER_ROLE = keccak256("0x01");
bytes32 constant PAUSER_ROLE = keccak256("0x02");

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Pooling Manager Base Interface
 * @notice Defines the core functionalities for a pooling manager, including strategy registration, handling of deposits and withdrawals, and processing reports from L2.
 */
interface IPoolingManagerBase {
    // Events declaration
    event PendingRequestsExecuted(uint256 strategyReportsFailedLength);
    event ReportHandled(
        uint256 epoch,
        uint256 strategyReportL1Length,
        StrategyReport[] strategyReportL1
    );
    event StrategyRegistered(address strategy, StrategyInfo strategyInfo);

    /**
     * @notice Registers a new strategy in the Pooling Manager.
     * @param _strategy Address of the strategy contract.
     * @param _underlying Address of the underlying asset.
     * @param _bridge Address of the bridge contract.
     * @dev This function registers a new strategy and sets up necessary approvals. It can only be called by the owner of the contract.
     */
    function registerStrategy(
        address _strategy,
        address _underlying,
        address _bridge
    ) external payable;

    /**
     * @notice Executes pending requests for deposits and withdrawals.
     * @dev This function processes pending requests, handling them based on their type (deposit or withdrawal). It's an essential part of the pooling manager's functionality, enabling the management of pooled assets.
     */
    function executePendingRequests() external;

    /**
     * @notice Handles a report from the L2 side, processing bridge interactions and strategy reports.
     * @param epoch The epoch number for the report.
     * @param bridgeWithdrawInfo Array of bridge withdrawal information.
     * @param strategyReport Array of strategy reports from L2.
     * @param bridgeDepositInfo Array of bridge deposit information.
     * @param l2BridgeEthFee Fee for the L2 bridge in ETH.
     * @param l2MessagingEthFee Fee for L2 messaging in ETH.
     * @param minSuccessCall Minimum number of successful calls required.
     * @dev This function handles reports from L2, processing withdrawals and deposits, and sending messages back to L2. It can only be called by an account with the RELAYER_ROLE.
     */
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
