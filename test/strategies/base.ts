import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";

describe("StrategyBase Test", function () {
  const maxUint256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

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

    const testStrategyBaseFactory = await ethers.getContractFactory('TestStrategyBase');
    const testStrategyBase = await upgrades.deployProxy(testStrategyBaseFactory, [
      poolingManagerAddress,
      underlyingTokenAddress,
      yieldTokenAddress
    ]);
    const testStrategyBaseAddress = await testStrategyBase.getAddress();

    await underlyingToken.mint(owner.address, ethers.parseUnits('200', 'ether'));
    await underlyingToken.approve(yieldTokenAddress, ethers.parseUnits('50', 'ether'));
    await yieldToken.deposit(ethers.parseUnits('50', 'ether'), owner.address)
    await underlyingToken.transfer(yieldTokenAddress, ethers.parseUnits('50', 'ether'));
    await poolingManager.initAllowance(testStrategyBaseAddress, underlyingTokenAddress);
    return { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress };
  }

  it("test init", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    expect(await testStrategyBase.poolingManager()).equal(poolingManagerAddress);
    expect(await testStrategyBase.underlyingToken()).equal(underlyingTokenAddress);
    expect(await testStrategyBase.yieldToken()).equal(yieldTokenAddress);
    expect(await underlyingToken.allowance(poolingManagerAddress, yieldTokenAddress)).equal(maxUint256);
  });

  it("test yieldBalance", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const amount = ethers.parseUnits('1', 'ether');
    await yieldToken.transfer(testStrategyBaseAddress, amount)
    expect(await testStrategyBase.yieldBalance()).equal(amount);
  });

  it("test yieldToUnderlying", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const amount = ethers.parseUnits('1', 'ether');
    const underlyingTokens = await testStrategyBase.yieldToUnderlying(amount);
    const amountInUnderlying = "1999999999999999999"
    expect(underlyingTokens).equal(amountInUnderlying);
  });

  it("test underlyingToYield", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const amount = ethers.parseUnits('1', 'ether');
    const yieldTokens = await testStrategyBase.underlyingToYield(amount);
    const amountInYield = "500000000000000000";
    expect(yieldTokens).equal(amountInYield);
  });

  it("test nav", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const amount = ethers.parseUnits('1', 'ether');
    await yieldToken.transfer(testStrategyBaseAddress, amount);
    const nav = await testStrategyBase.nav();
    const amountInUnderlying = "1999999999999999999"
    expect(nav).equal(amountInUnderlying);
  });

  it("test checkOwnerValidOrRevert revert", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const randomAddress = Wallet.createRandom().address;
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [randomAddress],
    });
    const impersonatedSigner = await ethers.getSigner(randomAddress);
    const testStrategyBaseConnected = testStrategyBase.connect(impersonatedSigner) as Contract;
    await expect(testStrategyBaseConnected.checkOwnerValidOrRevert())
      .to.be.revertedWithCustomError(testStrategyBase, "InvalidCaller");
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [randomAddress],
    });
  });

  it("test checkOwnerValidOrRevert pass", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    await testStrategyBase.checkOwnerValidOrRevert();
  });

  it("test withdraw revert invalid caller", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const amount = ethers.parseUnits('1', 'ether');
    await underlyingToken.transfer(testStrategyBaseAddress, amount);
    await expect(testStrategyBase.withdraw(amount))
      .to.be.revertedWithCustomError(testStrategyBase, "InvalidCaller");
  });

  it("test action deposit", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const amount = ethers.parseUnits('1', 'ether');
    await underlyingToken.transfer(poolingManager, amount);
    await poolingManager.deposit(testStrategyBaseAddress, amount);

    const lastNav = await poolingManager.lastNav();
    const lastWithdrawalAmount = await poolingManager.lastWithdrawalAmount();
    const nav = await testStrategyBase.nav();
    const newBalanceUnderlying = await underlyingToken.balanceOf(poolingManagerAddress);
    const expectedNav = "999999999999999999";

    expect(lastNav).to.equal(expectedNav);
    expect(lastNav).to.equal(nav);
    expect(lastWithdrawalAmount).to.equal(0);
    expect(newBalanceUnderlying).to.equal(0);
  });

  it("test action withdraw", async function () {
    const { owner, poolingManager, poolingManagerAddress, underlyingToken, underlyingTokenAddress, yieldToken, yieldTokenAddress, testStrategyBase, testStrategyBaseAddress } = await loadFixture();
    const depositAmount = ethers.parseUnits('1', 'ether');
    const withdrawalAmount = ethers.parseUnits('0.5', 'ether');

    const amount = ethers.parseUnits('1', 'ether');
    await underlyingToken.transfer(poolingManager, amount);
    await poolingManager.deposit(testStrategyBaseAddress, amount);
    await poolingManager.withdraw(testStrategyBaseAddress, withdrawalAmount);

    const lastNav = await poolingManager.lastNav();
    const lastWithdrawalAmount = await poolingManager.lastWithdrawalAmount();
    const nav = await testStrategyBase.nav();

    const new_nav = "499999999999999998"
    expect(lastNav).to.equal(new_nav);
    expect(lastNav).to.equal(nav);
    expect(lastWithdrawalAmount).to.equal(withdrawalAmount);
  });

});

