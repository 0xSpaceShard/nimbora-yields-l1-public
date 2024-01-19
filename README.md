# Enhanced Yield Dex L1 Documentation

## Introduction

Yield Dex L1 is an advanced platform designed to streamline and optimize Layer 2 (L2) financial requests and responses. It integrates various contracts to facilitate smooth operations between different blockchain layers and financial strategies. Below is an improved overview of its components:

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

- **Node.js**: Version 12 or later. [Download Node.js](https://nodejs.org/)
- **Package Manager**: Either Yarn or npm. [Install Yarn](https://yarnpkg.com/) | [Install npm](https://www.npmjs.com/get-npm)

## Installation Process

Follow these steps to set up the Yield Dex L1 environment:

1. **Install Dependencies**: Run the following command in your terminal to install the necessary packages:

   ```shell
   yarn
