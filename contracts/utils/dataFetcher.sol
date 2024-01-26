// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.20;

// // Local imports
// import {IPoolingManagerBase} from "../interfaces/IPoolingManagerBase.sol";

// contract DataFetcher {
//     function bridgeEthFeesMultiplicator(
//         BridgeInteractionInfo[] memory _bridgeDepositInfo
//     ) external view returns (uint256) {
//         uint256 acc = 0;
//         for (
//             uint256 index1 = pendingRequestsExecutedProcessedLength;
//             index1 < pendingRequestsExecutedLength;
//             index1++
//         ) {
//             StrategyReport memory pendingRequestsElem = pendingRequests[index1];
//             if (pendingRequestsElem.amount > 0) {
//                 bool found = false;
//                 for (
//                     uint256 index2 = 0;
//                     index2 < _bridgeDepositInfo.length;
//                     index2++
//                 ) {
//                     BridgeInteractionInfo
//                         memory bridgeDepositInfoElem = bridgeDepositInfo[
//                             index2
//                         ];
//                     if (
//                         bridgeDepositInfoElem.bridge ==
//                         strategyInfo[pendingRequestsElem.l1Strategy].bridge
//                     ) {
//                         found = true;
//                     }
//                 }
//                 if (!found) {
//                     acc++;
//                 }
//             }
//         }
//         return (bridgeDepositInfo.length + acc);
//     }
// }
