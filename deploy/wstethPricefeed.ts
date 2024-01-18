import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networkAddresses } from '../scripts/config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const network: string = hre.network.name;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
    const addresses = network == 'mainnet' ? networkAddresses['mainnet'] : networkAddresses['goerli'];

    const stethPriceFeedDeployment = await deploy(`stethPriceFeed`, {
        from: deployer,
        log: true,
        contract: 'MockV3Aggregator',
        args: [18, "999699900733487000"],
    });
    console.log(`steth PriceFeed contract deployed to ${stethPriceFeedDeployment.address}`);

    const wstethPriceFeedDeployment = await deploy(`wstethPriceFeed`, {
        from: deployer,
        log: true,
        contract: 'AAVECompatWstETHToETHPriceFeed',
        args: [stethPriceFeedDeployment.address, addresses.wsteth],
    });
    console.log(`Wsteth PriceFeed contract deployed to ${wstethPriceFeedDeployment.address}`);
}
export default func;
func.tags = ['WstethPricefeed'];
