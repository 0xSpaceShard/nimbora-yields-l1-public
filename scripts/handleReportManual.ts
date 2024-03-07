import { ethers } from 'hardhat';
import { networkAddresses } from './config';
import { abi as INonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';
import { abi as IPoolABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'; // Import Pool ABI
import { RpcProvider, uint256 } from 'starknet';
import { BigNumber } from '@ethersproject/bignumber';
import { PoolingManagerBase } from '../typechain-types';

async function main() {
    const [deployer] = await ethers.getSigners();
    const l2Provider = new RpcProvider({
        nodeUrl: `https://starknet-${process.env.STARKNET_NETWORK}.infura.io/v3/${process.env.INFURA_API_KEY}`,
    });
    const addresses = networkAddresses['mainnet'];
    const poolingManager = await ethers.getContractAt('StarknetPoolingManager', addresses.l1PoolingManager);

    async function estimateL2GasCost(
        l1Address: string,
        l2Address: string,
        selector: string,
        payload: any,
    ): Promise<number> {
        const res = await l2Provider.estimateMessageFee({
            from_address: l1Address,
            to_address: l2Address,
            entry_point_selector: selector,
            payload,
        });
        return Number(res.overall_fee);
    }

    async function getMessageBridgeGasFee(
        l1Address: string,
        l2Address: string,
        epoch: string,
        hash: string,
    ): Promise<BigNumber> {
        const uEpoch = uint256.bnToUint256(epoch);
        const uHash = uint256.bnToUint256(hash);
        const gasCost = await estimateL2GasCost(l1Address, l2Address, 'handle_response', [
            uEpoch.low,
            uEpoch.high,
            uHash.low,
            uHash.high,
        ]);
        return BigNumber.from(gasCost);
    }

    const mainnetETHBridgeAddresses = {
        l1: '0xae0Ee0A63A2cE6BaeEFFE56e7714FB4EFE48D419',
        l2: '0x073314940630fd6dcda0d772d4c972c4e0a9946bef9dabf4ef84eda8ef542b82',
    };

    async function getEthBridgeGasFee(receiver: string, amount: BigNumber): Promise<BigNumber> {
        const { high, low } = uint256.bnToUint256(amount.toString());
        const ethAddresses = mainnetETHBridgeAddresses;
        const gasCost = await estimateL2GasCost(ethAddresses.l1, ethAddresses.l2, 'handle_deposit', [
            receiver.toLowerCase(),
            low,
            high,
        ]);
        return BigNumber.from(gasCost);
    }

    const bridgeDeposit: PoolingManagerBase.BridgeDataStruct = {
        bridge: '0x9F96FE0633EE838D0298E8B8980E6716BE81388D',
        amount: '13025213257487556511',
    };
    const parsedBridgeDeposits: PoolingManagerBase.BridgeDataStruct[] = [bridgeDeposit];

    const dataStrategy1: PoolingManagerBase.StrategyReportStruct = {
        l1Strategy: '0xAFA27423F3BB4C0337946DDCD1802588807571BF',
        data: '0',
        amount: '13025213257487556511',
        processed: true,
    };

    const dataStrategy2: PoolingManagerBase.StrategyReportStruct = {
        l1Strategy: '0xE5E2134E536FBFD7513094646E27C401BBB03EF6',
        data: '0',
        amount: '21945000000000000',
        processed: false,
    };

    const parsedDataStrategy: PoolingManagerBase.StrategyReportStruct[] = [dataStrategy1, dataStrategy2];
    const parsedBridgeWithdrawals: PoolingManagerBase.BridgeDataStruct[] = [];

    let l2BridgeEthFee = BigNumber.from(0);
    if (parsedBridgeWithdrawals.length > 0) {
        l2BridgeEthFee = await getEthBridgeGasFee(addresses.l2PoolingManager, BigNumber.from(1000000000));
    }

    const l2MessagingEthFee = await getMessageBridgeGasFee(
        addresses.l1PoolingManager,
        addresses.l2PoolingManager,
        '5',
        '0x0000000000000000000000000000000000000000000000000000000000001111',
    );

    try {
        await poolingManager.handleReport(
            '5',
            parsedBridgeDeposits,
            parsedDataStrategy,
            parsedBridgeWithdrawals,
            l2BridgeEthFee.toString(),
            l2MessagingEthFee.toString(),
            { value: l2BridgeEthFee.add(l2MessagingEthFee).toString() },
        );

        // const txData = await poolingManager.handleReport.populateTransaction(
        //     "5",
        //     parsedBridgeDeposits,
        //     parsedDataStrategy,
        //     parsedBridgeWithdrawals,
        //     l2BridgeEthFee.toString(),
        //     l2MessagingEthFee.toString(),
        //     { value: l2BridgeEthFee.add(l2MessagingEthFee).toString() }
        // );

        // // txData now contains the raw transaction data, including the data field which is the encoded function call
        // console.log('Raw transaction data:', txData);

        // // If you just want the encoded function call data:
        // console.log('Encoded function call:', txData.data);

        // console.log(poolingManager.RELAYER_ROLE)

        // console.log('Report handled success');
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
