import { ethers } from "hardhat";
import { MOREToken } from "../typechain-types";
import chalk from "chalk";

async function main() {
  console.log(chalk.yellow("\nStarting MOREToken initialization..."));

  try {
    // Get contract instance
    const contractAddress = process.env.TOKEN_ADDRESS;
    if (!contractAddress) {
      throw new Error("TOKEN_ADDRESS not set in environment");
    }
    
    console.log(chalk.blue("Loading contract at:", contractAddress));
    const moreToken = await ethers.getContractAt("MOREToken", contractAddress);

    // Initialize contract
    console.log(chalk.yellow("\nInitializing contract..."));
    const tx = await moreToken.initialize();
    console.log(chalk.gray("Transaction hash:", tx.hash));
    
    // Wait for confirmation
    console.log(chalk.yellow("\nWaiting for confirmation..."));
    const receipt = await tx.wait();
    
    // Log events
    console.log(chalk.green("\nInitialization complete!"));
    console.log(chalk.cyan("\nDistribution Events:"));
    
    const events = receipt.logs
      .filter(log => log.eventName === "InitialDistribution")
      .map(log => ({
        recipient: log.args[0],
        amount: ethers.formatEther(log.args[1]),
        allocation: log.args[2]
      }));
    
    events.forEach(event => {
      console.log(chalk.white("\nAllocation:", event.allocation));
      console.log(chalk.gray("Recipient:", event.recipient));
      console.log(chalk.gray("Amount:", event.amount, "MORE"));
    });

    // Verify state
    console.log(chalk.yellow("\nVerifying contract state..."));
    
    const isInitialized = await moreToken.isInitialized();
    console.log(chalk.gray("Initialized:", isInitialized));
    
    const vestingActive = await moreToken.isVestingActive();
    console.log(chalk.gray("Vesting Active:", vestingActive));
    
    const remainingVested = await moreToken.remainingVestedAmount();
    console.log(chalk.gray("Remaining Vested:", ethers.formatEther(remainingVested), "MORE"));

    console.log(chalk.green("\nContract successfully initialized and verified!"));
    console.log(chalk.yellow("\nNext steps:"));
    console.log(chalk.white("1. Deploy liquidity pool contract"));
    console.log(chalk.white("2. Run enable-circulation.ts with pool address"));
    console.log(chalk.white("3. Start monitoring dashboard"));

  } catch (error) {
    console.error(chalk.red("\nInitialization failed:"), error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 