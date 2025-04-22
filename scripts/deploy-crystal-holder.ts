import { ethers } from "hardhat";

async function main() {
    console.log("🔮 Deploying Crystal Holder System...");

    // Contract addresses on Base Sepolia
    const registryAddress = "0x02101dfB77FDE026414827Fdc604ddAF224F0921";    // ERC6551 Registry
    const implementationAddress = "0x2d25602551487c3f3354dd80d76d54383a243358"; // ERC6551 Account Implementation
    const memoryCrystalAddress = process.env.MEMORY_CRYSTAL_ADDRESS;

    if (!memoryCrystalAddress) {
        throw new Error("MEMORY_CRYSTAL_ADDRESS not set in environment");
    }

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from: ${deployer.address}`);

    try {
        // Deploy CrystalHolder
        console.log("\n1. Deploying CrystalHolder...");
        const CrystalHolder = await ethers.getContractFactory("CrystalHolder");
        const crystalHolder = await CrystalHolder.deploy(
            registryAddress,
            implementationAddress,
            memoryCrystalAddress
        );
        await crystalHolder.waitForDeployment();
        
        const holderAddress = await crystalHolder.getAddress();
        console.log(`CrystalHolder deployed to: ${holderAddress}`);

        // Test holder creation
        console.log("\n2. Testing holder creation...");
        const createTx = await crystalHolder.getOrCreateHolder();
        const receipt = await createTx.wait();
        
        // Get holder ID from event
        const transferEvent = receipt.logs.find(
            (log: any) => log.eventName === "Transfer"
        );
        const holderId = transferEvent.args[2];
        console.log(`Created holder with ID: ${holderId}`);

        // Get TBA address
        const tbaAddress = await crystalHolder.getAccount(holderId);
        console.log(`Token Bound Account address: ${tbaAddress}`);

        // Print summary
        console.log("\n✨ Deployment Summary");
        console.log("===================");
        console.log(`CrystalHolder: ${holderAddress}`);
        console.log(`Registry: ${registryAddress}`);
        console.log(`Implementation: ${implementationAddress}`);
        console.log(`MemoryCrystal: ${memoryCrystalAddress}`);
        
        // Verification command
        console.log("\n🔍 Verify contract:");
        console.log(`npx hardhat verify --network base-sepolia ${holderAddress} "${registryAddress}" "${implementationAddress}" "${memoryCrystalAddress}"`);

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 