import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumberish, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { impersonateAccount } from '@nomicfoundation/hardhat-toolbox/network-helpers';

import {
    ERC20Mock,
    PoolingManagerBase,
    SavingDaiStrategy,
    SavingDaiStrategy__factory,
    StarknetErc20BridgeMock,
    StarknetPoolingManager,
    StarknetPoolingManager__factory,
    UniswapV3Strategy,
    UniswapV3Strategy__factory,
    WETH9,
    ERC4626Mock,
    StarknetMock,
    StarknetEthBridgeMock,
    WstethMintable,
    UniswapV3FactoryMock,
    UniswapRouterMock,
    StrategyBase,
} from '../typechain-types';
import { beforeEach } from 'mocha';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
    computeFromReportL1,
    computeHashFromL2Report,
    computeMessageReceivedL1,
    computeMessageReceivedL2,
} from './helpers';
import { testCasesHash } from './__mocks__/hash';
import { Action, HandleReportInput } from './interfaces';
import { testCasesReportsMock1, testCasesReportsMock2, testCasesReportsMock3 } from './__mocks__/reports';

const l2PoolingManager = '1029302920393029293';

describe('Starknet Pooling Manager Test', function () {
    let starknetPoolingManager: StarknetPoolingManager;
    let starknetPoolingManagerAddress: string;
    let starknetMock: StarknetMock;
    let starknetMockAddress: string;
    let admin: HardhatEthersSigner;
    let relayer: HardhatEthersSigner;
    let user: HardhatEthersSigner;

    let dai: ERC20Mock;
    let daiAddress: string;
    let sdai: ERC4626Mock;
    let sdaiAddress: string;
    let sdaiStrategy: SavingDaiStrategy;
    let sdaiStrategyAddress: string;
    let daiBridge: StarknetErc20BridgeMock;
    let daiBridgeAddress: string;

    let weth: WETH9;
    let wethAddress: string;
    let wstEth: ERC20Mock;
    let wstethAddress: string;
    let uniswapV3Strategy: UniswapV3Strategy;
    let uniswapV3StrategyAddress: string;
    let ethBridge: StarknetEthBridgeMock;
    let ethBridgeAddress: string;
    let uniswapRouterMock: UniswapRouterMock;

    beforeEach(async () => {
        admin = await ethers.provider.getSigner(0);
        relayer = await ethers.provider.getSigner(1);
        user = await ethers.provider.getSigner(2);

        // Starknet core contract
        const starknetMockFactory = await ethers.getContractFactory('StarknetMock');
        starknetMock = await starknetMockFactory.deploy();
        starknetMockAddress = await starknetMock.getAddress();

        // Starknet Eth bridge
        const starkneEthBridgeMockFactory = await ethers.getContractFactory('StarknetEthBridgeMock');
        ethBridge = await starkneEthBridgeMockFactory.deploy();
        ethBridgeAddress = await ethBridge.getAddress();

        // wETH
        const wethMockFactory = await ethers.getContractFactory('WETH9');
        weth = await wethMockFactory.deploy();
        wethAddress = await weth.getAddress();

        // wETH
        const wstEthMockFactory = await ethers.getContractFactory('ERC20Mock');
        wstEth = await wstEthMockFactory.deploy();
        wstethAddress = await wstEth.getAddress();

        // Starknet Pooling Manager
        const poolingManagerFactory: StarknetPoolingManager__factory =
            await ethers.getContractFactory('StarknetPoolingManager');
        const proxy = await upgrades.deployProxy(
            poolingManagerFactory,
            [admin.address, l2PoolingManager, starknetMockAddress, relayer.address, ethBridgeAddress, wethAddress],
            {
                kind: 'uups',
            },
        );

        starknetPoolingManager = StarknetPoolingManager__factory.connect(await proxy.getAddress(), admin);
        starknetPoolingManagerAddress = await starknetPoolingManager.getAddress();

        // DAI token mock
        const erc20MintableMockFactory = await ethers.getContractFactory('ERC20Mock');
        dai = await erc20MintableMockFactory.deploy();
        daiAddress = await dai.getAddress();

        // sDAI token mock
        const erc4626MockFactory = await ethers.getContractFactory('ERC4626Mock');
        sdai = await erc4626MockFactory.deploy(await dai.getAddress());
        sdaiAddress = await sdai.getAddress();

        // Starknet dai bridge
        const starkneErc20BridgeMockFactory = await ethers.getContractFactory('StarknetErc20BridgeMock');
        daiBridge = await starkneErc20BridgeMockFactory.deploy(await dai.getAddress());
        daiBridgeAddress = await daiBridge.getAddress();

        // sDAI Strategy
        const savingDaiStrategyFactory = await ethers.getContractFactory('SavingDaiStrategy');
        const proxy2 = await upgrades.deployProxy(
            savingDaiStrategyFactory,
            [
                await starknetPoolingManager.getAddress(),
                await dai.getAddress(),
                await sdai.getAddress(),
                await daiBridge.getAddress(),
            ],
            {
                kind: 'uups',
            },
        );

        sdaiStrategy = SavingDaiStrategy__factory.connect(await proxy2.getAddress(), admin);
        sdaiStrategyAddress = await sdaiStrategy.getAddress();

        // uniswap Factory
        const uniswapV3FactoryMockFactory = await ethers.getContractFactory('UniswapV3FactoryMock');
        const uniswapV3FactoryMock: UniswapV3FactoryMock =
            (await uniswapV3FactoryMockFactory.deploy()) as UniswapV3FactoryMock;
        const uniswapV3FactoryMockAddress = await uniswapV3FactoryMock.getAddress();

        const poolFee = '1000';
        const poolAddress = Wallet.createRandom().address;
        await uniswapV3FactoryMock.setPool(wethAddress, wstethAddress, poolFee, poolAddress);

        // Pricefeed giving the price of WstETH in ETH, let's take 1.2 ETH
        const mockV3AggregatorFactory = await ethers.getContractFactory('MockV3Aggregator');
        const mockV3Aggregator = await mockV3AggregatorFactory.deploy(18, '200000000000000000');
        const mockV3AggregatorAddress = await mockV3Aggregator.getAddress();

        const uniswapRouterMockFactory = await ethers.getContractFactory('UniswapRouterMock');
        uniswapRouterMock = (await uniswapRouterMockFactory.deploy()) as UniswapRouterMock;
        const uniswapRouterMockAddress = await uniswapRouterMock.getAddress();

        // initialy set the exchange rate to pricefeed value
        await uniswapRouterMock.setExchangeRate(wstethAddress, wethAddress, '200000000000000000');

        const uniswapV3StrategyFactory = await ethers.getContractFactory('UniswapV3Strategy');
        const minReceivedAmountFactor = '990000000000000000';
        const proxy3 = await upgrades.deployProxy(
            uniswapV3StrategyFactory,
            [
                await starknetPoolingManager.getAddress(),
                wethAddress,
                wstethAddress,
                ethBridgeAddress,
                uniswapRouterMockAddress,
                uniswapV3FactoryMockAddress,
                mockV3AggregatorAddress,
                minReceivedAmountFactor,
                poolFee,
            ],
            {
                kind: 'uups',
            },
        );

        uniswapV3Strategy = UniswapV3Strategy__factory.connect(await proxy3.getAddress(), admin);
        uniswapV3StrategyAddress = await uniswapV3Strategy.getAddress();

        // Topup the pool
        await wstEth.mint(uniswapRouterMockAddress, ethers.parseUnits('5', 'ether'));
        await weth.mint(ethers.parseUnits('5', 'ether'), uniswapRouterMockAddress);

        // Mint tokens to bridges
        await dai.mint(await daiBridge.getAddress(), ethers.parseEther('1000000'));
        await admin.sendTransaction({ to: ethBridgeAddress, value: ethers.parseUnits('10', 'ether') });
    });

    it('Should register strategy', async function () {
        await starknetPoolingManager.registerStrategy(await sdaiStrategy.getAddress());
        let allowance = await dai.allowance(await starknetPoolingManager.getAddress(), await daiBridge.getAddress());
        expect(allowance).eq(ethers.MaxUint256);
        allowance = await dai.allowance(await starknetPoolingManager.getAddress(), await sdai.getAddress());
        expect(allowance).eq(ethers.MaxUint256);
        const filter = starknetPoolingManager.filters['StrategyRegistered(address)'];
        const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
        expect(event.args.strategy).eq(await sdaiStrategy.getAddress());
    });

    it('Should fail to register strategy: invalid strategy contract', async function () {
        const randomAddress = ethers.zeroPadBytes('0x01', 20);
        await expect(starknetPoolingManager.registerStrategy(randomAddress)).reverted;
    });

    it('Should fail to register strategy: not admin', async function () {
        await expect(
            starknetPoolingManager.connect(user).registerStrategy(await sdaiStrategy.getAddress()),
        ).revertedWithCustomError(starknetPoolingManager, 'AccessControlUnauthorizedAccount');
    });

    it('Should success handle report, deposit/withdraw into a single strategy (sdai), simulate loose tokens', async function () {
        await impersonateAccount(sdaiAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: sdaiAddress });
        const sdaiSigner = await ethers.getSigner(sdaiAddress);

        const l1strategyAddress = await sdaiStrategy.getAddress();
        const bridgeAddress = await daiBridge.getAddress();
        await starknetPoolingManager.registerStrategy(l1strategyAddress);

        const testCases: HandleReportInput[] = testCasesReportsMock1(bridgeAddress, l1strategyAddress);

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            console.log(`${testCase.description} - ${i + 1}/${testCases.length}`);

            // L1<>L2 messages
            const hash = await addMessageToBridge(testCase);

            let beforeSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));
            const beforeBridgeDaiBalance = BigInt(await dai.balanceOf(bridgeAddress));
            beforeSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));

            let loosedAmount = BigInt(0);
            if (i == 1) {
                loosedAmount = BigInt(testCase.strategyReportL2[0].amount) / BigInt(2);
                // Simulate loose of dai on sdai contract.
                await dai.connect(sdaiSigner).transfer(user.address, loosedAmount);
            }

            // handleReport
            await handleReport(testCase);

            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************

                // Vaidations
                const amount = testCase.strategyReportL2[0].amount;
                const afterSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));
                const expectedShares = BigInt(await sdaiStrategy.underlyingToYield(amount));
                expect(afterSdaiBalance - beforeSdaiBalance).equal(expectedShares);

                const daiTokens = BigInt(await sdaiStrategy.yieldToUnderlying(afterSdaiBalance));
                expect(daiTokens).equal(BigInt(amount));

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
            } else if (testCase.strategyReportL2[0].data == Action.WITHDRAW) {
                // ****************************************
                // Case 2: HandleReport withdraw validation
                // ****************************************

                // Vaidations
                const amount = testCase.strategyReportL2[0].amount;
                const afterBridgeDaiBalance = BigInt(await dai.balanceOf(bridgeAddress));
                const expectedDai = BigInt(await sdaiStrategy.yieldToUnderlying(amount));
                expect(afterBridgeDaiBalance - beforeBridgeDaiBalance).equal(expectedDai - loosedAmount);

                const afterSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));
                const expectedShares = BigInt(await sdaiStrategy.underlyingToYield(amount));
                expect(beforeSdaiBalance - afterSdaiBalance).eq(expectedShares);

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
            }
            expect(await starknetMock.l2ToL1Messages(hash)).eq(0);
        }
    });

    it('Should success handle report, deposit/withdraw into a single strategy (sdai)', async function () {
        const l1strategyAddress = await sdaiStrategy.getAddress();
        const bridgeAddress = await daiBridge.getAddress();
        await starknetPoolingManager.registerStrategy(l1strategyAddress);

        const testCases: HandleReportInput[] = testCasesReportsMock1(bridgeAddress, l1strategyAddress);

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            console.log(`${testCase.description} - ${i + 1}/${testCases.length}`);

            // L1<>L2 messages
            const hash = await addMessageToBridge(testCase);

            let beforeSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));
            const beforeBridgeDaiBalance = BigInt(await dai.balanceOf(bridgeAddress));
            beforeSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));

            // handleReport
            await handleReport(testCase);

            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************

                // Vaidations
                const amount = testCase.strategyReportL2[0].amount;
                const afterSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));
                const expectedShares = BigInt(await sdaiStrategy.underlyingToYield(amount));
                expect(afterSdaiBalance - beforeSdaiBalance).equal(expectedShares);

                const daiTokens = BigInt(await sdaiStrategy.yieldToUnderlying(afterSdaiBalance));
                expect(daiTokens).equal(BigInt(amount));

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
            } else if (testCase.strategyReportL2[0].data == Action.WITHDRAW) {
                // ****************************************
                // Case 2: HandleReport withdraw validation
                // ****************************************

                // Vaidations
                const amount = testCase.strategyReportL2[0].amount;
                const afterBridgeDaiBalance = BigInt(await dai.balanceOf(bridgeAddress));
                const expectedDai = BigInt(await sdaiStrategy.yieldToUnderlying(amount));
                expect(afterBridgeDaiBalance - beforeBridgeDaiBalance).equal(expectedDai);

                const afterSdaiBalance = BigInt(await sdai.balanceOf(l1strategyAddress));
                const expectedShares = BigInt(await sdaiStrategy.underlyingToYield(amount));
                expect(beforeSdaiBalance - afterSdaiBalance).eq(expectedShares);

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
            }
            expect(await starknetMock.l2ToL1Messages(hash)).eq(0);
        }
    });

    it('Should success handle report, deposit/withdraw into a single strategy (uniswap)', async function () {
        const bridgeAddress = await uniswapV3Strategy.bridge();
        await starknetPoolingManager.registerStrategy(uniswapV3StrategyAddress);

        const testCases: HandleReportInput[] = testCasesReportsMock1(bridgeAddress, uniswapV3StrategyAddress);

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            console.log(`${testCase.description} - ${i + 1}/${testCases.length}`);

            // L1<>L2 messages
            const hash = await addMessageToBridge(testCase);

            const beforeYieldBalance = BigInt(await wstEth.balanceOf(uniswapV3StrategyAddress));
            const beforeBridgeUnderlayingBalance = BigInt(await admin.provider.getBalance(bridgeAddress));

            // handleReport
            await handleReport(testCase);
            const amount = testCase.strategyReportL2[0].amount;

            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************

                // Vaidations
                const afterYieldBalance = BigInt(await wstEth.balanceOf(uniswapV3StrategyAddress));
                const expectedShares = BigInt(await uniswapV3Strategy.underlyingToYield(amount));
                expect(afterYieldBalance - beforeYieldBalance).equal(expectedShares);

                const afterBridgeUnderlayingBalance = BigInt(await admin.provider.getBalance(bridgeAddress));
                expect(beforeBridgeUnderlayingBalance - afterBridgeUnderlayingBalance).equal(amount);

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
                expect(event.args.reports[0][3]).true;
            } else if (testCase.strategyReportL2[0].data == Action.WITHDRAW) {
                // ****************************************
                // Case 2: HandleReport withdraw validation
                // ****************************************

                // Vaidations
                const afterBridgeUnderlayingBalance = BigInt(await admin.provider.getBalance(bridgeAddress));
                expect(afterBridgeUnderlayingBalance - beforeBridgeUnderlayingBalance - BigInt(amount)).eq(1);

                const afterYieldBalance = BigInt(await wstEth.balanceOf(uniswapV3StrategyAddress));
                const expectedShares = BigInt(await uniswapV3Strategy.underlyingToYield(amount));
                expect(beforeYieldBalance - afterYieldBalance).equal(expectedShares);

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
                expect(event.args.reports[0][3]).true;
            }
            expect(await starknetMock.l2ToL1Messages(hash)).eq(0);
        }
    });

    it('Should success handle report, deposit/withdraw into one strategy (sdai) when strategy reverted when withdraw', async function () {
        await starknetPoolingManager.registerStrategy(sdaiStrategyAddress);

        const testCases: HandleReportInput[] = testCasesReportsMock3(daiBridgeAddress, sdaiStrategyAddress);

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            // L1<>L2 messages
            await addMessageToBridge(testCase);

            let beforeSdaiBalance = BigInt(await sdai.balanceOf(sdaiStrategyAddress));
            beforeSdaiBalance = BigInt(await sdai.balanceOf(sdaiStrategyAddress));

            if (i == 1) {
                // Simulate the strategy reverted when withdraw
                await sdai.setShouldFail(true);
            }

            // handleReport
            await handleReport(testCase);

            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************

                // Vaidations
                const amount = testCase.strategyReportL2[0].amount;
                const afterSdaiBalance = BigInt(await sdai.balanceOf(sdaiStrategyAddress));
                const expectedShares = BigInt(await sdaiStrategy.underlyingToYield(amount));
                expect(afterSdaiBalance - beforeSdaiBalance).equal(expectedShares);

                const daiTokens = BigInt(await sdaiStrategy.yieldToUnderlying(afterSdaiBalance));
                expect(daiTokens).equal(BigInt(amount));

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
                expect(event.args.reports[0][3]).true;
            } else if (testCase.strategyReportL2[0].data == Action.WITHDRAW) {
                // ****************************************
                // Case 2: HandleReport withdraw validation
                // ****************************************

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);

                // Exepct the the transaction status is not processed
                expect(event.args.reports[0][3]).false;
            }
        }
    });

    it('Should success handle report, deposit/withdraw into one strategy (uniswapV3) when strategy reverted when withdraw', async function () {
        const bridgeAddress = await uniswapV3Strategy.bridge();
        await starknetPoolingManager.registerStrategy(uniswapV3StrategyAddress);

        const testCases: HandleReportInput[] = testCasesReportsMock3(ethBridgeAddress, uniswapV3StrategyAddress);

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            // L1<>L2 messages
            await addMessageToBridge(testCase);

            const beforeYieldBalance = BigInt(await wstEth.balanceOf(uniswapV3StrategyAddress));
            const beforeBridgeUnderlayingBalance = BigInt(await admin.provider.getBalance(bridgeAddress));

            if (i == 1) {
                // Simulate the strategy reverted when withdraw
                await uniswapRouterMock.setShouldFail(true);
            }

            // handleReport
            await handleReport(testCase);

            const amount = testCase.strategyReportL2[0].amount;
            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************
                // Vaidations
                const afterYieldBalance = BigInt(await wstEth.balanceOf(uniswapV3StrategyAddress));
                const expectedShares = BigInt(await uniswapV3Strategy.underlyingToYield(amount));
                expect(afterYieldBalance - beforeYieldBalance).equal(expectedShares);

                const afterBridgeUnderlayingBalance = BigInt(await admin.provider.getBalance(bridgeAddress));
                expect(beforeBridgeUnderlayingBalance - afterBridgeUnderlayingBalance).equal(amount);

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);
                expect(event.args.reports[0][3]).true;
            } else if (testCase.strategyReportL2[0].data == Action.WITHDRAW) {
                // ****************************************
                // Case 2: HandleReport withdraw validation
                // ****************************************

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);

                // Exepct the the transaction status is not processed
                expect(event.args.reports[0][3]).false;
            }
        }
    });

    it('Should success handle report, deposit/withdraw into one strategy (sdai) when strategy reverted when deposit', async function () {
        await impersonateAccount(sdaiAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: sdaiAddress });
        await starknetPoolingManager.registerStrategy(sdaiStrategyAddress);

        // Do only a deposit
        const testCases: HandleReportInput[] = [testCasesReportsMock3(daiBridgeAddress, sdaiStrategyAddress)[0]];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            // L1<>L2 messages
            await addMessageToBridge(testCase);

            if (i == 0) {
                // Simulate the strategy reverted when withdraw
                await sdai.setShouldFail(true);
            }

            // handleReport
            await handleReport(testCase);

            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);

                // Exepct the the transaction status is not processed
                expect(event.args.reports[0][3]).false;
            }
        }
    });

    it('Should success handle report, deposit/withdraw into one strategy (uniswap) when strategy reverted when deposit', async function () {
        await impersonateAccount(uniswapV3StrategyAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: sdaiAddress });
        await starknetPoolingManager.registerStrategy(uniswapV3StrategyAddress);

        // Do only a deposit
        const testCases: HandleReportInput[] = [testCasesReportsMock3(ethBridgeAddress, uniswapV3StrategyAddress)[0]];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            // L1<>L2 messages
            await addMessageToBridge(testCase);

            if (i == 0) {
                // Simulate the strategy reverted when withdraw
                await uniswapRouterMock.setShouldFail(true);
            }

            // handleReport
            await handleReport(testCase);

            if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                // ***************************************
                // Case 1: HandleReport deposit validation
                // ***************************************

                // Check event
                const filter = starknetPoolingManager.filters.ReportHandled;
                const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                expect(event.args.epoch).eq(testCase.epoch);

                // Exepct the the transaction status is not processed
                expect(event.args.reports[0][3]).false;
            }
        }
    });

    it('Should success handle report, deposit/withdraw into multiple strategies (sdai, uniswapV3)', async function () {
        const l1strategyAddress1 = await sdaiStrategy.getAddress();
        const l1strategyAddress2 = await uniswapV3Strategy.getAddress();
        const bridgeAddress1 = await sdaiStrategy.bridge();
        const bridgeAddress2 = await uniswapV3Strategy.bridge();
        await starknetPoolingManager.registerStrategy(l1strategyAddress1);
        await starknetPoolingManager.registerStrategy(l1strategyAddress2);

        const strategies = [
            {
                strategyAddress: l1strategyAddress1,
                bridge: bridgeAddress1,
                strategy: sdaiStrategy,
                yielToken: sdai,
                underlying: dai,
                isETH: false,
            },
            {
                strategyAddress: l1strategyAddress2,
                bridge: bridgeAddress2,
                strategy: uniswapV3Strategy,
                yielToken: wstEth,
                underlying: weth,
                isETH: true,
            },
        ];

        const testCases: HandleReportInput[] = testCasesReportsMock2(
            bridgeAddress1,
            bridgeAddress2,
            l1strategyAddress1,
            l1strategyAddress2,
        );

        const beforeBalances = [];
        for (let j = 0; j < strategies.length; j++) {
            const { yielToken, underlying, strategyAddress, bridge, isETH } = strategies[j];
            beforeBalances.push({
                beforeYieldBalance: BigInt(await yielToken.balanceOf(strategyAddress)),
                beforeBridgeUnderlayingBalance: isETH
                    ? BigInt(await admin.provider.getBalance(bridge))
                    : BigInt(await underlying.balanceOf(bridge)),
            });
        }

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            // L1<>L2 messages
            const hash = await addMessageToBridge(testCase);
            console.log(`${testCase.description} - ${i + 1}/${testCases.length}`);

            // handleReport
            await handleReport(testCase);

            for (let j = 0; j < strategies.length; j++) {
                const { strategyAddress, strategy, yielToken, underlying, bridge, isETH } = strategies[j];
                const { beforeBridgeUnderlayingBalance, beforeYieldBalance } = beforeBalances[j];

                if (testCase.strategyReportL2[0].data == Action.DEPOSIT) {
                    // ***************************************
                    // Case 1: HandleReport deposit validation
                    // ***************************************

                    // Vaidations
                    const amount = testCase.strategyReportL2[0].amount;
                    const afterYieldBalance = BigInt(await yielToken.balanceOf(strategyAddress));
                    const expectedShares = BigInt(await strategy.underlyingToYield(amount));
                    expect(afterYieldBalance - beforeYieldBalance).equal(expectedShares);

                    const daiTokens = BigInt(await strategy.yieldToUnderlying(afterYieldBalance));
                    expect(daiTokens).equal(BigInt(amount));

                    // Check event
                    const filter = starknetPoolingManager.filters.ReportHandled;
                    const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                    expect(event.args.epoch).eq(testCase.epoch);
                } else if (testCase.strategyReportL2[0].data == Action.WITHDRAW) {
                    // ****************************************
                    // Case 2: HandleReport withdraw validation
                    // ****************************************

                    // Check event
                    const filter = starknetPoolingManager.filters.ReportHandled;
                    const event = (await starknetPoolingManager.queryFilter(filter, -1))[0];
                    expect(event.args.epoch).eq(testCase.epoch);
                    for (let i = 0; i < event.args.reports.length; i++) {
                        const report = event.args.reports[i];
                        expect(report[3]).true;
                    }

                    const amount = testCase.strategyReportL2[0].amount;
                    // Vaidations

                    if (isETH) {
                        // const afterBridgeUnderlayingBalance = BigInt(await admin.provider.getBalance(bridge));
                        // console.log("afterBridgeUnderlayingBalance", afterBridgeUnderlayingBalance)
                        // console.log("beforeBridgeUnderlayingBalance", beforeBridgeUnderlayingBalance)
                        // expect((afterBridgeUnderlayingBalance - beforeBridgeUnderlayingBalance) - BigInt(amount)).eq(1)
                        // const afterYieldBalance = BigInt(await wstEth.balanceOf(strategyAddress));
                        // const expectedShares = BigInt(await uniswapV3Strategy.underlyingToYield(amount));
                        // expect(beforeYieldBalance - afterYieldBalance ).equal(expectedShares);
                    } else {
                        // const amount = testCase.strategyReportL2[0].amount;
                        // const afterBridgeDaiBalance = BigInt(await dai.balanceOf(bridge));
                        // const expectedDai = BigInt(await sdaiStrategy.yieldToUnderlying(amount));
                        // expect(afterBridgeDaiBalance - beforeBridgeUnderlayingBalance).equal(expectedDai);
                        // const afterSdaiBalance = BigInt(await sdai.balanceOf(strategyAddress));
                        // const expectedShares = BigInt(await sdaiStrategy.underlyingToYield(amount));
                        // expect(beforeYieldBalance - afterSdaiBalance).eq(expectedShares);
                    }
                }
                expect(await starknetMock.l2ToL1Messages(hash)).eq(0);
            }
        }
    });

    const handleReport = async (input: HandleReportInput) => {
        await starknetPoolingManager
            .connect(relayer)
            .handleReport(
                input.epoch,
                input.bridgeWithdrawInfo,
                input.strategyReportL2,
                input.bridgeDepositInfo,
                1,
                1,
                {
                    value: 2,
                },
            );
    };

    const addMessageToBridge = async (inputs: HandleReportInput) => {
        const expectedHashL2 = computeHashFromL2Report(
            inputs.epoch,
            inputs.bridgeWithdrawInfo,
            inputs.strategyReportL2,
            inputs.bridgeDepositInfo,
        );
        const messageReceivedL1 = computeMessageReceivedL1(
            l2PoolingManager,
            await starknetPoolingManager.getAddress(),
            BigInt(expectedHashL2),
        );
        await starknetMock.addMessage([messageReceivedL1]);
        expect(await starknetMock.l2ToL1Messages(messageReceivedL1)).not.eq(0);
        return messageReceivedL1;
    };

    it('Should initilize the pooling manager', async function () {
        const adminRole = await starknetPoolingManager.DEFAULT_ADMIN_ROLE();
        const relayerRole = await starknetPoolingManager.RELAYER_ROLE();

        expect(await starknetPoolingManager.l2PoolingManager()).equal(l2PoolingManager);
        expect(await starknetPoolingManager.hasRole(adminRole, admin.address)).equal(true);
        expect(await starknetPoolingManager.hasRole(relayerRole, relayer.address)).equal(true);
        expect(await starknetPoolingManager.starknetCore()).equal(await starknetMock.getAddress());
        expect(await starknetPoolingManager.ethBridge()).equal(await ethBridge.getAddress());
        expect(await starknetPoolingManager.wETH()).equal(await weth.getAddress());
    });

    it('Should be able to call cancelDepositRequestBridge', async function () {
        const amount = ethers.parseEther('1');
        const nonce = '1';
        await starknetPoolingManager.cancelDepositRequestBridge(await daiBridge.getAddress(), amount, nonce);
    });

    it('Should be able to call claimBridgeCancelDepositRequest erc20', async function () {
        const amount = ethers.parseEther('1');
        const nonce = '1';
        await dai.mint(await daiBridge.getAddress(), amount);
        await starknetPoolingManager.claimBridgeCancelDepositRequest(
            await daiBridge.getAddress(),
            await dai.getAddress(),
            amount,
            nonce,
        );
        await starknetPoolingManager.claimBridgeCancelDepositRequest(
            await daiBridge.getAddress(),
            await dai.getAddress(),
            0,
            nonce,
        );
    });

    it('Should be able to call claimBridgeCancelDepositRequest eth', async function () {
        const amount = ethers.parseEther('1');
        const nonce = '1';
        await admin.sendTransaction({ value: amount, to: await ethBridge.getAddress() });
        await starknetPoolingManager.claimBridgeCancelDepositRequest(
            await ethBridge.getAddress(),
            Wallet.createRandom(),
            amount,
            nonce,
        );
        await starknetPoolingManager.claimBridgeCancelDepositRequest(
            await ethBridge.getAddress(),
            Wallet.createRandom(),
            0,
            nonce,
        );
    });

    it('should return correct report hash', async function () {
        const randomAddress1 = Wallet.createRandom().address;
        const randomAddress2 = Wallet.createRandom().address;

        const testCases = testCasesHash(randomAddress1, randomAddress2);
        for (let i = 0; i < testCases.length; i++) {
            const { epoch, bridgeDepositInfo, bridgeWithdrawInfo, strategyReportL2 } = testCases[i];
            const expectedHash = computeHashFromL2Report(
                epoch,
                bridgeWithdrawInfo,
                strategyReportL2,
                bridgeDepositInfo,
            );
            const hash = await starknetPoolingManager.hashFromReport(
                epoch,
                bridgeWithdrawInfo,
                strategyReportL2,
                bridgeDepositInfo,
                false,
            );
            expect(hash).to.equal(BigInt(expectedHash));
        }
    });

    it('Should register new strategy', async function () {
        await starknetPoolingManager.registerStrategy(await sdaiStrategy.getAddress());
        const bridge = await sdaiStrategy.bridge();
        const addressToApprove = await sdaiStrategy.addressToApprove();
        expect(await dai.allowance(await starknetPoolingManager.getAddress(), bridge)).not.eq(0);
        expect(await dai.allowance(await starknetPoolingManager.getAddress(), addressToApprove)).not.eq(0);
    });

    it('Should fail to register new strategy, invalid contract implementation', async function () {
        const randomAddress1 = '0xef651ae91702efec38a7bdb1f9816ad554a2adcd';
        await expect(starknetPoolingManager.registerStrategy(randomAddress1)).reverted;
    });

    it('Should fail to register new strategy, InvalidPoolingManager', async function () {
        const randomAddress1 = '0xef651ae91702efec38a7bdb1f9816ad554a2adcd';
        const savingDaiStrategyFactory = await ethers.getContractFactory('SavingDaiStrategy');
        const proxy2 = await upgrades.deployProxy(
            savingDaiStrategyFactory,
            [randomAddress1, await dai.getAddress(), await sdai.getAddress(), await daiBridge.getAddress()],
            { kind: 'uups' },
        );

        const invalidSdaiStrategy = SavingDaiStrategy__factory.connect(await proxy2.getAddress(), admin);
        await expect(
            starknetPoolingManager.registerStrategy(await invalidSdaiStrategy.getAddress()),
        ).revertedWithCustomError(starknetPoolingManager, 'InvalidPoolingManager');
    });

    it('Should return a valid l1->l2 hash', async function () {
        // Epoch-4: pooling manager address: 0x065a953f89a314a427e960114c4b9bb83e0e4195f801f12c25e4a323a76da0a9
        const l2Hash = 9394751887553205148934003660731450063757890657721159828438100138263725105979n;

        const data = [
            {
                l1Strategy: '0xAFa27423F3bb4c0337946dDcd1802588807571bf',
                data: 5009861221786695105n,
                amount: 0n,
                processed: true,
            },
            {
                l1Strategy: '0xE5e2134e536fbfD7513094646E27C401bbb03eF6',
                data: 19993021130296587n,
                amount: 0n,
                processed: false,
            },
        ];
        const l1Hash = await starknetPoolingManager.hashFromReport(0, [], data, [], true);
        expect(l1Hash).equal(l2Hash);
    });
});
