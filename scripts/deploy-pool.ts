import { ethers } from "hardhat";

async function main() {
  const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
  const wethAddress = "0x4200000000000000000000000000000000000006";
  
  console.log("🏊‍♂️ Deploying MOREPool...");
  console.log("=======================");
  console.log(`MORE Token: ${moreTokenAddress}`);
  console.log(`WETH: ${wethAddress}`);

  // Deploy MOREPool
  const MOREPool = await ethers.getContractFactory("MOREPool");
  const pool = await MOREPool.deploy(moreTokenAddress, wethAddress);
  await pool.waitForDeployment();
  
  const poolAddress = await pool.getAddress();
  console.log(`✅ MOREPool deployed to: ${poolAddress}`);

  // Get the MORE token contract
  const moreToken = await ethers.getContractAt("MOREToken", moreTokenAddress);

  // Enable circulation with the pool address
  console.log("\n🌊 Enabling circulation...");
  try {
    const circulationTx = await moreToken.enableCirculation(poolAddress);
    console.log("Waiting for transaction confirmation...");
    await circulationTx.wait();
    console.log("✅ Circulation enabled successfully");

    // Verify final status
    const [enabled, pool, amount] = await moreToken.getCirculationStatus();
    console.log("\n📊 Final Status:");
    console.log("===============");
    console.log(`Circulation Enabled: ${enabled}`);
    console.log(`Liquidity Pool: ${pool}`);
    console.log(`Circulation Amount: ${ethers.formatUnits(amount, 18)} MORE`);

    console.log("\n🔄 Next steps:");
    console.log("1. Verify the MOREPool contract on Base Sepolia Explorer");
    console.log("2. Add initial liquidity by calling pool.addLiquidity() with ETH");
    console.log("3. Monitor the pool's liquidity status");
  } catch (e: any) {
    console.error("❌ Failed to enable circulation:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 