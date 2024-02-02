import { BigNumberish } from 'ethers';
import { PoolingManagerBase } from '../typechain-types';

export interface HandleReportInput {
    description: string;
    epoch: BigNumberish;
    bridgeWithdrawInfo: PoolingManagerBase.BridgeDataStruct[];
    strategyReportL2: PoolingManagerBase.StrategyReportStruct[];
    bridgeDepositInfo: PoolingManagerBase.BridgeDataStruct[];
}

export enum Action {
    DEPOSIT = 0,
    UPDATE = 1,
    WITHDRAW = 2,
}
