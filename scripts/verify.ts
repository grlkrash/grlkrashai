import { run } from "hardhat";

async function main() {
  const contractAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
  
  console.log("🔍 Starting contract verification...");
  
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("✅ Contract verified successfully");
  } catch (e: any) {
    if (e.message?.includes("Already Verified")) {
      console.log("⚠️ Contract was already verified");
    } else {
      console.error("❌ Verification failed:", e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }); 