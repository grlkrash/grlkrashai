import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
  
  console.log("🔍 Testing MORE token functions...");

  // Get the contract instance
  const token = await ethers.getContractAt("MOREToken", contractAddress);
  const [signer] = await ethers.getSigners();

  console.log("\n📊 Token Information:");
  console.log("====================");
  const name = await token.name();
  const symbol = await token.symbol();
  const totalSupply = await token.TOTAL_SUPPLY();
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Total Supply: ${ethers.formatUnits(totalSupply, 18)} ${symbol}`);

  console.log("\n💰 Balance Information:");
  console.log("====================");
  const balance = await token.balanceOf(signer.address);
  console.log(`Your Balance: ${ethers.formatUnits(balance, 18)} ${symbol}`);

  console.log("\n🔄 Vesting Information:");
  console.log("====================");
  const vestingActive = await token.isVestingActive();
  const remainingVested = await token.remainingVestedAmount();
  const nextDistribution = await token.nextDistributionTime();
  console.log(`Vesting Active: ${vestingActive}`);
  console.log(`Remaining Vested Amount: ${ethers.formatUnits(remainingVested, 18)} ${symbol}`);
  console.log(`Next Distribution Time: ${new Date(Number(nextDistribution) * 1000).toLocaleString()}`);

  console.log("\n🌊 Circulation Status:");
  console.log("====================");
  const [enabled, pool, amount] = await token.getCirculationStatus();
  console.log(`Circulation Enabled: ${enabled}`);
  console.log(`Liquidity Pool: ${pool}`);
  console.log(`Circulation Amount: ${ethers.formatUnits(amount, 18)} ${symbol}`);

  // Test transfer (small amount)
  if (balance > 0n) {
    console.log("\n💸 Testing Transfer:");
    console.log("====================");
    const transferAmount = ethers.parseUnits("1", 18); // 1 token
    try {
      const tx = await token.transfer(contractAddress, transferAmount);
      await tx.wait();
      console.log(`✅ Successfully transferred 1 ${symbol} to ${contractAddress}`);
      
      const newBalance = await token.balanceOf(signer.address);
      console.log(`New Balance: ${ethers.formatUnits(newBalance, 18)} ${symbol}`);
    } catch (e: any) {
      console.log(`❌ Transfer failed: ${e.message}`);
    }
  } else {
    console.log("\n⚠️ Balance too low to test transfer");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Testing failed:", error);
    process.exit(1);
  }); 