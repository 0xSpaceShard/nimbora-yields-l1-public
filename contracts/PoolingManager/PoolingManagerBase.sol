// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ErrorLib} from "../lib/ErrorLib.sol";
import {IStrategyBase} from "../interfaces/IStrategyBase.sol";
import {IWETH} from "../interfaces/IWETH.sol";

/// @title The PoolingManagerBase
/// @author @nimbora 2024
abstract contract PoolingManagerBase is UUPSUpgradeable, AccessControlUpgradeable {
    /// @notice The startegy action.
    enum Action {
        DEPOSIT,
        UPDATE,
        WITHDRAW
    }

    /// @notice The bridge data used to interact with L2 bridges.
    /// @param bridge the bridge address
    /// @param amount the bridge address
    struct BridgeData {
        address bridge;
        uint256 amount;
    }

    /// @notice The bridge data used to interact with L2 bridges.
    /// @param l1Strategy the strategy address.
    /// @param data the data, it can be l1 net asset value (nav) or the action.
    /// @param amount the amount to deposit/withdraw from the strategy.
    /// @param processed return the status of the strategy if it was processed on L1 or not.
    struct StrategyReport {
        address l1Strategy;
        uint256 data;
        uint256 amount;
        bool processed;
    }

    /// @notice Emitted when a report is handled.
    /// @param epoch the report epoch.
    /// @param reports the list of  strategies updated.
    event ReportHandled(uint256 epoch, StrategyReport[] reports);

    /// @notice Emitted when a strategy is registred.
    /// @param strategy the strategy address.
    event StrategyRegistered(address strategy);

    /// @notice Relayer role.
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    /// @notice ethBridge address.
    address public ethBridge;

    /// @notice wETH address.
    address public wETH;

    /// @notice Initialize the base pooling manager.
    /// @param _admin the admin address.
    /// @param _relayer the relayer address.
    /// @param _ethBridge the eth bridge address.
    function __poolingManagerBase_init(
        address _admin,
        address _relayer,
        address _ethBridge,
        address _wETH
    ) internal initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RELAYER_ROLE, _relayer);
        ethBridge = _ethBridge;
        wETH = _wETH;
    }

    /// @dev Verifies the L2 calldata hash to ensure it matches the expected value. This is a security measure to ensure data integrity between L1 and L2.
    function _verifyL2Calldata(uint256 _dataHash) internal virtual;

    /// @dev Sends a message to L2, including necessary data and fees. This function is part of the cross-layer communication process.
    function _sendMessageL2(uint256 _epoch, uint256 _dataHash, uint256 _fees) internal virtual;

    /// @dev Withdraws a specified token amount from a given bridge. This is a lower-level function used by '_withdrawFromBridges'.
    function _withdrawTokenFromBridgeL2(address _bridge, uint256 _amount) internal virtual;

    /// @dev Deposits a specified token amount to a given bridge, including the handling of Ether conversions if necessary.
    function _depositTokenToBridgeL2(address _bridge, uint256 _amount, uint256 _value) internal virtual;

    /// @dev Authorizes an upgrade to a new contract implementation, ensuring that only an authorized role can perform the upgrade.
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice List a new strategy.
    /// @param _strategy the strategy address.
    function registerStrategy(address _strategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IStrategyBase strategy = IStrategyBase(_strategy);
        if (strategy.poolingManager() != address(this)) revert ErrorLib.InvalidPoolingManager();
        address underlying = IStrategyBase(_strategy).underlyingToken();
        IERC20(underlying).approve(strategy.bridge(), type(uint256).max);
        IERC20(underlying).approve(strategy.addressToApprove(), type(uint256).max);
        emit StrategyRegistered(_strategy);
    }

    /// @notice Handle a report.
    /// @param _epoch the epoch of the report.
    /// @param _bridgeWithdrawInfo a list of {bridgeAddress,amount} to withdraw from the bridges.
    /// @param _strategyReport the strategy to apply, can be DEPOSIT, WITHDRAW, UPDATE.
    /// @param _bridgeDepositInfo a list of {bridgeAddress,amount} to deposit into the bridges, those values are computed on L2.
    /// @param _l2BridgeEthFee the fees to pay for briding tokens to L2.
    /// @param _l2MessagingEthFee the fees to pay for briding message to L2.
    function handleReport(
        uint256 _epoch,
        BridgeData[] memory _bridgeWithdrawInfo,
        StrategyReport[] memory _strategyReport,
        BridgeData[] memory _bridgeDepositInfo,
        uint256 _l2BridgeEthFee,
        uint256 _l2MessagingEthFee
    ) external payable onlyRole(RELAYER_ROLE) returns (bool) {
        _verifyL2Calldata(hashFromReport(_epoch, _bridgeWithdrawInfo, _strategyReport, _bridgeDepositInfo, false));
        _withdrawFromBridges(_bridgeWithdrawInfo);
        bool processed = _handleReport(_strategyReport, _bridgeDepositInfo);
        _depositToBridges(_bridgeDepositInfo, _l2BridgeEthFee);
        BridgeData[] memory emptyBridgeInfo = new BridgeData[](0);
        _sendMessageL2(
            _epoch,
            hashFromReport(0, emptyBridgeInfo, _strategyReport, emptyBridgeInfo, true),
            _l2MessagingEthFee
        );
        emit ReportHandled(_epoch, _strategyReport);
        return processed;
    }

    /// @dev Handles the withdrawal of funds from various bridges. It iterates over bridge withdrawal info and performs each withdrawal.
    function _withdrawFromBridges(BridgeData[] memory _bridgeWithdrawalInfo) internal {
        for (uint256 i = 0; i < _bridgeWithdrawalInfo.length; ) {
            _withdrawTokenFromBridgeL2(_bridgeWithdrawalInfo[i].bridge, _bridgeWithdrawalInfo[i].amount);
            if (_bridgeWithdrawalInfo[i].bridge == ethBridge) {
                IWETH(wETH).deposit{value: _bridgeWithdrawalInfo[i].amount}();
            }
            unchecked {
                i++;
            }
        }
    }

    /// @dev Deposits funds to bridges as part of the bridging process. This function handles both Ether and token deposits.
    function _depositToBridges(BridgeData[] memory _bridgeDepositInfo, uint256 _l2BridgeEthFee) internal {
        for (uint256 i = 0; i < _bridgeDepositInfo.length; ) {
            BridgeData memory BridgeDataElem = _bridgeDepositInfo[i];
            bool isETH = BridgeDataElem.bridge == ethBridge;
            if (isETH) {
                IWETH(wETH).withdraw(BridgeDataElem.amount);
            }
            uint256 value = isETH ? BridgeDataElem.amount + _l2BridgeEthFee : _l2BridgeEthFee;
            _depositTokenToBridgeL2(BridgeDataElem.bridge, BridgeDataElem.amount, value);
            unchecked {
                i++;
            }
        }
    }

    /// @dev Process strategy reports from L2, handling each report based on its type (deposit, withdrawal, etc.) and updates the state accordingly.
    function _handleReport(StrategyReport[] memory _report, BridgeData[] memory _bridgeData) private returns (bool) {
        bool allStrategiesProcessed = true;
        for (uint256 i = 0; i < _report.length; ) {
            StrategyReport memory strategyReport = _report[i];
            address strategy = strategyReport.l1Strategy;
            uint256 action = strategyReport.data;
            uint256 amountIn = strategyReport.amount;

            IStrategyBase l1Strategy = IStrategyBase(strategy);
            uint256 amount = 0;
            bool processed = true;
            if (action == uint256(Action.DEPOSIT)) {
                (address target, bytes memory cdata) = l1Strategy.depositCalldata(amountIn);
                (bool success, ) = target.call(cdata);
                if (!success) {
                    processed = false;
                    allStrategiesProcessed = false;
                }
            } else if (action == uint256(Action.WITHDRAW)) {
                try l1Strategy.withdraw(amountIn) returns (uint256 amountw) {
                    amount = amountw;
                    if (amount != amountIn) {
                        _updateBridgeDeposits(amountIn - amount, l1Strategy.bridge(), _bridgeData);
                    }
                } catch {
                    processed = false;
                    allStrategiesProcessed = false;
                    _updateBridgeDeposits(amountIn, l1Strategy.bridge(), _bridgeData);
                }
            }

            _report[i] = StrategyReport({
                l1Strategy: address(l1Strategy),
                data: l1Strategy.nav(),
                amount: amount,
                processed: processed
            });

            unchecked {
                i++;
            }
        }
        return allStrategiesProcessed;
    }

    /// @dev When the output amount returned by a strategy is not the expected value, the bridged amount is updated.
    function _updateBridgeDeposits(
        uint256 _amount,
        address _bridge,
        BridgeData[] memory _bridgeDepositInfos
    ) internal pure {
        for (uint256 i = 0; i < _bridgeDepositInfos.length; ) {
            BridgeData memory bridgeDepositInfoElem = _bridgeDepositInfos[i];
            if (bridgeDepositInfoElem.bridge == _bridge) {
                _bridgeDepositInfos[i].amount -= _amount;
            }
            unchecked {
                i++;
            }
        }
    }

    /// @dev Generates a hash from a strategy report and bridge interaction information, used for data verification and integrity checks.
    function hashFromReport(
        uint256 _epoch,
        BridgeData[] memory _bridgeWithdrawInfo,
        StrategyReport[] memory _strategyReport,
        BridgeData[] memory _bridgeDepositInfo,
        bool _send
    ) public pure returns (uint256) {
        bytes memory encodedData = _epoch != 0 ? abi.encodePacked(_epoch) : abi.encodePacked();

        for (uint256 i = 0; i < _bridgeWithdrawInfo.length; ) {
            encodedData = abi.encodePacked(
                encodedData,
                uint256(uint160(_bridgeWithdrawInfo[i].bridge)),
                _bridgeWithdrawInfo[i].amount
            );
            unchecked {
                i++;
            }
        }

        for (uint256 i = 0; i < _strategyReport.length; ) {
            encodedData = abi.encodePacked(
                encodedData,
                uint256(uint160(_strategyReport[i].l1Strategy)),
                _strategyReport[i].data,
                _strategyReport[i].amount
            );
            if (_send) {
                encodedData = abi.encodePacked(encodedData, uint256(_strategyReport[i].processed ? 1 : 0));
            }
            unchecked {
                i++;
            }
        }

        for (uint256 i = 0; i < _bridgeDepositInfo.length; ) {
            encodedData = abi.encodePacked(
                encodedData,
                uint256(uint160(_bridgeDepositInfo[i].bridge)),
                _bridgeDepositInfo[i].amount
            );
            unchecked {
                i++;
            }
        }
        return uint256(keccak256(encodedData));
    }

    receive() external payable {}

    fallback() external payable {}
}
