import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Wallet } from "ethers";
import {
  ERC20Mock,
  StarknetEthBridgeMock,
  StarknetMock,
  StarknetPoolingManager,
  StarknetPoolingManager__factory,
  UniswapRouterMock,
  UniswapV3FactoryMock,
  UniswapV3Strategy,
  UniswapV3Strategy__factory,
  WETH9,
} from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MockV3Aggregator } from "../../typechain-types/contracts/mock/chainlink/chainlinkMock.sol";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

describe("Strategy UniswapV3 Test", function () {
  const l2PoolingManager = "1029302920393029293";
  let starknetPoolingManager: StarknetPoolingManager;
  let starknetMock: StarknetMock;
  let admin: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  let weth: WETH9;
  let wstEth: ERC20Mock;
  let uniswapV3Strategy: UniswapV3Strategy;
  let uniswapV3StrategyAddress: string;
  let ethBridge: StarknetEthBridgeMock;
  let starknetPoolingManagerAddress: string;
  let uniswapRouterMockAddress: string;
  let mockV3Aggregator: MockV3Aggregator;
  let mockV3AggregatorAddress: string;
  const poolFee = "1000";
  const minReceivedAmountFactor = "990000000000000000";

  beforeEach("Strategy UniswapV3 Test", async () => {
    admin = await ethers.provider.getSigner(0);
    relayer = await ethers.provider.getSigner(1);
    user = await ethers.provider.getSigner(2);

    // Starknet core contract
    const starknetMockFactory = await ethers.getContractFactory("StarknetMock");
    starknetMock = await starknetMockFactory.deploy();
    const starknetMockAddress = await starknetMock.getAddress();

    // Starknet Eth bridge
    const starkneEthBridgeMockFactory = await ethers.getContractFactory(
      "StarknetEthBridgeMock",
    );
    ethBridge = await starkneEthBridgeMockFactory.deploy();
    const ethBridgeAddress = await ethBridge.getAddress();

    // wETH
    const wethMockFactory = await ethers.getContractFactory("WETH9");
    weth = await wethMockFactory.deploy();

    // Starknet Pooling Manager
    const poolingManagerFactory: StarknetPoolingManager__factory =
      await ethers.getContractFactory("StarknetPoolingManager");
    const proxy = await upgrades.deployProxy(
      poolingManagerFactory,
      [
        admin.address,
        l2PoolingManager,
        starknetMockAddress,
        relayer.address,
        ethBridgeAddress,
        await weth.getAddress(),
      ],
      {
        kind: "uups",
      },
    );

    starknetPoolingManager = StarknetPoolingManager__factory.connect(
      await proxy.getAddress(),
      admin,
    );
    starknetPoolingManagerAddress = await starknetPoolingManager.getAddress();

    // wstETH
    const wstEthMockFactory = await ethers.getContractFactory("ERC20Mock");
    wstEth = await wstEthMockFactory.deploy();

    // uniswap Factory
    const uniswapV3FactoryMockFactory = await ethers.getContractFactory(
      "UniswapV3FactoryMock",
    );
    const uniswapV3FactoryMock: UniswapV3FactoryMock =
      (await uniswapV3FactoryMockFactory.deploy()) as UniswapV3FactoryMock;
    const uniswapV3FactoryMockAddress = await uniswapV3FactoryMock.getAddress();

    const poolAddress = Wallet.createRandom().address;
    const wstethAddress = await wstEth.getAddress();
    const wethAddress = await weth.getAddress();
    await uniswapV3FactoryMock.setPool(
      wethAddress,
      wstethAddress,
      poolFee,
      poolAddress,
    );

    // Pricefeed giving the price of WstETH in ETH, let's take 1.2 ETH
    const mockV3AggregatorFactory =
      await ethers.getContractFactory("MockV3Aggregator");
    mockV3Aggregator = await mockV3AggregatorFactory.deploy(
      18,
      "200000000000000000",
    );
    mockV3AggregatorAddress = await mockV3Aggregator.getAddress();

    const uniswapRouterMockFactory =
      await ethers.getContractFactory("UniswapRouterMock");
    const uniswapRouterMock: UniswapRouterMock =
      (await uniswapRouterMockFactory.deploy()) as UniswapRouterMock;
    uniswapRouterMockAddress = await uniswapRouterMock.getAddress();

    // initialy set the exchange rate to pricefeed value
    await uniswapRouterMock.setExchangeRate(
      wstethAddress,
      wethAddress,
      "200000000000000000",
    );
    const uniswapV3StrategyFactory =
      await ethers.getContractFactory("UniswapV3Strategy");

    const proxy3 = await upgrades.deployProxy(
      uniswapV3StrategyFactory,
      [
        starknetPoolingManagerAddress,
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
        kind: "uups",
      },
    );

    uniswapV3Strategy = UniswapV3Strategy__factory.connect(
      await proxy3.getAddress(),
      admin,
    );
    uniswapV3StrategyAddress = await uniswapV3Strategy.getAddress();

    // Setup uniswap pool (wsteht<>weth)
    await weth.deposit({ value: ethers.parseEther("100") });
    await weth.transfer(uniswapRouterMockAddress, ethers.parseEther("100"));
    await wstEth.mint(uniswapRouterMockAddress, ethers.parseEther("100"));
  });

  it("Should initilaze the strategy", async function () {
    expect(await uniswapV3Strategy.uniswapRouter()).equal(
      uniswapRouterMockAddress,
    );
    expect(await uniswapV3Strategy.chainlinkPricefeed()).equal(
      mockV3AggregatorAddress,
    );
    expect(await uniswapV3Strategy.pricefeedPrecision()).equal(
      "1000000000000000000",
    );
    expect(await uniswapV3Strategy.minReceivedAmountFactor()).equal(
      minReceivedAmountFactor,
    );
    expect(await uniswapV3Strategy.poolFee()).equal(poolFee);
  });

  it("Should be able to return chainlinkLatestAnswer", async function () {
    expect(await uniswapV3Strategy.chainlinkLatestAnswer()).eq(
      "200000000000000000",
    );
  });

  it("Should be able to return addressToApprove", async function () {
    expect(await uniswapV3Strategy.addressToApprove()).eq(
      uniswapRouterMockAddress,
    );
  });

  it("Should be able to setMinReceivedAmountFactor, admin caller", async function () {
    const minFact = "980000000000000000";
    await uniswapV3Strategy.setMinReceivedAmountFactor(minFact);
    expect(await uniswapV3Strategy.minReceivedAmountFactor()).equal(minFact);
  });

  it("Should not be able to setMinReceivedAmountFactor, not admin caller", async function () {
    const minFact = "980000000000000000";
    await expect(
      uniswapV3Strategy.connect(user).setMinReceivedAmountFactor(minFact),
    ).revertedWithCustomError(uniswapV3Strategy, "CallerIsNotAdmin");
  });

  it("Should fail setMinReceivedAmountFactor", async function () {
    // To be a valid slippage the fact value should be 0.95 <= fac <= 1 eth

    // Case: bigger than max
    let fact = "1000000000000000001";
    await expect(
      uniswapV3Strategy.setMinReceivedAmountFactor(fact),
    ).revertedWithCustomError(uniswapV3Strategy, "InvalidSlippage");

    // Case: lower than min
    fact = "940000000000000000";
    await expect(
      uniswapV3Strategy.setMinReceivedAmountFactor(fact),
    ).revertedWithCustomError(uniswapV3Strategy, "InvalidSlippage");
  });

  it("Should return the correct underlyingToYield ", async function () {
    const amount = ethers.parseUnits("10", "ether");
    const answer = ethers.parseUnits("5", "ether");
    await mockV3Aggregator.updateAnswer(answer);
    const yieldAmount = await uniswapV3Strategy.underlyingToYield(amount);

    // check _calculateUnderlyingToYieldAmount inside uniswapV3 strategy
    const expectedYield = (BigInt(10 ** 18) * amount) / answer;
    expect(yieldAmount).equal(expectedYield);
  });

  it("Should return the correct yieldToUnderlying", async function () {
    const amount = ethers.parseUnits("10", "ether");
    const answer = ethers.parseUnits("5", "ether");
    await mockV3Aggregator.updateAnswer(answer);
    const underlyingAmount = await uniswapV3Strategy.yieldToUnderlying(amount);

    // check _calculateYieldToUnderlyingAmount inside uniswapV3 strategy
    const expectedunderlying = (amount * answer) / BigInt(10 ** 18);
    expect(underlyingAmount).equal(expectedunderlying);
  });

  it("Should return correct output applySlippageDepositExactInputSingle", async function () {
    const yieldAmount = ethers.parseUnits("10", "ether");
    const fact = ethers.parseUnits("95", 16);
    await uniswapV3Strategy.setMinReceivedAmountFactor(fact);
    const amountOutMinimum =
      await uniswapV3Strategy.applySlippageDepositExactInputSingle(yieldAmount);
    // check _applySlippageDepositExactInputSingle inside uniswapV3 strategy
    const expectedAmount = (fact * yieldAmount) / BigInt(10 ** 18);
    console.log("amountOutMinimum", amountOutMinimum);
    console.log("expectedAmount", expectedAmount);
  });

  it("Should return correct output applySlippageWithdrawExactOutputSingle", async function () {
    const yieldAmount = ethers.parseUnits("10", "ether");
    const fact = ethers.parseUnits("95", 16);
    await uniswapV3Strategy.setMinReceivedAmountFactor(fact);
    const amountOutMinimum =
      await uniswapV3Strategy.applySlippageWithdrawExactOutputSingle(
        yieldAmount,
      );

    // check _applySlippageWithdrawExactOutputSingle inside uniswapV3 strategy
    const expectedAmount = (BigInt(10 ** 18) * yieldAmount) / fact;
    expect(amountOutMinimum).equal(expectedAmount);
    expect(amountOutMinimum).gt(yieldAmount);
  });

  it("Should return the depositCalldata ", async function () {
    const amount = ethers.parseUnits("19", "ether");
    const { cdata, target } = await uniswapV3Strategy.depositCalldata(amount);

    expect(target).eq(uniswapRouterMockAddress);
    expect(cdata.startsWith("0x414bf389")).true;
  });

  it("Should deposit into the strategy", async function () {
    // Deposit into weth
    const amount = ethers.parseUnits("10", "ether");
    await weth.deposit({ value: amount });
    await weth.transfer(starknetPoolingManagerAddress, amount);

    // Get poolingManager signer
    await impersonateAccount(starknetPoolingManagerAddress);
    await admin.sendTransaction({
      value: ethers.parseEther("1"),
      to: starknetPoolingManagerAddress,
    });
    const poolingManagerSigner = await ethers.getSigner(
      starknetPoolingManagerAddress,
    );

    await weth
      .connect(poolingManagerSigner)
      .approve(uniswapRouterMockAddress, amount);
    const { target, cdata } = await uniswapV3Strategy
      .connect(poolingManagerSigner)
      .depositCalldata(amount);

    const balancewstEthBefore = await wstEth.balanceOf(
      uniswapV3StrategyAddress,
    );
    const balancewEthBefore = await weth.balanceOf(
      starknetPoolingManagerAddress,
    );
    expect(balancewstEthBefore).eq(0);
    expect(balancewEthBefore).eq(amount);

    await poolingManagerSigner.sendTransaction({
      to: target,
      data: cdata,
    });

    const balancewstEthAfter = await wstEth.balanceOf(uniswapV3StrategyAddress);
    const balancewEthAfter = await weth.balanceOf(
      starknetPoolingManagerAddress,
    );

    const expectedYiedl = await uniswapV3Strategy.underlyingToYield(amount);
    expect(balancewstEthAfter - balancewstEthBefore).eq(expectedYiedl);
    expect(balancewEthAfter).eq(0);
  });

  it("Should deposit into the strategy many", async function () {
    for (let i = 0; i < 5; i++) {
      // Deposit into weth
      const amount = ethers.parseUnits("1", "ether");
      await weth.deposit({ value: amount });
      await weth.transfer(starknetPoolingManagerAddress, amount);

      // Get poolingManager signer
      await impersonateAccount(starknetPoolingManagerAddress);
      await admin.sendTransaction({
        value: ethers.parseEther("1"),
        to: starknetPoolingManagerAddress,
      });
      const poolingManagerSigner = await ethers.getSigner(
        starknetPoolingManagerAddress,
      );

      await weth
        .connect(poolingManagerSigner)
        .approve(uniswapRouterMockAddress, amount);
      const { target, cdata } = await uniswapV3Strategy
        .connect(poolingManagerSigner)
        .depositCalldata(amount);

      const balancewstEthBefore = await wstEth.balanceOf(
        uniswapV3StrategyAddress,
      );
      const balancewEthBefore = await weth.balanceOf(
        starknetPoolingManagerAddress,
      );
      expect(balancewEthBefore).eq(amount);

      await poolingManagerSigner.sendTransaction({
        to: target,
        data: cdata,
      });

      const balancewstEthAfter = await wstEth.balanceOf(
        uniswapV3StrategyAddress,
      );

      const expectedYiedl = await uniswapV3Strategy.underlyingToYield(amount);
      expect(balancewstEthAfter - balancewstEthBefore).eq(expectedYiedl);
    }
  });

  it("Should return different NAV", async function () {
    // Deposit into weth
    const amount = ethers.parseUnits("1", "ether");
    await weth.deposit({ value: amount });
    await weth.transfer(starknetPoolingManagerAddress, amount);

    // Get poolingManager signer
    await impersonateAccount(starknetPoolingManagerAddress);
    await admin.sendTransaction({
      value: ethers.parseEther("1"),
      to: starknetPoolingManagerAddress,
    });
    const poolingManagerSigner = await ethers.getSigner(
      starknetPoolingManagerAddress,
    );

    await weth
      .connect(poolingManagerSigner)
      .approve(uniswapRouterMockAddress, amount);
    const { target, cdata } = await uniswapV3Strategy
      .connect(poolingManagerSigner)
      .depositCalldata(amount);

    const balancewstEthBefore = await wstEth.balanceOf(
      uniswapV3StrategyAddress,
    );
    const balancewEthBefore = await weth.balanceOf(
      starknetPoolingManagerAddress,
    );
    expect(balancewEthBefore).eq(amount);

    await poolingManagerSigner.sendTransaction({ to: target, data: cdata });

    const balancewstEthAfter = await wstEth.balanceOf(uniswapV3StrategyAddress);

    const expectedYiedl = await uniswapV3Strategy.underlyingToYield(amount);
    expect(balancewstEthAfter - balancewstEthBefore).eq(expectedYiedl);

    const nav = await uniswapV3Strategy.nav();
    await mockV3Aggregator.updateAnswer("1000000000000000000");
    const navAfter = await uniswapV3Strategy.nav();
    expect(nav).not.equal(navAfter);
  });

  it("Should withdraw from strategy", async function () {
    const poolingManagerSigner = await getPoolingManagerSigner();

    // Deposit into weth
    const amount = ethers.parseUnits("1", "ether");
    await weth.deposit({ value: amount });
    await weth.transfer(starknetPoolingManagerAddress, amount);

    // Deposit
    await weth
      .connect(poolingManagerSigner)
      .approve(uniswapRouterMockAddress, amount);
    const { target, cdata } = await uniswapV3Strategy
      .connect(poolingManagerSigner)
      .depositCalldata(amount);
    await poolingManagerSigner.sendTransaction({ to: target, data: cdata });

    // Withdraw
    const wstEthBefore = await wstEth.balanceOf(uniswapV3StrategyAddress);
    const wethBefore = await weth.balanceOf(starknetPoolingManagerAddress);
    const expectedYield = await uniswapV3Strategy.underlyingToYield(amount);

    await uniswapV3Strategy.connect(poolingManagerSigner).withdraw(amount);

    const wstEthAfter = await wstEth.balanceOf(uniswapV3StrategyAddress);
    const wethAfter = await weth.balanceOf(starknetPoolingManagerAddress);
    expect(wstEthBefore - wstEthAfter).eq(expectedYield);
    expect(wethAfter - wethBefore).eq(amount);
  });

  it("Should withdraw from strategy, many times", async function () {
    const poolingManagerSigner = await getPoolingManagerSigner();

    // Deposit into weth
    const amount = ethers.parseUnits("1", "ether");
    await weth.deposit({ value: amount });
    await weth.transfer(starknetPoolingManagerAddress, amount);

    // Deposit
    await weth
      .connect(poolingManagerSigner)
      .approve(uniswapRouterMockAddress, amount);
    const { target, cdata } = await uniswapV3Strategy
      .connect(poolingManagerSigner)
      .depositCalldata(amount);
    await poolingManagerSigner.sendTransaction({ to: target, data: cdata });

    const amountWithdraw = ethers.parseUnits("0.25", "ether");
    // Try to withdraw 4 times 0.25 ETH * 4 = 1 ETH
    for (let i = 0; i < 4; i++) {
      // Withdraw
      const wstEthBefore = await wstEth.balanceOf(uniswapV3StrategyAddress);
      const wethBefore = await weth.balanceOf(starknetPoolingManagerAddress);
      const expectedYield =
        await uniswapV3Strategy.underlyingToYield(amountWithdraw);

      await uniswapV3Strategy
        .connect(poolingManagerSigner)
        .withdraw(amountWithdraw);

      const wstEthAfter = await wstEth.balanceOf(uniswapV3StrategyAddress);
      const wethAfter = await weth.balanceOf(starknetPoolingManagerAddress);
      expect(wstEthBefore - wstEthAfter).eq(expectedYield);
      expect(wethAfter - wethBefore).eq(amountWithdraw);
    }
  });

  it("test action withdraw revert slippage", async function () {
    const yieldAmount = ethers.parseUnits("5", "ether");
    wstEth.transfer(uniswapV3StrategyAddress, yieldAmount);
  });

  const getPoolingManagerSigner = async () => {
    // Get poolingManager signer
    await impersonateAccount(starknetPoolingManagerAddress);
    await admin.sendTransaction({
      value: ethers.parseEther("1"),
      to: starknetPoolingManagerAddress,
    });
    return await ethers.getSigner(starknetPoolingManagerAddress);
  };
});
