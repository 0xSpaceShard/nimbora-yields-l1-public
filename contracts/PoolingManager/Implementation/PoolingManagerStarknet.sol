// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// OpenZeppelin imports
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Local imports
import {StarknetMessaging} from "../../lib/StarknetMessaging.sol";
import {PoolingManagerBase} from "../PoolingManagerBase.sol";
import "../../interfaces/IPoolingManagerBase.sol";
import {IPoolingManagerStarknet} from "../../interfaces/IPoolingManagerStarknet.sol";

abstract contract PoolingManagerStarknet is
    PoolingManagerBase,
    StarknetMessaging,
    IPoolingManagerStarknet
{
    constructor() initializer {}

    function initialize(
        address _owner,
        uint256 _l2PoolingManager,
        address _starknetCore,
        address _relayer,
        address _ethBridge,
        address _ethWrapped
    ) public virtual initializer {
        initializeMessaging(_starknetCore);
        _initializePoolingManagerBase(
            _owner,
            _l2PoolingManager,
            _relayer,
            _ethBridge,
            _ethWrapped
        );
    }

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

    function claimBridgeCancelDepositRequestAndDeposit(
        address l1BridgeAddress,
        address tokenAddress,
        uint256 amount,
        uint256 nonce
    ) public payable onlyRole(OWNER_ROLE) {
        depositReclaimToBridgeToken(
            l1BridgeAddress,
            l2PoolingManager,
            amount,
            nonce
        );
        IERC20(tokenAddress).transfer(msg.sender, amount);

        emit BridgeCancelDepositRequestClaimed(l1BridgeAddress, amount, nonce);
    }

    function _withdrawTokenFromBridgeL2(
        address bridge,
        uint256 amount
    ) internal override {
        _withdrawTokenFromBridge(bridge, address(this), amount);
    }

    function _depositTokenToBridgeL2(
        address bridge,
        uint256 amount,
        uint256 value
    ) internal override {
        depositToBridgeToken(bridge, l2PoolingManager, amount, value);
    }

    function _verifyCalldataL2(uint256 dataHash) internal override {
        _consumeL2Message(
            l2PoolingManager,
            _getMessagePayloadData(0, dataHash)
        );
    }

    function _sendMessageL2(
        uint256 epoch,
        uint256 dataHash,
        uint256 l2MessagingEthFee
    ) internal override {
        _sendMessageToL2(
            l2PoolingManager,
            L2_HANDLER_SELECTOR,
            _getMessagePayloadData(epoch, dataHash),
            l2MessagingEthFee
        );
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
}
