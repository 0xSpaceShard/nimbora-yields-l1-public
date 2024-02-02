import { ethers } from 'hardhat';
import { abi as IUniswapV3FactoryABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import { networkAddresses } from './config';
import { abi as INonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance0ETH = await ethers.provider.getBalance(deployer.address);
    console.log('User Address:', deployer.address);
    console.log('User Balance:', ethers.formatEther(balance0ETH));

    const addresses = networkAddresses['goerli'];

    const uniswapV3Factory = new ethers.Contract(addresses.uniswapv3Factory, IUniswapV3FactoryABI, deployer);

    const fee = 3000;

    try {
        console.log('Deploying New Pool');
        await uniswapV3Factory.createPool(addresses.weth, addresses.wsteth, fee);
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
