import { ethers } from "hardhat";

// Base Swap V2 Factory on Base Sepolia
const FACTORY_ADDRESS = "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// Base Swap Factory ABI (minimal)
const FACTORY_ABI = [
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

async function main() {
  const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
  console.log("🏊‍♂️ Setting up Base Swap liquidity pool...");

  // Get contract instances
  const [signer] = await ethers.getSigners();
  console.log(`Using signer address: ${signer.address}`);
  
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
  const moreToken = await ethers.getContractAt("MOREToken", moreTokenAddress);

  console.log("\n📝 Contract Information:");
  console.log("=======================");
  console.log(`MORE Token: ${moreTokenAddress}`);
  console.log(`Factory: ${FACTORY_ADDRESS}`);
  console.log(`WETH: ${WETH_ADDRESS}`);

  // Check if pair exists
  console.log("\n🔍 Checking for existing pair...");
  try {
    const existingPair = await factory.getPair(moreTokenAddress, WETH_ADDRESS);
    
    if (existingPair === "0x0000000000000000000000000000000000000000") {
      console.log("No pair found. Creating new pair...");
      const tx = await factory.createPair(moreTokenAddress, WETH_ADDRESS);
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      
      // Get pair address from event logs
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id("PairCreated(address,address,address,uint256)")
      );
      
      if (event) {
        const iface = new ethers.Interface(["event PairCreated(address indexed token0, address indexed token1, address pair, uint)"]);
        const parsed = iface.parseLog(event);
        console.log(`✅ Pair created at: ${parsed?.args.pair}`);
      }
    } else {
      console.log(`Found existing pair at: ${existingPair}`);
    }

    // Enable circulation with the factory address
    console.log("\n🌊 Enabling circulation...");
    const circulationTx = await moreToken.enableCirculation(FACTORY_ADDRESS);
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
  } catch (e: any) {
    console.error("❌ Operation failed:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }); 