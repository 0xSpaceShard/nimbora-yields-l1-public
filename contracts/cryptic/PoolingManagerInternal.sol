// // SPDX-License-Identifier: Apache-2.0
// pragma solidity ^0.8.20;

// import "../PoolingManager.sol";

// contract PoolingManagerInternal is PoolingManager {
//     constructor() initializer {}

//     function initialize(
//         address _owner,
//         uint256 _l2PoolingManager,
//         address _starknetCore,
//         address _relayer,
//         address _ethBridge,
//         address _ethWrapped
//     ) public override initializer {
//         PoolingManager.initialize(
//             _owner,
//             _l2PoolingManager,
//             _starknetCore,
//             _relayer,
//             _ethBridge,
//             _ethWrapped
//         );
//     }

//     function addElements(StrategyReport[] memory elemArray) external {
//         for (uint256 index = 0; index < elemArray.length; index++) {
//             StrategyReport memory elem = elemArray[index];
//             pendingRequests.push(elem);
//         }
//     }

//     function deleteElement(
//         uint256 index
//     ) external returns (StrategyReport[] memory array) {
//         _deleteElement(PoolingManager.pendingRequests, index);
//         return (PoolingManager.pendingRequests);
//     }

//     function withdrawFromBridges(
//         BridgeInteractionInfo[] memory bridgeWithdrawalInfo
//     ) external {
//         _withdrawFromBridges(bridgeWithdrawalInfo);
//     }

//     function depositToBridges(
//         BridgeInteractionInfo[] memory bridgeDepositInfo,
//         uint256 l2BridgeEthFee,
//         bool withdrawEth
//     ) external {
//         _depositToBridges(bridgeDepositInfo, l2BridgeEthFee, withdrawEth);
//     }
// }
