// // SPDX-License-Identifier: Apache-2.0.
// pragma solidity ^0.8.20;

// // Local imports
// import "../interfaces/IPoolingManagerBase.sol";
// import "../poolingManager/PoolingManagerBase.sol";

// contract DataFetcher {
//     function bridgeEthFeesMultiplicator(
//         PoolingManagerBase poolingManagerInstance,
//         BridgeInteractionInfo[] memory _bridgeDepositInfo
//     ) external view returns (uint256) {
//         uint256 pendingRequestsExecutedProcessedLength = poolingManagerInstance
//             .pendingRequestsExecutedProcessedLength();
//         uint256 pendingRequestsExecutedLength = poolingManagerInstance
//             .pendingRequestsExecutedLength();

//         uint256 acc = 0;
//         for (
//             uint256 index1 = pendingRequestsExecutedProcessedLength;
//             // index1 < pendingRequestsExecutedLength;
//             index1++
//         ) {
//             StrategyReport memory pendingRequestsElem = poolingManagerInstance
//                 .pendingRequests()

//             if (pendingRequestsElem.amount > 0) {
//                 bool found = false;
//                 for (
//                     uint256 index2 = 0;
//                     index2 < _bridgeDepositInfo.length;
//                     index2++
//                 ) {
//                     BridgeInteractionInfo
//                         memory bridgeDepositInfoElem = _bridgeDepositInfo[
//                             index2
//                         ];

//                     if (
//                         bridgeDepositInfoElem.bridge ==
//                         poolingManagerInstance
//                             .strategyInfo(pendingRequestsElem.l1Strategy)
//                             .bridge
//                     ) {
//                         found = true;
//                     }
//                 }
//                 if (!found) {
//                     acc++;
//                 }
//             }
//         }
//         return (_bridgeDepositInfo.length + acc);
//     }
// }
