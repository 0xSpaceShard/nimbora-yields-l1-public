import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // const { deployments, getNamedAccounts } = hre;
    // const { deployer } = await getNamedAccounts();
    // const { deploy } = deployments;
    // const weth = await deploy(`Weth`, {
    //     from: deployer,
    //     log: true,
    //     contract: 'WETH9',
    //     args: [],
    // });
    // console.log(`Weth contract deployed to ${weth.address}`);
};
export default func;
func.tags = ['Weth'];
