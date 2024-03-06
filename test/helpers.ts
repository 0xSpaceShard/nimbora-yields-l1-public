import { BigNumberish } from 'ethers';
import { PoolingManagerBase } from '../typechain-types';
import { ethers } from 'hardhat';
import { Action, HandleReportInput } from './interfaces';

const L2_HANDLER_SELECTOR = '0x10e13e50cb99b6b3c8270ec6e16acfccbe1164a629d74b43549567a77593aff';

export function padAddressTo32Bytes(address: string) {
    // Remove the '0x' prefix if it exists
    let cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

    // Pad the address with zeros to make it 32 bytes long
    while (cleanAddress.length < 64) {
        cleanAddress = '0' + cleanAddress;
    }

    return '0x' + cleanAddress;
}

export function computeHashFromL2Report(
    new_epoch: BigNumberish,
    bridgeWithdrawInfo: PoolingManagerBase.BridgeDataStruct[],
    strategyReportL2: PoolingManagerBase.StrategyReportStruct[],
    bridgeDepositInfo: PoolingManagerBase.BridgeDataStruct[],
) {
    const encoder = ethers.AbiCoder.defaultAbiCoder();
    let encodedData = '0x';
    if (new_epoch != 0) {
        encodedData += encoder.encode(['uint256'], [new_epoch]).slice(2);
    }

    for (let index = 0; index < bridgeWithdrawInfo.length; index++) {
        const bridgeInfoElement = bridgeWithdrawInfo[index];
        encodedData += encoder
            .encode(['uint256', 'uint256'], [bridgeInfoElement.bridge, bridgeInfoElement.amount])
            .slice(2);
    }

    for (let index = 0; index < strategyReportL2.length; index++) {
        const strategyReportL2Element = strategyReportL2[index];
        encodedData += encoder
            .encode(
                ['uint256', 'uint256', 'uint256', 'uint256'],
                [
                    strategyReportL2Element.l1Strategy,
                    strategyReportL2Element.data,
                    strategyReportL2Element.amount,
                    strategyReportL2Element.processed == false ? 0 : 1,
                ],
            )
            .slice(2);
    }

    for (let index = 0; index < bridgeDepositInfo.length; index++) {
        const bridgeDepositInfoElement = bridgeDepositInfo[index];
        encodedData += encoder
            .encode(['uint256', 'uint256'], [bridgeDepositInfoElement.bridge, bridgeDepositInfoElement.amount])
            .slice(2);
    }

    return ethers.keccak256(encodedData);
}

function splitUint256ToUint128(uint256: bigint) {
    const lowMask = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    const lowPart = uint256 & lowMask;
    const highPart = uint256 >> BigInt(128);
    return { lowPart, highPart };
}

export function computeMessageReceivedL1(l2Pooling: BigNumberish, l1Pooling: BigNumberish, hash: bigint) {
    const encoder = ethers.AbiCoder.defaultAbiCoder();
    let encodedData = '0x';
    encodedData += encoder.encode(['uint256'], [l2Pooling]).slice(2);
    encodedData += encoder.encode(['uint256'], [l1Pooling]).slice(2);
    encodedData += encoder.encode(['uint256'], [2]).slice(2);
    const { lowPart, highPart } = splitUint256ToUint128(hash);
    encodedData += encoder.encode(['uint256'], [lowPart]).slice(2);
    encodedData += encoder.encode(['uint256'], [highPart]).slice(2);
    return ethers.keccak256(encodedData);
}

export function computeMessageReceivedL2(l1Pooling: any, l2Pooling: any, nonceMessaging: any, epoch: any, hash: any) {
    const encoder = ethers.AbiCoder.defaultAbiCoder();
    let encodedData = '0x';

    encodedData += encoder.encode(['uint256'], [l1Pooling]).slice(2);
    encodedData += encoder.encode(['uint256'], [l2Pooling]).slice(2);
    encodedData += encoder.encode(['uint256'], [nonceMessaging]).slice(2);
    encodedData += encoder.encode(['uint256'], [L2_HANDLER_SELECTOR]).slice(2);

    const { lowPart: lowEpoch, highPart: highEpoch } = splitUint256ToUint128(epoch);

    const { lowPart: lowHash, highPart: highHash } = splitUint256ToUint128(hash);

    encodedData += encoder.encode(['uint256'], [4]).slice(2);
    encodedData += encoder.encode(['uint256'], [lowEpoch]).slice(2);
    encodedData += encoder.encode(['uint256'], [highEpoch]).slice(2);
    encodedData += encoder.encode(['uint256'], [lowHash]).slice(2);
    encodedData += encoder.encode(['uint256'], [highHash]).slice(2);
    return ethers.keccak256(encodedData);
}

export function computeFromReportL1(strategyReportL1: PoolingManagerBase.StrategyReportStructOutput[]) {
    const encoder = ethers.AbiCoder.defaultAbiCoder();
    let encodedData = '0x';
    for (let index = 0; index < strategyReportL1.length; index++) {
        const strategyReportL1Element = strategyReportL1[index];
        encodedData += encoder
            .encode(
                ['uint256', 'uint256', 'uint256'],
                [strategyReportL1Element.l1Strategy, strategyReportL1Element.data, strategyReportL1Element.amount],
            )
            .slice(2);
    }

    return ethers.keccak256(encodedData);
}
