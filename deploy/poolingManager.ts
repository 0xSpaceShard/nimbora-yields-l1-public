import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networkAddresses } from '../scripts/config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy, get } = deployments;
    const network: string = hre.network.name;
    const addresses = network == 'mainnet' ? networkAddresses['mainnet'] : networkAddresses['goerli'];

    const poolingManagerDeployment = await deploy('PoolingManager', {
        from: deployer,
        log: true,
        contract: 'PoolingManager',
        proxy: {
            proxyContract: 'OpenZeppelinTransparentProxy',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [
                        deployer, addresses.l2PoolingManager, addresses.starknetCore, addresses.relayer, addresses.ethBridge, addresses.weth
                    ],
                },
            },
        },
    });

    console.log(`Pooling manager contract deployed at ${poolingManagerDeployment.address}`);
};

export default func;
func.tags = ['PoolingManager'];
