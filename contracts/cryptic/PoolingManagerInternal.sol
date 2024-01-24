// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../PoolingManager.sol";

contract PoolingManagerInternal is PoolingManager {
    constructor() initializer {}

    function initialize(
        address _owner,
        uint256 _l2PoolingManager,
        address _starknetCore,
        address _relayer,
        address _ethBridge,
        address _ethWrapped
    ) public override initializer {
        PoolingManager.initialize(
            _owner,
            _l2PoolingManager,
            _starknetCore,
            _relayer,
            _ethBridge,
            _ethWrapped
        );
    }

    function _getMessagePayloadData(
        uint256 epoch,
        uint256 strategyReportL1Hash
    ) external pure returns (uint256[] memory) {
        return (getMessagePayloadData(epoch, strategyReportL1Hash));
    }

    function _addElements(StrategyReportL2[] memory elemArray) external {
        for (uint256 index = 0; index < elemArray.length; index++) {
            StrategyReportL2 memory elem = elemArray[index];
            pendingRequests.push(elem);
        }
    }

    function _deleteElement(
        uint256 index
    ) external returns (StrategyReportL2[] memory array) {
        deleteElement(PoolingManager.pendingRequests, index);
        return (PoolingManager.pendingRequests);
    }

    function _verifyCallData(
        uint256 epoch,
        BridgeInteractionInfo[] memory bridgeWithdrawInfo,
        StrategyReportL2[] memory strategyReportL2,
        BridgeInteractionInfo[] memory bridgeDepositInfo
    ) external {
        verifyCallData(
            epoch,
            bridgeWithdrawInfo,
            strategyReportL2,
            bridgeDepositInfo
        );
    }

    function _withdrawFromBridges(
        BridgeInteractionInfo[] memory bridgeWithdrawalInfo
    ) external {
        withdrawFromBridges(bridgeWithdrawalInfo);
    }

    function _depositToBridges(
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        uint256 l2BridgeEthFee,
        bool withdrawEth
    ) external {
        depositToBridges(bridgeDepositInfo, l2BridgeEthFee, withdrawEth);
    }

    function _processStrategyReports(
        StrategyReportL2[] memory strategyReportL2
    )
        external
        returns (
            uint256 strategyReportL1Length,
            StrategyReportL1[] memory strategyReportL1,
            uint256 tempBridgeLossLength,
            BridgeInteractionInfo[] memory tempBridgeLoss
        )
    {
        return (processStrategyReports(strategyReportL2));
    }

    function _processPendingRequests(
        uint256 strategyReportL1Length,
        StrategyReportL1[] memory strategyReportL1,
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        uint256 pendingRequestsExecutedLength
    )
        external
        returns (
            uint256,
            StrategyReportL1[] memory,
            BridgeInteractionInfo[] memory
        )
    {
        return (
            processPendingRequests(
                strategyReportL1Length,
                strategyReportL1,
                bridgeDepositInfo,
                pendingRequestsExecutedLength
            )
        );
    }

    function _mergeReportsAndUpdateDeposits(
        uint256 strategyReportL1Length,
        StrategyReportL1[] memory strategyReportL1,
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        uint256 pendingRequestsExecutedLength
    )
        external
        view
        returns (
            uint256 newStrategyReportL1Length,
            StrategyReportL1[] memory newStrategyReportL1,
            uint256 tempBridgeAdditionalDepositLength,
            BridgeInteractionInfo[] memory tempBridgeAdditionalDeposit
        )
    {
        return (
            mergeReportsAndUpdateDeposits(
                strategyReportL1Length,
                strategyReportL1,
                bridgeDepositInfo,
                pendingRequestsExecutedLength
            )
        );
    }

    function _processPendingRequest(
        uint256 i,
        uint256 strategyReportL1Length,
        StrategyReportL1[] memory newStrategyReportL1,
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        BridgeInteractionInfo[] memory tempBridgeAdditionalDeposit,
        uint256 tempBridgeAdditionalDepositLength
    ) external view returns (uint256) {
        return (
            processPendingRequest(
                i,
                strategyReportL1Length,
                newStrategyReportL1,
                bridgeDepositInfo,
                tempBridgeAdditionalDeposit,
                tempBridgeAdditionalDepositLength
            )
        );
    }

    function _updateBridgeDepositInfo(
        uint256 tempBridgeLossLength,
        BridgeInteractionInfo[] memory tempBridgeLoss,
        BridgeInteractionInfo[] memory bridgeDepositInfo
    ) external view returns (BridgeInteractionInfo[] memory) {
        updateBridgeDepositInfo(
            tempBridgeLossLength,
            tempBridgeLoss,
            bridgeDepositInfo
        );
        return (bridgeDepositInfo);
    }
}
