import { ethers } from "hardhat";

// Base Swap Router V2 on Base Sepolia
const ROUTER_ADDRESS = "0x0bf5c7ce4c0dbc7e0588c0d53c55e5336176988a";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const FEE_RECIPIENT = "0xfDC66caea47B17933561619a2DD326632Eda7884";

const ROUTER_ABI = [
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)"
];

async function main() {
    const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
    console.log("🧪 Testing MORE Token Trading Features...");

    // Get contract instances
    const [signer] = await ethers.getSigners();
    console.log(`Using signer address: ${signer.address}`);

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const moreToken = await ethers.getContractAt("MOREToken", moreTokenAddress);
    const morePool = await ethers.getContractAt("MOREPool", await moreToken.getCirculationStatus().then(result => result[1]));

    // 1. Test Trading
    console.log("\n🔄 Testing Swap ETH -> MORE...");
    const swapAmount = ethers.parseEther("0.001"); // Swap 0.001 ETH (smaller amount for testing)
    try {
        // Get expected output amount
        const amounts = await router.getAmountsOut(
            swapAmount,
            [WETH_ADDRESS, moreTokenAddress]
        );
        const expectedMoreAmount = amounts[1];
        console.log(`Expected output: ${ethers.formatEther(expectedMoreAmount)} MORE`);

        // Execute swap
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0, // Accept any amount of tokens (due to price impact)
            [WETH_ADDRESS, moreTokenAddress],
            signer.address,
            deadline,
            { value: swapAmount }
        );
        console.log("Waiting for swap confirmation...");
        await tx.wait();
        console.log("✅ Swap successful!");

        // Check new balance
        const moreBalance = await moreToken.balanceOf(signer.address);
        console.log(`New MORE balance: ${ethers.formatEther(moreBalance)} MORE`);
    } catch (e: any) {
        console.error("❌ Swap failed:", e.message);
    }

    // 2. DEX Aggregator Info
    console.log("\n📊 DEX Aggregator Information:");
    console.log("=============================");
    console.log("Token Information for Aggregators:");
    console.log(`- Token Address: ${moreTokenAddress}`);
    console.log(`- Pool Address: ${await morePool.getAddress()}`);
    console.log(`- Base Pair: WETH (${WETH_ADDRESS})`);
    console.log(`- Trading Fee: 0.3%`);
    
    try {
        const [reserve0, reserve1] = await morePool.getReserves();
        console.log("\nPool Liquidity:");
        console.log(`- MORE Reserve: ${ethers.formatEther(reserve0)} MORE`);
        console.log(`- ETH Reserve: ${ethers.formatEther(reserve1)} ETH`);
    } catch (e: any) {
        console.error("❌ Failed to get reserves:", e.message);
    }

    // 3. Monitor Trading Activity & Fees
    console.log("\n💰 Fee Distribution Status:");
    console.log("=========================");
    try {
        const accumulatedFees = await morePool.accumulatedFees();
        console.log(`Accumulated Fees: ${ethers.formatEther(accumulatedFees)} ETH`);
        console.log(`Fee Recipient: ${FEE_RECIPIENT}`);

        // Get recipient's balance
        const recipientBalance = await ethers.provider.getBalance(FEE_RECIPIENT);
        console.log(`Recipient Balance: ${ethers.formatEther(recipientBalance)} ETH`);

        if (accumulatedFees > 0) {
            console.log("\nDistributing fees...");
            const tx = await morePool.distributeFees();
            await tx.wait();
            console.log("✅ Fees distributed successfully!");
        }
    } catch (e: any) {
        console.error("❌ Fee monitoring failed:", e.message);
    }

    console.log("\n🔗 View Trading Activity:");
    console.log(`https://sepolia.basescan.org/address/${moreTokenAddress}`);
    console.log(`https://sepolia.base.org/swap`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Testing failed:", error);
        process.exit(1);
    }); 