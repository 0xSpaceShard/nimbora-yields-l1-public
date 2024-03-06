# Enhanced Yield Dex L1 Documentation

## Introduction

Yield Dex L1 is an advanced platform designed to streamline Layer 2 (L2) financial requests and responses. It integrates various contracts to facilitate smooth operations between different blockchain layers and financial strategies. Below is an improved overview of its components:

### Contracts Overview

1. **Pooling Manager (`PoolingManager.sol.sol`)**: Acts as a central hub, interfacing between bridges, StarkNet Core, and various financial strategies.
2. **Error Library (`lib/ErrorLib.sol`)**: A dedicated library containing comprehensive error naming conventions, enhancing error tracking and debugging.
3. **Messaging Library (`lib/Messaging.sol`)**: Provides utility functions for efficient communication with bridges and StarkNet core scripts.
4. **Strategy Base Contract (`strategies/StrategyBase.sol`)**: An abstract contract serving as a foundational template for developing custom financial strategies.
5. **Uniswap V3 Strategy (`uniswap/uniswapV3.sol`)**: Implements a strategy for swapping between an underlying asset and a yield token using Uniswap V3.
6. **Uniswap V3 with Different Decimals Strategy (`uniswap/uniswapV3DiffDecimals.sol`)**: A variant of the Uniswap V3 strategy, tailored for assets with differing decimal places.
7. **Saving Dai Strategy (`savingDai/savingDai.sol`)**: Manages deposits and withdrawals in a saving Dai contract, focusing on Dai stablecoin operations.

## Prerequisites

Ensure your system meets the following requirements:

-   **Node.js**: Version 12 or later. [Download Node.js](https://nodejs.org/)
-   **Package Manager**: Either Yarn or npm. [Install Yarn](https://yarnpkg.com/getting-started/install) | [Install npm](https://www.npmjs.com/get-npm)

## Installation Process

Follow these steps to set up the Yield Dex L1 environment:

**Install Dependencies**: Run the following command in your terminal to install the necessary packages:

```shell
yarn
```

## Compile

To compile the smart contracts, use the following command:

```shell
yarn hardhat compile
```

## Testing

Run the tests to verify the correct functioning of the contracts:

```shell
yarn hardhat test
```

## Running Scripts

To run deployment scripts or any other custom scripts, use:

```shell
yarn hardhat run <script-path> --network <chosen-network>
```

Scripts are located in the scipts folder.

## Deployment with Hardhat-Deploy

For deploying your contracts with Hardhat-Deploy, use the following command:

```shell
yarn hardhat deploy --network <chosen-network>
```

This command will execute the deployment scripts using Hardhat-Deploy, deploying your contracts to the specified network.

## Environment Setup

For deploying your contracts with Hardhat-Deploy, use the following command:

Before running the above commands, make sure to set up your environment variables. Change the .env.example file to .env and update the values file in the root directory of your project and fill it as per the example provided in .env.example :

```plaintext
INFURA_API_KEY=<Your Infura API Key>
PRIVATE_KEY=<Your private key>
NETWORK=<goerli or mainnet>
ETHERSCAN_URL=<Your Ethercan API Key>
```

INFURA_API_KEY: Your project ID from Infura, used to connect to Ethereum networks.
PRIVATE_KEY: Your Ethereum private key, used for transactions and contract deployment.
NETWORK: Desired Network, goerli or mainnet.
ETHERSCAN_URL: Your Etherscan API key, used to verify your contracts.

## Building a new strategy

You can build a new strategy building contract inheriting from StrategyBase.sol, you'll need to override virtual methods and add potential additional logic related to the strategy you want to build. 2 built strategies are proposed as exemples savingDai.sol and uniswapV3.sol, you can start building your own strategy with Template.sol in contracts/strategies.

## Deploying pooling manager and adding new strategies

1. Fill the scripts/config.ts with deployed pooling manager on L2 and deploy the l1 poolingManager using hardhat-deploy. Add this new deployed address in the config.ts

2. (only for goerli): deploy mock contract for your strategy if it is not deployed on this network like it's done with saving dai(cc deploy/savingDai.ts). Or setup the environment of the strategy if it exists like uniswapV3 where you need to deploy a new pool and add liquidity (cc scripts/deployUniPool.ts and scripts/initAndAddLiq.ts)

3. Add the required addresses in the config.ts for your strategy (uniV3Router for exemple)

4. Deploy the strategy using hardhat-deploy

5. Register the strategy in the pooling Manager running a script (cc scripts/registerStrategies.ts)
