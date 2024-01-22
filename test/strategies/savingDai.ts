import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";
const maxUint256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

describe("Strategy SavingDai Test", function () {

    async function loadFixture() {
        const owner = await ethers.provider.getSigner(0);

        const poolingManagerMockFactory = await ethers.getContractFactory('PoolingManagerMock');
        const poolingManager = await poolingManagerMockFactory.deploy();
        const poolingManagerAddress = await poolingManager.getAddress()

        const erc20MintableMockFactory = await ethers.getContractFactory('ERC20Mock');
        const underlyingToken = await erc20MintableMockFactory.deploy();
        const underlyingTokenAddress = await underlyingToken.getAddress()

        const erc4626MintableMockFactory = await ethers.getContractFactory('ERC4626Mock');
        const yieldToken = await erc4626MintableMockFactory.deploy(underlyingTokenAddress);
        const yieldTokenAddress = await yieldToken.getAddress();

        const savingDaiStrategyFactory = await ethers.getContractFactory('SavingDaiStrategy');
        const savingDaiStrategy = await upgrades.deployProxy(savingDaiStrategyFactory, [
            poolingManagerAddress,
            underlyingTokenAddress,
            yieldTokenAddress,
        ]);
        const savingDaiStrategyAddress = await savingDaiStrategy.getAddress();

        await poolingManager.initAllowance(savingDaiStrategyAddress, underlyingTokenAddress);

        await underlyingToken.mint(owner.address, ethers.parseUnits('200', 'ether'));
        await underlyingToken.approve(yieldTokenAddress, ethers.parseUnits('50', 'ether'));
        await yieldToken.deposit(ethers.parseUnits('50', 'ether'), owner.address)
        await underlyingToken.transfer(yieldTokenAddress, ethers.parseUnits('50', 'ether'));
        return { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy, savingDaiStrategyAddress };
    }


    it("test init ", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy } = await loadFixture();
        const totalAssets = await yieldToken.totalAssets();
        expect(totalAssets == ethers.parseUnits('100', 'ether'));
        const totalSupply = await yieldToken.totalSupply();
        expect(totalSupply == ethers.parseUnits('50', 'ether'));
        expect(await underlyingToken.allowance(poolingManagerAddress, yieldTokenAddress)).equal(maxUint256);
    });


    it("test underlyingToYield ", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy } = await loadFixture();
        const amount = ethers.parseUnits('10', 'ether');
        const yieldAmount = await savingDaiStrategy.underlyingToYield(amount);
        const expectedAmount = ethers.parseUnits('5', 'ether');
        expect(yieldAmount).equal(expectedAmount);
    });

    it("test yieldToUnderlying ", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy } = await loadFixture();
        const amount = ethers.parseUnits('10', 'ether');
        const yieldAmount = await savingDaiStrategy.yieldToUnderlying(amount);
        const expectedAmount = "19999999999999999999";
        expect(yieldAmount).equal(expectedAmount);
    });

    it("test getDepositCalldata ", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy } = await loadFixture();
        const amount = ethers.parseUnits('10', 'ether');
        const calldata = await savingDaiStrategy.getDepositCalldata(amount);
        expect(calldata[0]).equal(yieldTokenAddress);
        // expect(calldata[1]).equal("0x6e553f650000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000008a93d247134d91e0de6f96547cb0204e5be8e5d8");
    });


    it("test action deposit ", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy, savingDaiStrategyAddress } = await loadFixture();
        const amount = ethers.parseUnits('1', 'ether');
        await underlyingToken.transfer(poolingManager, amount);
        await poolingManager.deposit(savingDaiStrategyAddress, amount);

        const lastNav = await poolingManager.lastNav();
        const lastWithdrawalAmount = await poolingManager.lastWithdrawalAmount();
        const nav = await savingDaiStrategy.nav();

        const expectedBalance = "500000000000000000"
        const yieldBalance = await yieldToken.balanceOf(savingDaiStrategy);
        expect(yieldBalance).to.equal(expectedBalance);

        const expectedNav = "999999999999999999"
        expect(lastNav).to.equal(expectedNav);
        expect(lastNav).to.equal(nav);
        expect(lastWithdrawalAmount).to.equal(0);
    });

    it("test acion withdraw enough yield balance", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy, savingDaiStrategyAddress } = await loadFixture();

        const yieldAmount = ethers.parseUnits('10', 'ether');
        yieldToken.transfer(savingDaiStrategyAddress, yieldAmount);

        const withdrawalAmount = ethers.parseUnits('6', 'ether');
        await poolingManager.withdraw(savingDaiStrategyAddress, withdrawalAmount);

        const lastNav = await poolingManager.lastNav();
        const lastWithdrawalAmount = await poolingManager.lastWithdrawalAmount();
        const nav = await savingDaiStrategy.nav();

        const expectedWithdraw = ethers.parseUnits('6', 'ether');
        const underlyingBalance = await underlyingToken.balanceOf(poolingManagerAddress);
        expect(underlyingBalance).to.equal(expectedWithdraw);

        const expectedNav = "13999999999999999998"
        expect(lastNav).to.equal(expectedNav);
        expect(lastNav).to.equal(nav);
        expect(lastWithdrawalAmount).to.equal(expectedWithdraw);
    });

    it("test acion withdraw not enough yield balance", async function () {
        const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, savingDaiStrategy, savingDaiStrategyAddress } = await loadFixture();

        const yieldAmount = ethers.parseUnits('2', 'ether');
        yieldToken.transfer(savingDaiStrategyAddress, yieldAmount);

        const withdrawalAmount = ethers.parseUnits('6', 'ether');
        await poolingManager.withdraw(savingDaiStrategyAddress, withdrawalAmount);

        const lastNav = await poolingManager.lastNav();
        const lastWithdrawalAmount = await poolingManager.lastWithdrawalAmount();
        const nav = await savingDaiStrategy.nav();

        const expectedWithdraw = "3999999999999999999";
        const underlyingBalance = await underlyingToken.balanceOf(poolingManagerAddress);
        expect(underlyingBalance).to.equal(expectedWithdraw);

        const expectedNav = "0"
        expect(lastNav).to.equal(expectedNav);
        expect(lastNav).to.equal(nav);
        expect(lastWithdrawalAmount).to.equal(expectedWithdraw);
    });

});

