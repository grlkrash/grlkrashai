import { ethers } from "hardhat";

async function main() {
    console.log("🎵 Deploying GRLKRASH NFT Contracts...");

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from address: ${deployer.address}`);

    // Deploy Supporter NFT
    console.log("\n1. Deploying Supporter NFT Contract...");
    const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
    const baseURI = "ipfs://QmYourBaseURI/"; // Replace with your IPFS base URI

    const GRLKRASHSupporterNFT = await ethers.getContractFactory("GRLKRASHSupporterNFT");
    const supporterNFT = await GRLKRASHSupporterNFT.deploy(moreTokenAddress, baseURI);
    await supporterNFT.waitForDeployment();
    
    const supporterNFTAddress = await supporterNFT.getAddress();
    console.log(`✅ Supporter NFT deployed to: ${supporterNFTAddress}`);

    // Deploy Content NFT
    console.log("\n2. Deploying Content NFT Contract...");
    const GRLKRASHContentNFT = await ethers.getContractFactory("GRLKRASHContentNFT");
    const contentNFT = await GRLKRASHContentNFT.deploy(supporterNFTAddress);
    await contentNFT.waitForDeployment();
    
    const contentNFTAddress = await contentNFT.getAddress();
    console.log(`✅ Content NFT deployed to: ${contentNFTAddress}`);

    // Print Summary
    console.log("\n📝 Deployment Summary:");
    console.log("====================");
    console.log(`MORE Token: ${moreTokenAddress}`);
    console.log(`Supporter NFT: ${supporterNFTAddress}`);
    console.log(`Content NFT: ${contentNFTAddress}`);
    
    console.log("\n🔗 Verify contracts:");
    console.log(`npx hardhat verify --network base-sepolia ${supporterNFTAddress} "${moreTokenAddress}" "${baseURI}"`);
    console.log(`npx hardhat verify --network base-sepolia ${contentNFTAddress} "${supporterNFTAddress}"`);

    // Test minting (optional)
    console.log("\n🧪 Testing NFT functionality...");
    
    // Test Supporter NFT
    console.log("\nTesting Supporter NFT:");
    try {
        const approveTx = await (await ethers.getContractAt("MOREToken", moreTokenAddress))
            .approve(supporterNFTAddress, ethers.parseEther("1000"));
        await approveTx.wait();
        console.log("✅ MORE token approval successful");

        const mintTx = await supporterNFT.mintSupporterNFT(1);
        await mintTx.wait();
        console.log("✅ Supporter NFT minting successful");
    } catch (error: any) {
        console.error("❌ Supporter NFT test failed:", error.message);
    }

    // Test Content NFT
    console.log("\nTesting Content NFT:");
    try {
        const mintTx = await contentNFT.mintContent(
            deployer.address,
            0, // Music
            1, // Basic access level
            "ipfs://QmTestContent/music.mp3",
            "ipfs://QmTestContent/preview.mp3",
            true // AI-generated
        );
        await mintTx.wait();
        console.log("✅ Content NFT minting successful");
    } catch (error: any) {
        console.error("❌ Content NFT test failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 