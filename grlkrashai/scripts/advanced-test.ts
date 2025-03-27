import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
  console.log("🔍 Testing MORE token advanced functions...");

  // Get the contract instance
  const token = await ethers.getContractAt("MOREToken", contractAddress);
  const [signer] = await ethers.getSigners();

  // 1. Test Emergency Controls (Pause/Unpause)
  console.log("\n🚨 Testing Emergency Controls:");
  console.log("============================");
  try {
    console.log("Pausing token transfers...");
    const pauseTx = await token.pause();
    await pauseTx.wait();
    console.log("✅ Token successfully paused");

    // Try a transfer while paused
    try {
      const transferAmount = ethers.parseUnits("1", 18);
      await token.transfer(contractAddress, transferAmount);
    } catch (e: any) {
      console.log("✅ Transfer correctly blocked while paused");
    }

    console.log("Unpausing token transfers...");
    const unpauseTx = await token.unpause();
    await unpauseTx.wait();
    console.log("✅ Token successfully unpaused");
  } catch (e: any) {
    console.log(`❌ Emergency control test failed: ${e.message}`);
  }

  // 2. Test Vesting Distribution
  console.log("\n🔄 Testing Vesting Distribution:");
  console.log("==============================");
  try {
    const beforeVested = await token.totalVestedAmount();
    console.log(`Vested amount before: ${ethers.formatUnits(beforeVested, 18)} MORE`);

    console.log("Triggering vesting distribution...");
    const vestTx = await token.distributeVestedTokens();
    await vestTx.wait();

    const afterVested = await token.totalVestedAmount();
    console.log(`Vested amount after: ${ethers.formatUnits(afterVested, 18)} MORE`);
    console.log(`✅ Successfully distributed ${ethers.formatUnits(afterVested - beforeVested, 18)} MORE tokens`);
  } catch (e: any) {
    console.log(`❌ Vesting distribution test failed: ${e.message}`);
  }

  // 3. Test Liquidity Pool Setup
  console.log("\n🌊 Testing Liquidity Pool Setup:");
  console.log("==============================");
  try {
    // For testing, we'll use a dummy contract address as the liquidity pool
    // In production, this should be a real DEX pool address
    const dummyPool = "0x0000000000000000000000000000000000000001";
    
    console.log(`Setting up liquidity pool at ${dummyPool}...`);
    const circulationTx = await token.enableCirculation(dummyPool);
    await circulationTx.wait();

    const [enabled, pool, amount] = await token.getCirculationStatus();
    console.log("✅ Circulation enabled successfully");
    console.log(`Liquidity Pool: ${pool}`);
    console.log(`Circulation Amount: ${ethers.formatUnits(amount, 18)} MORE`);
  } catch (e: any) {
    console.log(`❌ Liquidity pool setup failed: ${e.message}`);
  }

  // Final Status Check
  console.log("\n📊 Final Token Status:");
  console.log("====================");
  const balance = await token.balanceOf(signer.address);
  const [enabled, pool, amount] = await token.getCirculationStatus();
  const vestingActive = await token.isVestingActive();
  
  console.log(`Your Balance: ${ethers.formatUnits(balance, 18)} MORE`);
  console.log(`Circulation Enabled: ${enabled}`);
  console.log(`Vesting Active: ${vestingActive}`);
  console.log(`Next Distribution: ${new Date(Number(await token.nextDistributionTime()) * 1000).toLocaleString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Testing failed:", error);
    process.exit(1);
  }); 