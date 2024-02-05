import { ethers } from 'hardhat';
import { networkAddresses } from './config';

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance0ETH = await ethers.provider.getBalance(deployer.address);
    console.log('User Address:', deployer.address);
    console.log('User Balance:', ethers.formatEther(balance0ETH));
    const addresses = networkAddresses['mainnet'];
    const poolingManager = await ethers.getContractAt('StarknetPoolingManager', addresses.l1PoolingManager);
    try {
        console.log('Registering strategies');
        // await poolingManager.registerStrategy(addresses.uniStrategy);
        await poolingManager.registerStrategy(addresses.sdaiStrategy);
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
