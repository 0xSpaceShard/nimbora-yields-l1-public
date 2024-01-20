import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // const { deployments, getNamedAccounts } = hre;
    // const { deployer } = await getNamedAccounts();
    // const { deploy } = deployments;
    // const weth = await deploy(`Wsteth`, {
    //     from: deployer,
    //     log: true,
    //     contract: 'WstethMintable',
    //     args: ["1154006573395890053"],
    // });
    // console.log(`Wsteth contract deployed to ${weth.address}`);

}
export default func;
func.tags = ['Wsteth'];

