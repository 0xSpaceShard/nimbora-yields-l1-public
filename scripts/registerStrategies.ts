import { ethers } from "hardhat";
import { networkAddresses } from "./config";

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance0ETH = await ethers.provider.getBalance(deployer.address);
    console.log("User Address:", deployer.address);
    console.log("User Balance:", ethers.formatEther(balance0ETH));
    const addresses = networkAddresses['mainnet'];
    const poolingManager = await ethers.getContractAt("PoolingManager", addresses.l1PoolingManager);
    try {
        console.log("Registering Uni strategies");
        await (poolingManager).registerStrategy(addresses.uniStrategy, addresses.weth, addresses.ethBridge);
        await (poolingManager).registerStrategy(addresses.sdaiStrategy, addresses.dai, addresses.daiBridge);
    } catch (error) {
        console.error("Error:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});


