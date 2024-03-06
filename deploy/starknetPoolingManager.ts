import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networkAddresses } from '../scripts/config';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy, get } = deployments;
    const network: string = hre.network.name;
    const addresses = network == 'mainnet' ? networkAddresses['mainnet'] : networkAddresses['goerli'];

    const balance = await hre.ethers.provider.getBalance(deployer);
    console.log('deployer', deployer);
    console.log('balance', balance);

    const starknetPoolingManagerDeployment = await deploy('StarknetPoolingManager', {
        from: deployer,
        log: true,
        contract: 'StarknetPoolingManager',
        proxy: {
            proxyContract: 'OpenZeppelinTransparentProxy',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [
                        deployer,
                        addresses.l2PoolingManager,
                        addresses.starknetCore,
                        addresses.relayer,
                        addresses.ethBridge,
                        addresses.weth,
                    ],
                },
            },
        },
    });
    console.log(`Pooling manager contract deployed at ${starknetPoolingManagerDeployment.address}`);
};

export default func;
func.tags = ['StarknetPoolingManager'];
