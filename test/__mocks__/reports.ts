import { ethers } from 'hardhat';
import { Action, HandleReportInput } from '../interfaces';

export const testCasesReportsMock1 = (bridge: string, l1Strategy: string): HandleReportInput[] => {
    return [
        {
            description: 'HandleReport first deposit',
            epoch: '1',
            bridgeWithdrawInfo: [{ bridge, amount: ethers.parseUnits('1', 'ether') }],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport withdraw all tokens',
            epoch: '2',
            bridgeWithdrawInfo: [],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [{ bridge, amount: ethers.parseUnits('1', 'ether') }],
        },
        {
            description: 'HandleReport first deposit',
            epoch: '3',
            bridgeWithdrawInfo: [{ bridge, amount: ethers.parseUnits('1', 'ether') }],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport withdraw half tokens',
            epoch: '4',
            bridgeWithdrawInfo: [],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('0.5', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [{ bridge, amount: ethers.parseUnits('0.5', 'ether') }],
        },
        {
            description: 'HandleReport withdraw all the tokens',
            epoch: '5',
            bridgeWithdrawInfo: [],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('0.5', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [{ bridge, amount: ethers.parseUnits('0.5', 'ether') }],
        },
    ];
};

export const testCasesReportsMock2 = (
    bridge1: string,
    bridge2: string,
    l1Strategy1: string,
    l1Strategy2: string,
): HandleReportInput[] => {
    return [
        {
            description: 'HandleReport deposit for multiple strategies',
            epoch: '1',
            bridgeWithdrawInfo: [
                { bridge: bridge1, amount: ethers.parseUnits('1', 'ether') },
                { bridge: bridge2, amount: ethers.parseUnits('1', 'ether') },
            ],
            strategyReportL2: [
                {
                    l1Strategy: l1Strategy1,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
                {
                    l1Strategy: l1Strategy2,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport withdraw all from multiple strategies',
            epoch: '2',
            bridgeWithdrawInfo: [],
            strategyReportL2: [
                {
                    l1Strategy: l1Strategy1,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
                {
                    l1Strategy: l1Strategy2,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [
                { bridge: bridge1, amount: ethers.parseUnits('1', 'ether') },
                { bridge: bridge2, amount: ethers.parseUnits('1', 'ether') },
            ],
        },
    ];
};

export const testCasesReportsMock3 = (bridge: string, l1Strategy: string): HandleReportInput[] => {
    return [
        {
            description: 'HandleReport first deposit',
            epoch: '1',
            bridgeWithdrawInfo: [{ bridge, amount: ethers.parseUnits('1', 'ether') }],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.DEPOSIT,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [],
        },
        {
            description: 'HandleReport withdraw all tokens',
            epoch: '2',
            bridgeWithdrawInfo: [],
            strategyReportL2: [
                {
                    l1Strategy,
                    data: Action.WITHDRAW,
                    amount: ethers.parseUnits('1', 'ether'),
                    processed: false,
                },
            ],
            bridgeDepositInfo: [{ bridge, amount: ethers.parseUnits('1', 'ether') }],
        },
    ];
};
