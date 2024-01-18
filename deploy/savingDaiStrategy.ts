import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networkAddresses } from '../scripts/config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy, get } = deployments;
    const network: string = hre.network.name;
    const addresses = network == 'mainnet' ? networkAddresses['mainnet'] : networkAddresses['goerli'];
    const savingDaiStrategyDeployment = await deploy('SavingDaiStrategy', {
        from: deployer,
        log: true,
        contract: 'SavingDaiStrategy',
        proxy: {
            proxyContract: 'OpenZeppelinTransparentProxy',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [
                        addresses.l1PoolingManager, addresses.dai, addresses.sdai
                    ],
                },
            },
        },
    });

    console.log(`SavingDai strategy deployed at ${savingDaiStrategyDeployment.address}`);
};

export default func;
func.tags = ['PoolingManager'];
