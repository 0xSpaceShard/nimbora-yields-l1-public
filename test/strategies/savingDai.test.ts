import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import {
    ERC4626Mock,
    SavingDaiStrategy,
    SavingDaiStrategy__factory,
    StarknetErc20BridgeMock,
    StarknetEthBridgeMock,
    StarknetPoolingManager,
    StarknetPoolingManager__factory,
} from '../../typechain-types';
import { StarknetMock } from '../../typechain-types/contracts/mock/starknet/starknetMock.sol';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ERC20Mock } from '../../typechain-types/contracts/mock/erc20/erc20Mintabl.sol';
import { impersonateAccount } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Wallet } from 'ethers';

describe('Strategy SavingDai Test', function () {
    const l2PoolingManager = '1029302920393029293';
    let starknetPoolingManager: StarknetPoolingManager;
    let starknetMock: StarknetMock;
    let admin: HardhatEthersSigner;
    let relayer: HardhatEthersSigner;
    let user: HardhatEthersSigner;

    let dai: ERC20Mock;
    let sdai: ERC4626Mock;
    let sdaiStrategy: SavingDaiStrategy;
    let sdaiStrategyAddress: string;
    let daiBridge: StarknetErc20BridgeMock;
    let ethBridge: StarknetEthBridgeMock;
    let starknetPoolingManagerAddress: string;

    beforeEach('Setup sDAI testing', async () => {
        admin = await ethers.provider.getSigner(0);
        relayer = await ethers.provider.getSigner(1);
        user = await ethers.provider.getSigner(2);
        const wETH = await ethers.provider.getSigner(3);

        // Starknet core contract
        const starknetMockFactory = await ethers.getContractFactory('StarknetMock');
        starknetMock = await starknetMockFactory.deploy();
        const starknetMockAddress = await starknetMock.getAddress();

        // Starknet Eth bridge
        const starkneEthBridgeMockFactory = await ethers.getContractFactory('StarknetEthBridgeMock');
        ethBridge = await starkneEthBridgeMockFactory.deploy();
        const ethBridgeAddress = await ethBridge.getAddress();

        // Starknet Pooling Manager
        const poolingManagerFactory: StarknetPoolingManager__factory =
            await ethers.getContractFactory('StarknetPoolingManager');
        const proxy = await upgrades.deployProxy(
            poolingManagerFactory,
            [admin.address, l2PoolingManager, starknetMockAddress, relayer.address, ethBridgeAddress, wETH.address],
            {
                kind: 'uups',
            },
        );

        starknetPoolingManager = StarknetPoolingManager__factory.connect(await proxy.getAddress(), admin);
        starknetPoolingManagerAddress = await starknetPoolingManager.getAddress();

        // DAI token mock
        const erc20MintableMockFactory = await ethers.getContractFactory('ERC20Mock');
        dai = await erc20MintableMockFactory.deploy();

        // sDAI token mock
        const erc4626MockFactory = await ethers.getContractFactory('ERC4626Mock');
        sdai = await erc4626MockFactory.deploy(await dai.getAddress());

        // Starknet dai bridge
        const starkneErc20BridgeMockFactory = await ethers.getContractFactory('StarknetErc20BridgeMock');
        daiBridge = await starkneErc20BridgeMockFactory.deploy(await dai.getAddress());

        // sDAI Strategy
        const savingDaiStrategyFactory = await ethers.getContractFactory('SavingDaiStrategy');
        const proxy2 = await upgrades.deployProxy(
            savingDaiStrategyFactory,
            [
                starknetPoolingManagerAddress,
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
    });

    it('Should init the strategy ', async function () {
        expect(await sdaiStrategy.underlyingToken()).eq(await dai.getAddress());
        expect(await sdaiStrategy.yieldToken()).eq(await sdai.getAddress());
        expect(await sdaiStrategy.bridge()).eq(await daiBridge.getAddress());
        expect(await sdaiStrategy.poolingManager()).eq(starknetPoolingManagerAddress);
    });

    it('Should deposit into the strategy ', async function () {
        // Deposit into strategy.
        const amount = ethers.parseEther('10');
        await dai.mint(admin.address, amount);
        await dai.approve(await sdaiStrategy.addressToApprove(), amount);
        const { cdata, target } = await sdaiStrategy.depositCalldata(amount);

        const sdaiBalanceBefore = await sdai.balanceOf(sdaiStrategyAddress);

        // Deposit
        await admin.sendTransaction({ value: 0, to: target, data: cdata });

        // validation
        const sdaiBalanceafter = await sdai.balanceOf(sdaiStrategyAddress);
        const expectedYield = await sdaiStrategy.underlyingToYield(amount);
        expect(sdaiBalanceafter - sdaiBalanceBefore).eq(expectedYield);
    });

    it('Should withdraw from the strategy ', async function () {
        const sdaiStrategyAddress = await sdaiStrategy.getAddress();
        // Deposit into strategy.
        const amount = ethers.parseEther('10');
        await dai.mint(admin.address, amount);
        await dai.approve(await sdaiStrategy.addressToApprove(), amount);
        const { cdata, target } = await sdaiStrategy.depositCalldata(amount);

        // Deposit
        await admin.sendTransaction({ value: 0, to: target, data: cdata });
        await impersonateAccount(starknetPoolingManagerAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: starknetPoolingManagerAddress });
        const signer = await ethers.getSigner(starknetPoolingManagerAddress);

        // Withdraw
        const sdaiBalanceBefore = await sdai.balanceOf(sdaiStrategyAddress);
        await sdaiStrategy.connect(signer).withdraw(sdaiBalanceBefore);

        const sdaiBalanceAfter = await sdai.balanceOf(sdaiStrategyAddress);
        const expectedYield = await sdaiStrategy.underlyingToYield(amount);
        expect(sdaiBalanceBefore - sdaiBalanceAfter).eq(expectedYield);
    });

    it('Should return the underlyingToYield ', async function () {
        const amount = ethers.parseUnits('200', 'ether');
        await dai.mint(admin.address, amount);
        await dai.approve(sdai, amount);
        await sdai.deposit(amount, admin.address);

        const yieldAmountBefore = await sdaiStrategy.underlyingToYield(amount);
        expect(yieldAmountBefore).equal(amount);

        await dai.mint(await sdai.getAddress(), amount);
        const yieldAmountAfter = await sdaiStrategy.underlyingToYield(amount);
        expect(yieldAmountAfter).equal(amount / BigInt(2));
    });

    it('Should return the yieldToUnderlying ', async function () {
        const amount = ethers.parseUnits('200', 'ether');

        // Deposit in sdai
        await dai.mint(admin.address, amount);
        await dai.approve(await sdai.getAddress(), amount / BigInt(2));
        await sdai.deposit(amount / BigInt(2), admin.address);
    });

    it('Should return the depositCalldata ', async function () {
        const amount = ethers.parseUnits('10', 'ether');
        const { cdata, target } = await sdaiStrategy.depositCalldata(amount);

        expect(target).eq(await sdai.getAddress());
        const iface = new ethers.Interface([
            {
                inputs: [
                    {
                        internalType: 'uint256',
                        name: '_amount',
                        type: 'uint256',
                    },
                    {
                        internalType: 'address',
                        name: '_receiver',
                        type: 'address',
                    },
                ],
                name: 'deposit',
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function',
            },
        ]);
        const encodedData = iface.encodeFunctionData('deposit(uint256,address)', [amount, sdaiStrategyAddress]);
        expect(cdata).equal(encodedData);
    });

    it('Should deposit into the strategy', async function () {
        await impersonateAccount(starknetPoolingManagerAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: starknetPoolingManagerAddress });
        const poolingManagerSigner = await ethers.getSigner(starknetPoolingManagerAddress);

        const balancesDaiBefore = await sdai.balanceOf(sdaiStrategyAddress);

        // Deposit into sdai
        const amount = ethers.parseUnits('1', 'ether');
        await dai.mint(starknetPoolingManagerAddress, amount);
        await dai.connect(poolingManagerSigner).approve(await sdai.getAddress(), amount);
        const { target, cdata } = await sdaiStrategy.connect(poolingManagerSigner).depositCalldata(amount);

        const pmBalancesDaiBefore = await sdai.balanceOf(starknetPoolingManagerAddress);
        expect(pmBalancesDaiBefore).eq(0);

        await poolingManagerSigner.sendTransaction({
            to: target,
            data: cdata,
        });

        const balancesDaiAfter = await sdai.balanceOf(sdaiStrategyAddress);
        const pmBalancesDaiAfter = await sdai.balanceOf(starknetPoolingManagerAddress);
        const expectedSdai = await sdaiStrategy.underlyingToYield(amount);

        expect(balancesDaiAfter - balancesDaiBefore).eq(expectedSdai);
        expect(pmBalancesDaiAfter).eq(0);
        expect(await sdaiStrategy.yieldBalance()).eq(expectedSdai);

        // Simulate yied (rewards)
        const nav = await sdaiStrategy.nav();
        expect(nav).eq(amount);
        await dai.mint(await sdai.getAddress(), amount);
        const navAfter = await sdaiStrategy.nav();
        expect(navAfter).gt(amount);
    });

    it('test acion withdraw enough yield balance', async function () {
        // Setup the startegy with initial deposit
        const yieldAmount = ethers.parseUnits('10', 'ether');
        await dai.mint(admin.address, yieldAmount);
        await dai.approve(await sdai.getAddress(), yieldAmount);
        await sdai.deposit(yieldAmount, sdaiStrategyAddress);

        let withdrawalAmount = ethers.parseUnits('5', 'ether');
        await impersonateAccount(starknetPoolingManagerAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: starknetPoolingManagerAddress });
        const poolingManagerSigner = await ethers.getSigner(starknetPoolingManagerAddress);
        const balanceYieldBefore = await sdai.balanceOf(sdaiStrategyAddress);
        let balanceUnderlyingBefore = await dai.balanceOf(starknetPoolingManagerAddress);

        // Withdraw
        await sdaiStrategy.connect(poolingManagerSigner).withdraw(withdrawalAmount);
        let balanceUnderlyingAfter = await dai.balanceOf(starknetPoolingManagerAddress);
        const balanceYieldAfter = await sdai.balanceOf(sdaiStrategyAddress);
        let expectedUnderlying = await sdaiStrategy.yieldToUnderlying(withdrawalAmount);
        const expectedYield = await sdaiStrategy.yieldToUnderlying(withdrawalAmount);

        expect(balanceYieldBefore - balanceYieldAfter).eq(expectedYield);
        expect(balanceUnderlyingAfter - balanceUnderlyingBefore).eq(expectedUnderlying);

        // Simulate rewards
        const nav = await sdaiStrategy.nav();
        const rewards = ethers.parseUnits('5', 'ether');
        await dai.mint(await sdai.getAddress(), rewards);
        const navAfter = await sdaiStrategy.nav();
        expect(nav).lt(navAfter);

        withdrawalAmount = navAfter;
        // Withdraw
        balanceUnderlyingBefore = await dai.balanceOf(starknetPoolingManagerAddress);
        expectedUnderlying = await sdaiStrategy.yieldToUnderlying(withdrawalAmount);
        await sdaiStrategy.connect(poolingManagerSigner).withdraw(withdrawalAmount);
        balanceUnderlyingAfter = await dai.balanceOf(starknetPoolingManagerAddress);

        expect(balanceUnderlyingAfter - balanceUnderlyingBefore).equal(withdrawalAmount);
    });

    it('Should withdraw when not enough yield balance', async function () {
        // Setup the startegy with initial deposit
        const underlyingAmount = ethers.parseUnits('10', 'ether');
        await dai.mint(admin.address, underlyingAmount);
        await dai.approve(await sdai.getAddress(), underlyingAmount);
        await sdai.deposit(underlyingAmount, sdaiStrategyAddress);

        await impersonateAccount(starknetPoolingManagerAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: starknetPoolingManagerAddress });

        const signer = await ethers.getSigner(starknetPoolingManagerAddress);

        expect(await sdai.balanceOf(sdaiStrategyAddress)).eq(await sdaiStrategy.yieldToUnderlying(underlyingAmount));
        expect(await dai.balanceOf(starknetPoolingManagerAddress)).eq(0);

        // Withdraw
        const withdrawAmount = ethers.parseUnits('11', 'ether');
        await sdaiStrategy.connect(signer).withdraw(withdrawAmount);

        expect(await sdai.balanceOf(sdaiStrategyAddress)).eq(0);
        expect(await dai.balanceOf(starknetPoolingManagerAddress)).eq(underlyingAmount);
    });

    it('Should withdraw all NAV', async function () {
        // Setup the startegy with initial deposit
        const underlyingAmount = ethers.parseUnits('10', 'ether');
        await dai.mint(admin.address, underlyingAmount);
        await dai.approve(await sdai.getAddress(), underlyingAmount);
        await sdai.deposit(underlyingAmount, sdaiStrategyAddress);

        await impersonateAccount(starknetPoolingManagerAddress);
        await admin.sendTransaction({ value: ethers.parseEther('1'), to: starknetPoolingManagerAddress });

        const signer = await ethers.getSigner(starknetPoolingManagerAddress);

        // Simulate rewards
        const nav = await sdaiStrategy.nav();
        const rewards = ethers.parseUnits('10', 'ether');
        await dai.mint(await sdai.getAddress(), rewards);
        const navAfter = await sdaiStrategy.nav();
        expect(nav).lt(navAfter);

        const expectedUnderlaying = await sdaiStrategy.yieldToUnderlying(underlyingAmount);

        expect(await dai.balanceOf(starknetPoolingManagerAddress)).eq(0);

        // Withdraw, try to withdrawl more than the allowed balance
        const withdrawAmount = ethers.parseUnits('100', 'ether');
        await sdaiStrategy.connect(signer).withdraw(withdrawAmount);

        expect(await sdai.balanceOf(sdaiStrategyAddress)).eq(0);
        expect(await dai.balanceOf(starknetPoolingManagerAddress)).eq(expectedUnderlaying);
    });

    it('Should fail if the caller is not admin', async function () {
        const randomAddress = ethers.Wallet.createRandom();
        await expect(sdaiStrategy.connect(user).upgradeToAndCall(randomAddress, '0x')).revertedWithCustomError(
            sdaiStrategy,
            'CallerIsNotAdmin',
        );
    });

    it('Should fail if the caller is pooling manager', async function () {
        const amount = ethers.parseUnits('10', 'ether');
        await expect(sdaiStrategy.connect(user).withdraw(amount)).revertedWithCustomError(
            sdaiStrategy,
            'CallerIsNotPoolingManager',
        );
    });
});
