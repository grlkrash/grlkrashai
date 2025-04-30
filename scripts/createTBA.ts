import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Setting up Token Bound Account...");

    // Contract addresses on Base Sepolia
    const registryAddress = "0x02101dfB77FDE026414827Fdc604ddAF224F0921";    // ERC6551 Registry
    const implementationAddress = "0x2d25602551487c3f3354dd80d76d54383a243358"; // ERC6551 Account Implementation
    const chainId = 84532; // Base Sepolia chain ID

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(`Using signer address: ${signer.address}`);

    try {
        // Deploy GRLKRASHSupporterNFT if not already deployed
        console.log("\n1. Deploying/Loading NFT Contract...");
        const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
        const baseURI = "ipfs://QmYourBaseURI/"; // Replace with your IPFS base URI
        
        const GRLKRASHSupporterNFT = await ethers.getContractFactory("GRLKRASHSupporterNFT");
        const nftContract = await GRLKRASHSupporterNFT.deploy(moreTokenAddress, baseURI);
        await nftContract.waitForDeployment();
        
        const nftAddress = await nftContract.getAddress();
        console.log(`NFT Contract deployed to: ${nftAddress}`);

        // Mint an NFT
        console.log("\n2. Minting NFT...");
        const mintTx = await nftContract.mintSupporterNFT(1); // Access level 1
        const mintReceipt = await mintTx.wait();
        
        // Get the token ID from the mint event
        const mintEvent = mintReceipt.logs.find(
            (log: any) => log.eventName === "Transfer"
        );
        const tokenId = mintEvent.args[2];
        console.log(`Minted NFT with ID: ${tokenId}`);

        // Create Token Bound Account
        console.log("\n3. Creating Token Bound Account...");
        const registry = await ethers.getContractAt("IERC6551Registry", registryAddress);
        
        const salt = 0n; // You can use different salts to create multiple accounts for the same NFT
        const initData = "0x"; // No initialization data needed

        const createAccountTx = await registry.createAccount(
            implementationAddress,
            chainId,
            nftAddress,
            tokenId,
            salt,
            initData
        );

        const receipt = await createAccountTx.wait();
        
        // Get the account address from the event
        const accountCreatedEvent = receipt.logs.find(
            (log: any) => log.eventName === "AccountCreated"
        );
        const accountAddress = accountCreatedEvent.args[0];

        console.log("\n✅ Token Bound Account created successfully!");
        console.log("===========================================");
        console.log(`NFT Contract: ${nftAddress}`);
        console.log(`Token ID: ${tokenId}`);
        console.log(`TBA Address: ${accountAddress}`);
        
        // Verify the account
        const account = await ethers.getContractAt("IERC6551Account", accountAddress);
        const [accChainId, accTokenContract, accTokenId] = await account.token();
        
        console.log("\n🔍 Account Verification:");
        console.log(`Chain ID: ${accChainId}`);
        console.log(`Token Contract: ${accTokenContract}`);
        console.log(`Token ID: ${accTokenId}`);
        console.log(`Owner: ${await account.owner()}`);

    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 