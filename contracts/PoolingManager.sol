// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ErrorLib} from "./lib/ErrorLib.sol";
import {Messaging} from "./lib/Messaging.sol";
import "./interfaces/IPoolingManager.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IStrategyBase} from "./interfaces/IStrategyBase.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract PoolingManager is
    IPoolingManager,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    Messaging
{
    uint256 public l2PoolingManager;
    mapping(address => StrategyInfo) public strategyInfo;
    uint256 public batchCounter;
    address public ethBridge;
    address public ethWrapped;
    StrategyReport[] public pendingRequests;
    StrategyReport[] public pendingRequestsExecuted;
    uint256 public pendingRequestsExecutedCounter;

    /**
     * @dev Receive Ether function
     */
    receive() external payable {}

    /**
     * @dev Fallback function
     */
    fallback() external payable {}

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /// @notice Initialier the contract state.
    /// @param _l2PoolingManager troveManager address
    /// @param _starknetCore starknetCore address
    /// @param _relayer relayer address
    function initialize(
        address _owner,
        uint256 _l2PoolingManager,
        address _starknetCore,
        address _relayer,
        address _ethBridge,
        address _ethWrapped
    ) public virtual initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        initializeMessaging(_starknetCore);
        l2PoolingManager = _l2PoolingManager;
        _grantRole(0, _owner);
        _grantRole(RELAYER_ROLE, _owner);
        _grantRole(RELAYER_ROLE, _relayer);
        ethBridge = _ethBridge;
        ethWrapped = _ethWrapped;
    }

    /// @notice Calculates the total ETH fees associated with bridge operations
    ///         when calling the handleReport function. This function helps to
    ///         determine the additional ETH fees needed for bridge interactions
    ///         that are not already accounted for in the `bridgeDepositInfo`.
    /// @dev Iterates through `pendingRequestsExecuted` and checks if each
    ///      request's bridge is not included in the `bridgeDepositInfo`.
    ///      For each such bridge, increments the accumulator. The final
    ///      return value is the sum of the length of `bridgeDepositInfo`
    ///      and the accumulator, representing the total count of unique bridge
    ///      interactions requiring ETH fees.
    /// @param bridgeDepositInfo Array of `BridgeInteractionInfo` representing
    ///        the bridge deposit information.
    /// @return The total count of bridge interactions (including those pending
    ///         execution) that will incur ETH fees.
    function bridgeEthFeesMultiplicator(
        BridgeInteractionInfo[] memory bridgeDepositInfo
    ) public view returns (uint256) {
        uint256 acc = 0;
        for (
            uint256 index1 = 0;
            index1 < pendingRequestsExecuted.length;
            index1++
        ) {
            StrategyReport
                memory pendingRequestsExecutedElem = pendingRequestsExecuted[
                    index1
                ];
            if (pendingRequestsExecutedElem.amount > 0) {
                bool found = false;
                for (
                    uint256 index2 = 0;
                    index2 < bridgeDepositInfo.length;
                    index2++
                ) {
                    BridgeInteractionInfo
                        memory bridgeDepositInfoElem = bridgeDepositInfo[
                            index2
                        ];
                    if (
                        bridgeDepositInfoElem.bridge ==
                        strategyInfo[pendingRequestsExecutedElem.l1Strategy]
                            .bridge
                    ) {
                        found = true;
                    }
                }
                if (!found) {
                    acc++;
                }
            }
        }
        return (bridgeDepositInfo.length + acc);
    }

    /// @notice Registers a new strategy in the contract.
    /// @dev This function registers a strategy by updating the `strategyInfo` mapping.
    ///      It requires the caller to have the `OWNER_ROLE` and performs several checks to
    ///      ensure valid addresses and compatibility with the strategy interface.
    ///      It sets maximum approval for the underlying token on both the bridge and the
    ///      strategy's approval address. Emits a `StrategyRegistered` event upon successful
    ///      registration.
    /// @param _strategy The address of the strategy contract to be registered.
    /// @param _underlying The address of the underlying token for the strategy.
    /// @param _bridge The address of the bridge contract associated with the strategy.
    /// @custom:revert ZeroAddress If any of the addresses (_strategy, _underlying, or _bridge) is zero.
    /// @custom:revert InvalidPoolingManager If the pooling manager of the strategy does not match the contract.
    /// @custom:revert InvalidUnderlyingToken If the underlying token of the strategy does not match the provided token.
    function registerStrategy(
        address _strategy,
        address _underlying,
        address _bridge
    ) public payable onlyRole(OWNER_ROLE) {
        if (_underlying == address(0)) revert ErrorLib.ZeroAddress();
        if (_bridge == address(0)) revert ErrorLib.ZeroAddress();
        if (_strategy == address(0)) revert ErrorLib.ZeroAddress();

        if (IStrategyBase(_strategy).poolingManager() != address(this))
            revert ErrorLib.InvalidPoolingManager();

        if (IStrategyBase(_strategy).underlyingToken() != _underlying)
            revert ErrorLib.InvalidUnderlyingToken();

        StrategyInfo memory newStrategyInfo = StrategyInfo({
            underlying: _underlying,
            bridge: _bridge
        });
        strategyInfo[_strategy] = newStrategyInfo;

        IERC20(_underlying).approve(_bridge, type(uint256).max);
        IERC20(_underlying).approve(
            IStrategyBase(_strategy).addressToApprove(),
            type(uint256).max
        );
        emit StrategyRegistered(_strategy, newStrategyInfo);
    }

    /// @notice Cancels a deposit request to the bridge.
    /// @dev Calls `depositCancelRequestToBridgeToken` to cancel the deposit request.
    ///      Only callable by the owner. Emits a `CancelDepositRequestBridgeSent` event.
    /// @param l1BridgeAddress The address of the L1 bridge.
    /// @param amount The amount of tokens to cancel the deposit request for.
    /// @param nonce The nonce associated with the deposit request.
    function cancelDepositRequestBridge(
        address l1BridgeAddress,
        uint256 amount,
        uint256 nonce
    ) public onlyRole(OWNER_ROLE) {
        depositCancelRequestToBridgeToken(
            l1BridgeAddress,
            l2PoolingManager,
            amount,
            nonce
        );
        emit CancelDepositRequestBridgeSent(l1BridgeAddress, amount, nonce);
    }

    /// @notice Claims a cancelled deposit request and send the specified amount
    ///         to the owner. This function is only accessible by an account with
    ///         the OWNER_ROLE.
    /// @dev This function first calls `depositReclaimToBridgeToken` to handle the
    ///      reclaimed deposit, then send the received amount to the owner.
    ///      Finally, it emits the `BridgeCancelDepositRequestClaimedAndDeposited` event.
    /// @param l1BridgeAddress The address of the L1 bridge contract.
    /// @param amount The amount of tokens to claim and deposit.
    /// @param nonce The nonce associated with the deposit request.
    function claimBridgeCancelDepositRequestAndDeposit(
        address l1BridgeAddress,
        address tokenAddress,
        uint256 amount,
        uint256 nonce,
    ) public payable onlyRole(OWNER_ROLE) {
        depositReclaimToBridgeToken(
            l1BridgeAddress,
            l2PoolingManager,
            amount,
            nonce
        );
        IERC20(tokenAddress).transfer(msg.sender, amount)
        
        emit BridgeCancelDepositRequestClaimed(
            l1BridgeAddress,
            amount,
            nonce
        );
    }

    function pause() external onlyRole(RELAYER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    function executePendingRequests() public onlyRole(RELAYER_ROLE) {
        uint256[] memory indicesToDelete = new uint256[](
            pendingRequests.length
        );
        uint256 indicesToDeleteLength = 0;
        for (uint256 index = 0; index < pendingRequests.length; index++) {
            StrategyReport memory currentReport = pendingRequests[index];
            if (currentReport.data1 == DEPOSIT) {
                (address target, bytes memory depositCalldata) = IStrategyBase(
                    currentReport.l1Strategy
                ).getDepositCalldata(currentReport.amount);
                (bool success, ) = target.call(depositCalldata);
                if (success) {
                    try IStrategyBase(currentReport.l1Strategy).nav() returns (
                        uint256 l1Nav
                    ) {
                        indicesToDeleteLength = _handleSuccessfulPendingRequest(
                            index,
                            indicesToDeleteLength,
                            indicesToDelete,
                            currentReport.l1Strategy,
                            l1Nav,
                            0
                        );
                    } catch {
                        pendingRequests[index] = StrategyReport({
                            l1Strategy: currentReport.l1Strategy,
                            data1: REPORT,
                            amount: 0
                        });
                    }
                }
            } else {
                if (currentReport.data1 == WITHDRAW) {
                    try
                        IStrategyBase(currentReport.l1Strategy).withdraw(
                            currentReport.amount
                        )
                    returns (uint256 l1Nav, uint256 amount) {
                        indicesToDeleteLength = _handleSuccessfulPendingRequest(
                            index,
                            indicesToDeleteLength,
                            indicesToDelete,
                            currentReport.l1Strategy,
                            l1Nav,
                            amount
                        );
                    } catch {}
                } else {
                    try IStrategyBase(currentReport.l1Strategy).nav() returns (
                        uint256 l1Nav
                    ) {
                        indicesToDeleteLength = _handleSuccessfulPendingRequest(
                            index,
                            indicesToDeleteLength,
                            indicesToDelete,
                            currentReport.l1Strategy,
                            l1Nav,
                            0
                        );
                    } catch {}
                }
            }
        }

        for (uint256 i = indicesToDeleteLength; i > 0; i--) {
            _deleteElement(pendingRequests, indicesToDelete[i - 1]);
        }
        emit PendingRequestsExecuted(indicesToDelete);
    }

    function handleReport(
        uint256 epoch,
        BridgeInteractionInfo[] memory bridgeWithdrawInfo,
        StrategyReport[] memory strategyReport,
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        uint256 l2BridgeEthFee,
        uint256 l2MessagingEthFee,
        uint256 minSuccessCall
    ) public payable onlyRole(RELAYER_ROLE) whenNotPaused {
        _consumeL2Message(
            l2PoolingManager,
            _getMessagePayloadData(
                0,
                _hashFromReport(
                    epoch,
                    bridgeWithdrawInfo,
                    strategyReport.length,
                    strategyReport,
                    bridgeDepositInfo
                )
            )
        );
        _withdrawFromBridges(bridgeWithdrawInfo);
        (
            uint256 strategyReportL1Length,
            StrategyReport[] memory strategyReportL1,
            BridgeInteractionInfo[] memory newBridgeDepositInfo
        ) = _addPendingExecutedRequests(
                _handleStrategyReportL2(strategyReport, bridgeDepositInfo),
                strategyReport,
                bridgeDepositInfo
            );
        if (minSuccessCall == 0 || minSuccessCall > strategyReportL1Length)
            revert ErrorLib.NotEnoughSuccessCalls();
        _depositToBridges(newBridgeDepositInfo, l2BridgeEthFee, true);
        BridgeInteractionInfo[]
            memory emptyBridgeInfo = new BridgeInteractionInfo[](0);
        _sendMessageToL2(
            l2PoolingManager,
            L2_HANDLER_SELECTOR,
            _getMessagePayloadData(
                epoch,
                _hashFromReport(
                    0,
                    emptyBridgeInfo,
                    strategyReportL1Length,
                    strategyReportL1,
                    emptyBridgeInfo
                )
            ),
            l2MessagingEthFee
        );
        emit ReportHandled(epoch, strategyReportL1Length, strategyReportL1);
    }

    function _deleteElement(
        StrategyReport[] storage array,
        uint256 index
    ) internal {
        require(index < array.length, "Index out of bounds");
        array[index] = array[array.length - 1];
        array.pop();
    }

    function _withdrawFromBridges(
        BridgeInteractionInfo[] memory bridgeWithdrawalInfo
    ) internal {
        for (uint256 index = 0; index < bridgeWithdrawalInfo.length; index++) {
            _withdrawTokenFromBridge(
                bridgeWithdrawalInfo[index].bridge,
                address(this),
                bridgeWithdrawalInfo[index].amount
            );
            if (bridgeWithdrawalInfo[index].bridge == ethBridge) {
                IWETH(ethWrapped).deposit{
                    value: bridgeWithdrawalInfo[index].amount
                }();
            }
        }
    }

    function _depositToBridges(
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        uint256 l2BridgeEthFee,
        bool withdrawEth
    ) internal {
        for (uint256 index = 0; index < bridgeDepositInfo.length; index++) {
            BridgeInteractionInfo
                memory bridgeInteractionInfoElem = bridgeDepositInfo[index];
            if (bridgeInteractionInfoElem.bridge == ethBridge) {
                if (withdrawEth) {
                    IWETH(ethWrapped).withdraw(
                        bridgeInteractionInfoElem.amount
                    );
                }
                depositToBridgeToken(
                    bridgeInteractionInfoElem.bridge,
                    l2PoolingManager,
                    bridgeInteractionInfoElem.amount,
                    bridgeInteractionInfoElem.amount + l2BridgeEthFee
                );
            } else {
                depositToBridgeToken(
                    bridgeInteractionInfoElem.bridge,
                    l2PoolingManager,
                    bridgeInteractionInfoElem.amount,
                    l2BridgeEthFee
                );
            }
        }
    }

    function _handleStrategyReportL2(
        StrategyReport[] memory strategyReport,
        BridgeInteractionInfo[] memory bridgeDepositInfo
    ) internal returns (uint256 strategyReportL1Length) {
        BridgeInteractionInfo[]
            memory tempBridgeLoss = new BridgeInteractionInfo[](
                strategyReport.length
            );
        uint256 tempBridgeLossLength;

        for (uint256 i = 0; i < strategyReport.length; i++) {
            StrategyReport memory currentReport = strategyReport[i];
            address currentStrategyBridge = strategyInfo[
                currentReport.l1Strategy
            ].bridge;

            if (currentReport.data1 == 0) {
                (address target, bytes memory depositCalldata) = IStrategyBase(
                    currentReport.l1Strategy
                ).getDepositCalldata(currentReport.amount);
                (bool success, ) = target.call(depositCalldata);
                if (success) {
                    try IStrategyBase(currentReport.l1Strategy).nav() returns (
                        uint256 l1Nav
                    ) {
                        strategyReportL1Length = _handleSuccessCall(
                            strategyReportL1Length,
                            strategyReport,
                            currentReport.l1Strategy,
                            l1Nav,
                            0
                        );
                    } catch {
                        // The Deposit is success and the nav call failed
                        StrategyReport
                            memory newCurrentReport = StrategyReport({
                                l1Strategy: currentReport.l1Strategy,
                                data1: REPORT,
                                amount: 0
                            });
                        tempBridgeLossLength = _handleFailCall(
                            newCurrentReport,
                            currentStrategyBridge,
                            tempBridgeLoss,
                            tempBridgeLossLength
                        );
                    }
                } else {
                    tempBridgeLossLength = _handleFailCall(
                        currentReport,
                        currentStrategyBridge,
                        tempBridgeLoss,
                        tempBridgeLossLength
                    );
                }
            } else {
                if (currentReport.data1 == 2) {
                    try
                        IStrategyBase(currentReport.l1Strategy).withdraw(
                            currentReport.amount
                        )
                    returns (uint256 l1Nav, uint256 amount) {
                        strategyReportL1Length = _handleSuccessCall(
                            strategyReportL1Length,
                            strategyReport,
                            currentReport.l1Strategy,
                            l1Nav,
                            amount
                        );

                        if (amount != currentReport.amount) {
                            tempBridgeLoss[
                                tempBridgeLossLength
                            ] = BridgeInteractionInfo({
                                bridge: currentStrategyBridge,
                                amount: currentReport.amount - amount
                            });
                            tempBridgeLossLength++;
                        }
                    } catch {
                        tempBridgeLossLength = _handleFailCall(
                            currentReport,
                            currentStrategyBridge,
                            tempBridgeLoss,
                            tempBridgeLossLength
                        );
                    }
                } else {
                    try IStrategyBase(currentReport.l1Strategy).nav() returns (
                        uint256 l1Nav
                    ) {
                        strategyReportL1Length = _handleSuccessCall(
                            strategyReportL1Length,
                            strategyReport,
                            currentReport.l1Strategy,
                            l1Nav,
                            0
                        );
                    } catch {
                        tempBridgeLossLength = _handleFailCall(
                            currentReport,
                            currentStrategyBridge,
                            tempBridgeLoss,
                            tempBridgeLossLength
                        );
                    }
                }
            }
        }

        _updateDepositsAfterLosses(
            tempBridgeLossLength,
            tempBridgeLoss,
            bridgeDepositInfo
        );

        return (strategyReportL1Length);
    }

    function _handleSuccessCall(
        uint256 strategyReportL1Length,
        StrategyReport[] memory strategyReport,
        address l1Strategy,
        uint256 l1Nav,
        uint256 amount
    ) internal pure returns (uint256) {
        strategyReport[strategyReportL1Length] = StrategyReport({
            l1Strategy: l1Strategy,
            data1: l1Nav,
            amount: amount
        });
        return strategyReportL1Length + 1;
    }

    function _handleFailCall(
        StrategyReport memory currentReport,
        address currentStrategyBridge,
        BridgeInteractionInfo[] memory tempBridgeLoss,
        uint256 tempBridgeLossLength
    ) internal returns (uint256) {
        pendingRequests.push(currentReport);
        tempBridgeLoss[tempBridgeLossLength] = BridgeInteractionInfo({
            bridge: currentStrategyBridge,
            amount: currentReport.amount
        });
        return tempBridgeLossLength + 1;
    }

    function _updateDepositsAfterLosses(
        uint256 tempBridgeLossLength,
        BridgeInteractionInfo[] memory tempBridgeLoss,
        BridgeInteractionInfo[] memory bridgeDepositInfo
    ) internal pure {
        for (uint256 index1 = 0; index1 < tempBridgeLossLength; index1++) {
            BridgeInteractionInfo memory tempBridgeLossElem = tempBridgeLoss[
                index1
            ];
            for (
                uint256 index2 = 0;
                index2 < bridgeDepositInfo.length;
                index2++
            ) {
                if (
                    tempBridgeLossElem.bridge ==
                    bridgeDepositInfo[index2].bridge
                ) {
                    bridgeDepositInfo[index2].amount -= tempBridgeLossElem
                        .amount;
                    break;
                }
            }
        }
    }

    function _addPendingExecutedRequests(
        uint256 strategyReportL1Length,
        StrategyReport[] memory strategyReportL1,
        BridgeInteractionInfo[] memory bridgeDepositInfo
    )
        internal
        returns (
            uint256 newStrategyReportL1Length,
            StrategyReport[] memory newStrategyReportL1,
            BridgeInteractionInfo[] memory newBridgeDepositInfo
        )
    {
        uint256 pendingRequestsExecutedLength = pendingRequestsExecuted.length -
            pendingRequestsExecutedCounter;

        if (pendingRequestsExecutedLength > 0) {
            newStrategyReportL1Length =
                strategyReportL1Length +
                pendingRequestsExecutedLength;
            newStrategyReportL1 = new StrategyReport[](
                newStrategyReportL1Length
            );
            uint256 tempBridgeAdditionalDepositLength;
            BridgeInteractionInfo[]
                memory tempBridgeAdditionalDeposit = new BridgeInteractionInfo[](
                    pendingRequestsExecutedLength
                );

            for (uint256 i = 0; i < newStrategyReportL1Length; i++) {
                if (i < strategyReportL1Length) {
                    newStrategyReportL1[i] = strategyReportL1[i];
                } else {
                    StrategyReport
                        memory pendingRequestExecutedElem = pendingRequestsExecuted[
                            i - strategyReportL1Length
                        ];
                    newStrategyReportL1[i] = pendingRequestExecutedElem;
                    tempBridgeAdditionalDepositLength = _updateOrEnqueuBridgeDepositInfoElem(
                        strategyInfo[pendingRequestExecutedElem.l1Strategy]
                            .bridge,
                        pendingRequestExecutedElem.amount,
                        bridgeDepositInfo,
                        tempBridgeAdditionalDeposit,
                        tempBridgeAdditionalDepositLength
                    );
                }
            }
            pendingRequestsExecutedCounter = pendingRequestsExecuted.length;
            if (tempBridgeAdditionalDepositLength > 0) {
                uint256 totalLen = tempBridgeAdditionalDepositLength +
                    bridgeDepositInfo.length;

                newBridgeDepositInfo = new BridgeInteractionInfo[](totalLen);
                for (uint256 i = 0; i < totalLen; i++) {
                    if (i < bridgeDepositInfo.length) {
                        newBridgeDepositInfo[i] = bridgeDepositInfo[i];
                    } else {
                        newBridgeDepositInfo[i] = tempBridgeAdditionalDeposit[
                            i - bridgeDepositInfo.length
                        ];
                    }
                }
            } else {
                newBridgeDepositInfo = bridgeDepositInfo;
            }
        } else {
            newStrategyReportL1Length = strategyReportL1Length;
            newStrategyReportL1 = strategyReportL1;
            newBridgeDepositInfo = bridgeDepositInfo;
        }
    }

    function _updateOrEnqueuBridgeDepositInfoElem(
        address bridge,
        uint256 amount,
        BridgeInteractionInfo[] memory bridgeDepositInfo,
        BridgeInteractionInfo[] memory tempBridgeAdditionalDeposit,
        uint256 tempBridgeAdditionalDepositLength
    ) internal pure returns (uint256) {
        if (amount > 0) {
            bool found = false;
            for (uint256 index = 0; index < bridgeDepositInfo.length; index++) {
                if (bridgeDepositInfo[index].bridge == bridge) {
                    bridgeDepositInfo[index].amount += amount;
                    found = true;
                    break;
                }
            }
            if (!found) {
                tempBridgeAdditionalDeposit[
                    tempBridgeAdditionalDepositLength
                ] = BridgeInteractionInfo({bridge: bridge, amount: amount});
                tempBridgeAdditionalDepositLength++;
            }
        }
        return tempBridgeAdditionalDepositLength;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(OWNER_ROLE) {}

    function _hashFromReport(
        uint256 epoch,
        BridgeInteractionInfo[] memory bridgeWithdrawInfo,
        uint256 strategyReportLength,
        StrategyReport[] memory strategyReport,
        BridgeInteractionInfo[] memory bridgeDepositInfo
    ) internal pure returns (uint256) {
        bytes memory encodedData;
        if (epoch != 0) {
            encodedData = abi.encodePacked(epoch);
        } else {
            encodedData = abi.encodePacked();
        }
        for (uint i = 0; i < bridgeWithdrawInfo.length; i++) {
            encodedData = abi.encodePacked(
                encodedData,
                uint256(uint160(bridgeWithdrawInfo[i].bridge)),
                bridgeWithdrawInfo[i].amount
            );
        }
        for (uint i = 0; i < strategyReportLength; i++) {
            encodedData = abi.encodePacked(
                encodedData,
                uint256(uint160(strategyReport[i].l1Strategy)),
                strategyReport[i].data1,
                strategyReport[i].amount
            );
        }
        for (uint i = 0; i < bridgeDepositInfo.length; i++) {
            encodedData = abi.encodePacked(
                encodedData,
                uint256(uint160(bridgeDepositInfo[i].bridge)),
                bridgeDepositInfo[i].amount
            );
        }
        return uint256(keccak256(encodedData));
    }

    function _getMessagePayloadData(
        uint256 epoch,
        uint256 dataHash
    ) internal pure returns (uint256[] memory) {
        uint256[] memory data;
        (uint256 lowHash, uint256 highHash) = u256(dataHash);
        if (epoch == 0) {
            data = new uint256[](2);
            data[0] = lowHash;
            data[1] = highHash;
        } else {
            (uint256 lowEpoch, uint256 highEpoch) = u256(epoch);
            data = new uint256[](4);
            data[0] = lowEpoch;
            data[1] = highEpoch;
            data[2] = lowHash;
            data[3] = highHash;
        }
        return (data);
    }

    function _handleSuccessfulPendingRequest(
        uint256 index,
        uint256 indicesToDeleteLength,
        uint256[] memory indicesToDelete,
        address l1Strategy,
        uint256 l1Nav,
        uint256 amount
    ) internal returns (uint256 newIndicesToDeleteLength) {
        indicesToDelete[indicesToDeleteLength] = index;
        indicesToDeleteLength++;
        pendingRequestsExecuted.push(
            StrategyReport({
                l1Strategy: l1Strategy,
                data1: l1Nav,
                amount: amount
            })
        );
        newIndicesToDeleteLength = indicesToDeleteLength + 1;
    }
}
