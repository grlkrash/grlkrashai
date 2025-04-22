import { ethers } from "hardhat";
import { MOREToken } from "../typechain-types";

async function monitorEvents(contract: MOREToken) {
  console.log("\nMonitoring events...");
  
  contract.on("EmergencyPaused", (pauser) => {
    console.log(`🚨 Contract PAUSED by ${pauser}`);
    console.log("- All transfers are blocked");
    console.log("- Vesting distributions suspended");
    console.log("- Circulation enabling blocked");
  });

  contract.on("EmergencyUnpaused", (unpauser) => {
    console.log(`✅ Contract UNPAUSED by ${unpauser}`);
    console.log("- Normal operations resumed");
  });

  contract.on("VestingDistribution", (recipient, amount) => {
    console.log(`📊 Vesting Distribution:`);
    console.log(`- Recipient: ${recipient}`);
    console.log(`- Amount: ${ethers.formatEther(amount)} MORE`);
  });

  contract.on("Transfer", (from, to, amount) => {
    console.log(`💸 Transfer:`);
    console.log(`- From: ${from}`);
    console.log(`- To: ${to}`);
    console.log(`- Amount: ${ethers.formatEther(amount)} MORE`);
  });
}

async function validateState(contract: MOREToken) {
  console.log("\nValidating contract state...");
  
  const isPaused = await contract.paused();
  console.log(`- Contract paused: ${isPaused}`);
  
  const isVestingActive = await contract.isVestingActive();
  console.log(`- Vesting active: ${isVestingActive}`);
  
  const [circulationEnabled, liquidityPool, circulationSupply] = await contract.getCirculationStatus();
  console.log(`- Circulation enabled: ${circulationEnabled}`);
  console.log(`- Liquidity pool: ${liquidityPool}`);
  console.log(`- Circulation supply: ${ethers.formatEther(circulationSupply)} MORE`);
  
  const remainingVested = await contract.remainingVestedAmount();
  console.log(`- Remaining vested amount: ${ethers.formatEther(remainingVested)} MORE`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Running emergency scenario with account:", deployer.address);

  // Get contract instance
  const moreToken = await ethers.getContractAt("MOREToken", process.env.TOKEN_ADDRESS || "");
  
  // Start monitoring events
  await monitorEvents(moreToken);
  
  try {
    // Initial state check
    console.log("\n1. Checking initial state");
    await validateState(moreToken);

    // Emergency pause
    console.log("\n2. Simulating emergency - Pausing contract");
    const pauseTx = await moreToken.pause();
    await pauseTx.wait();
    
    // Validate paused state
    console.log("\n3. Validating paused state");
    await validateState(moreToken);
    
    // Try operations while paused (these should fail)
    console.log("\n4. Testing restricted operations while paused");
    try {
      await moreToken.distributeVestedTokens();
    } catch (error) {
      console.log("✓ Vesting distribution blocked while paused");
    }
    
    // Wait for confirmation to unpause
    console.log("\n5. Emergency resolved - Unpausing contract");
    const unpauseTx = await moreToken.unpause();
    await unpauseTx.wait();
    
    // Final state validation
    console.log("\n6. Validating final state");
    await validateState(moreToken);
    
    console.log("\nEmergency scenario completed successfully");
    
  } catch (error) {
    console.error("Error in emergency scenario:", error);
    process.exitCode = 1;
  }
}

// Add command line arguments for different scenarios
const args = process.argv.slice(2);
if (args.includes("--monitor")) {
  console.log("Starting event monitor only...");
  const moreToken = await ethers.getContractAt("MOREToken", process.env.TOKEN_ADDRESS || "");
  await monitorEvents(moreToken);
  // Keep script running
  process.stdin.resume();
} else {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

// Helper function to format error messages
function formatError(error: any): string {
  if (error.reason) return error.reason;
  if (error.message) return error.message;
  return String(error);
} 