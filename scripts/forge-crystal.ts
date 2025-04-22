import { ethers } from "hardhat";
import { retry } from "../utils/retry";
import { Contract } from "ethers";

async function main() {
    console.log("🔮 Testing Memory Crystal Forging...");

    const memoryCrystal = await loadContract();
    const signer = await getSigner();
    await checkBalances(signer, memoryCrystal);
    await forgeCrystal(memoryCrystal, signer);
}

async function loadContract(): Promise<Contract> {
    const address = process.env.MEMORY_CRYSTAL_ADDRESS;
    if (!address) throw new Error("MEMORY_CRYSTAL_ADDRESS not set");
    return await ethers.getContractAt("MemoryCrystal", address);
}

async function getSigner() {
    const [signer] = await ethers.getSigners();
    console.log(`Using signer: ${signer.address}`);
    return signer;
}

async function checkBalances(signer: any, contract: Contract) {
    const ethBalance = await signer.provider.getBalance(signer.address);
    console.log(`ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
    
    const costs = await Promise.all([0,1,2].map(level => 
        contract.getMintCost(level)
    ));
    
    console.log("\nMinting costs:",
        costs.map((cost, i) => 
            `\n- ${['BASIC', 'PREMIUM', 'ELITE'][i]}: ${ethers.formatEther(cost)} ETH`
        ).join('')
    );
}

async function forgeCrystal(contract: Contract, signer: any) {
    const level = 0; // BASIC
    console.log("\n🔨 Forging BASIC crystal...");
    
    try {
        const cost = await contract.getMintCost(level);
        const gasLimit = await contract.forgeCrystal.estimateGas(level, { value: cost });
        const adjustedGasLimit = Math.ceil(gasLimit.toString() * 1.2);
        
        const tx = await retry(3, async () => {
            const nonce = await signer.getNonce();
            return await contract.forgeCrystal(level, { 
                value: cost,
                gasLimit: adjustedGasLimit,
                nonce
            });
        });

        console.log("Waiting for confirmation...");
        const receipt = await tx.wait();
        
        const event = receipt.logs.find((log: any) => 
            log.fragment?.name === "CrystalForged"
        );
        
        if (!event) throw new Error("CrystalForged event not found");
        
        const tokenId = event.args?.tokenId;
        console.log(`✅ Crystal forged! Token ID: ${tokenId}`);
        
        const crystal = await contract.crystals(tokenId);
        console.log("\nCrystal details:",
            `\n- Access Level: ${crystal.accessLevel}`,
            `\n- Content URI: ${crystal.contentURI}`,
            `\n- Timestamp: ${new Date(Number(crystal.mintTimestamp) * 1000)}`
        );
    } catch (e: any) {
        console.error("❌ Forge failed:", e.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
}); 