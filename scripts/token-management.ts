import { ethers } from "hardhat";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";

config();

interface NetworkConfig {
  rpcUrl: string;
  privateKey: string;
}

async function loadNetworkConfig(network: string): Promise<NetworkConfig> {
  const configs: { [key: string]: NetworkConfig } = {
    mainnet: {
      rpcUrl: process.env.MAINNET_RPC_URL!,
      privateKey: process.env.MAINNET_PRIVATE_KEY!
    },
    testnet: {
      rpcUrl: process.env.TESTNET_RPC_URL!,
      privateKey: process.env.TESTNET_PRIVATE_KEY!
    }
  };

  const config = configs[network];
  if (!config) throw new Error(`Network ${network} not configured`);
  if (!config.rpcUrl || !config.privateKey) throw new Error(`Incomplete config for ${network}`);
  
  return config;
}

async function getWallet(network: string) {
  const config = await loadNetworkConfig(network);
  return new ethers.Wallet(
    config.privateKey,
    new ethers.JsonRpcProvider(config.rpcUrl)
  );
}

async function validateAddress(address: string, type: string) {
  if (!ethers.isAddress(address)) throw new Error(`Invalid ${type} address`);
  if (address === ethers.ZeroAddress) throw new Error(`${type} cannot be zero address`);
  const code = await ethers.provider.getCode(address);
  if (code === "0x" && type !== "deployer") throw new Error(`${type} must be a contract`);
  return true;
}

async function deployToken(network: string) {
  console.log(chalk.yellow("\nDeploying MORE token..."));
  const wallet = await getWallet(network);
  
  const factory = new ethers.ContractFactory(
    require('../artifacts/contracts/MOREToken.sol/MOREToken.json').abi,
    require('../artifacts/contracts/MOREToken.sol/MOREToken.json').bytecode,
    wallet
  );
  
  const token = await factory.deploy();
  await token.waitForDeployment();
  console.log(chalk.green(`Token deployed to: ${await token.getAddress()}`));
  return token;
}

async function enableCirculation(network: string, tokenAddress: string, poolAddress: string) {
  console.log(chalk.yellow("\nEnabling circulation..."));
  const wallet = await getWallet(network);
  
  const token = new ethers.Contract(
    tokenAddress,
    require('../artifacts/contracts/MOREToken.sol/MOREToken.json').abi,
    wallet
  );
  
  const tx = await token.enableCirculation(poolAddress);
  const receipt = await tx.wait();
  console.log(chalk.green("Circulation enabled successfully!"));
  return receipt;
}

async function setupLiquidity(network: string, tokenAddress: string, poolAddress: string, amount: string) {
  console.log(chalk.yellow("\nSetting up liquidity..."));
  const wallet = await getWallet(network);
  
  const pool = new ethers.Contract(
    poolAddress,
    require('../artifacts/contracts/MOREPool.sol/MOREPool.json').abi,
    wallet
  );
  
  const tx = await pool.addLiquidity({ value: ethers.parseEther(amount) });
  await tx.wait();
  console.log(chalk.green("Liquidity added successfully!"));
}

async function main() {
  const program = new Command();

  program
    .name("token-management")
    .description("MORE token management interface")
    .version("1.0.0")
    .option('-n, --network <network>', 'Network to operate on', 'testnet');

  program
    .command("deploy")
    .description("Deploy MORE token")
    .action(async (options) => {
      try {
        await deployToken(program.opts().network);
      } catch (error) {
        console.error(chalk.red("Deployment failed:"), error);
        process.exit(1);
      }
    });

  program
    .command("enable-circulation")
    .description("Enable token circulation")
    .requiredOption("-t, --token <address>", "Token address")
    .requiredOption("-p, --pool <address>", "Pool address")
    .action(async (options) => {
      try {
        await validateAddress(options.token, "token");
        await validateAddress(options.pool, "pool");
        await enableCirculation(program.opts().network, options.token, options.pool);
      } catch (error) {
        console.error(chalk.red("Circulation enablement failed:"), error);
        process.exit(1);
      }
    });

  program
    .command("setup-liquidity")
    .description("Setup initial liquidity")
    .requiredOption("-t, --token <address>", "Token address")
    .requiredOption("-p, --pool <address>", "Pool address")
    .option("-a, --amount <ether>", "ETH amount", "0.001")
    .action(async (options) => {
      try {
        await validateAddress(options.token, "token");
        await validateAddress(options.pool, "pool");
        await setupLiquidity(program.opts().network, options.token, options.pool, options.amount);
      } catch (error) {
        console.error(chalk.red("Liquidity setup failed:"), error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

main(); 