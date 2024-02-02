import { ethers } from 'hardhat';
import { Action, HandleReportInput } from '../interfaces';

export const testCasesHash = (bridge: string, l1Strategy: string): HandleReportInput[] => {
    return [
        {
            description: 'HandleReport with zero data',
            epoch: '0',
            bridgeWithdrawInfo: [],
            strategyReportL2: [],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport with bridgeWithdrawInfo',
            epoch: '0',
            bridgeWithdrawInfo: [
                { bridge, amount: ethers.parseUnits('0.5', 'ether') },
                { bridge, amount: ethers.parseUnits('1', 'ether') },
                { bridge, amount: ethers.parseUnits('1.5', 'ether') },
            ],
            strategyReportL2: [],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport with bridgeDepositInfo',
            epoch: '0',
            bridgeWithdrawInfo: [],
            strategyReportL2: [],
            bridgeDepositInfo: [
                { bridge, amount: ethers.parseUnits('0.5', 'ether') },
                { bridge, amount: ethers.parseUnits('1', 'ether') },
                { bridge, amount: ethers.parseUnits('1.5', 'ether') },
            ],
        },
        {
            description: 'HandleReport with strategyReportL2',
            epoch: '0',
            bridgeWithdrawInfo: [],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
                {
                    l1Strategy,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('2', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport with strategyReportL2',
            epoch: '1',
            bridgeWithdrawInfo: [
                { bridge, amount: ethers.parseUnits('0.5', 'ether') },
                { bridge, amount: ethers.parseUnits('1', 'ether') },
                { bridge, amount: ethers.parseUnits('1.5', 'ether') },
            ],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
                {
                    l1Strategy,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('2', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [
                { bridge, amount: ethers.parseUnits('0.5', 'ether') },
                { bridge, amount: ethers.parseUnits('1', 'ether') },
                { bridge, amount: ethers.parseUnits('1.5', 'ether') },
            ],
        },
    ];
};
