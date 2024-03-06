import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networkAddresses } from '../scripts/config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const network: string = hre.network.name;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
    const addresses = network == 'mainnet' ? networkAddresses['mainnet'] : networkAddresses['goerli'];

    // const stethPriceFeedDeployment = await deploy(`stethPriceFeed`, {
    //     from: deployer,
    //     log: true,
    //     contract: 'MockV3Aggregator',
    //     args: [18, "999699900733487000"],
    // });
    // console.log(`steth PriceFeed contract deployed to ${stethPriceFeedDeployment.address}`);

    // const steth_eth_pricefeed = "0x86392dc19c0b719886221c78ab11eb8cf5c52812"
    // const wstethPriceFeedDeployment = await deploy(`wstethPriceFeed`, {
    //     from: deployer,
    //     log: true,
    //     contract: 'AAVECompatWstETHToETHPriceFeed',
    //     args: [steth_eth_pricefeed, addresses.wsteth],
    // });
    // console.log(`Wsteth PriceFeed contract deployed to ${wstethPriceFeedDeployment.address}`);
};
export default func;
func.tags = ['WstethPricefeed'];
