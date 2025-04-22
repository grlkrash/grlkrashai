import { ethers } from "hardhat";

async function main() {
  const { default: chalk } = await import("chalk");
  console.log(chalk.blue("📊 Estimating gas costs for MORE token deployment..."));

  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  console.log(chalk.yellow(`🔑 Estimating for account: ${deployer.address}`));

  // Get current gas price
  const gasPrice = await ethers.provider.getFeeData();
  console.log(chalk.cyan("\nCurrent Gas Prices (in Gwei):"));
  console.log(chalk.white(`Max Fee: ${ethers.formatUnits(gasPrice.maxFeePerGas || 0n, "gwei")}`));
  console.log(chalk.white(`Max Priority Fee: ${ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0n, "gwei")}`));

  // Estimate deployment gas
  console.log(chalk.blue("\n🔎 Estimating deployment gas..."));
  const MOREToken = await ethers.getContractFactory("MOREToken");
  const deployTx = await MOREToken.getDeployTransaction();
  const deploymentGas = await ethers.provider.estimateGas({
    data: deployTx.data,
    from: deployer.address
  });
  console.log(chalk.white(`Deployment Gas: ${deploymentGas.toString()} units`));

  // Create instance for initialization estimate
  const token = await MOREToken.deploy();
  await token.waitForDeployment();

  // Estimate initialization gas
  console.log(chalk.blue("\n🔎 Estimating initialization gas..."));
  const initGas = await token.initialize.estimateGas();
  console.log(chalk.white(`Initialization Gas: ${initGas.toString()} units`));

  // Calculate total costs
  const totalGas = deploymentGas + initGas;
  const maxFeePerGas = gasPrice.maxFeePerGas || 0n;
  const maxGasCost = Number(ethers.formatUnits(totalGas * maxFeePerGas, "ether"));
  const ethPrice = 2500; // Approximate ETH price in USD
  
  console.log(chalk.cyan("\n💰 Cost Estimates:"));
  console.log(chalk.cyan("================"));
  console.log(chalk.white(`Total Gas Units: ${totalGas.toString()}`));
  console.log(chalk.white(`Max Cost in ETH: ${maxGasCost.toFixed(6)} ETH`));
  console.log(chalk.white(`Max Cost in USD: $${(maxGasCost * ethPrice).toFixed(2)}`));
  
  console.log(chalk.yellow("\n⚠️ Note: Actual costs may vary based on network conditions"));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Estimation failed:", error);
    process.exit(1);
  }); 