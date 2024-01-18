
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networkAddresses } from '../scripts/config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
    const network: string = hre.network.name;
    const addresses = network == 'mainnet' ? networkAddresses['mainnet'] : networkAddresses['goerli'];
    const savingDaiTokenDeployment = await deploy(`SavingDaiToken`, {
        from: deployer,
        log: true,
        contract: 'ERC4626Mock',
        args: [addresses.dai],
    });
    console.log(`SavingDaiToken contract deployed to ${savingDaiTokenDeployment.address}`);

}
export default func;
func.tags = ['SavingDaiToken'];

