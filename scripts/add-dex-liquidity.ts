import { ethers } from "hardhat";

// Base Swap Router V2 on Base Sepolia
const ROUTER_ADDRESS = "0x0bf5c7ce4c0dbc7e0588c0d53c55e5336176988a";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

const ROUTER_ABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function WETH() external pure returns (address)"
];

async function main() {
    const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
    console.log("🌊 Adding initial liquidity to Base Swap...");

    // Get contract instances
    const [signer] = await ethers.getSigners();
    console.log(`Using signer address: ${signer.address}`);

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const moreToken = await ethers.getContractAt("MOREToken", moreTokenAddress);

    // Check ETH balance
    const ethBalance = await signer.provider.getBalance(signer.address);
    console.log(`\nCurrent ETH balance: ${ethers.formatEther(ethBalance)} ETH`);

    // Calculate safe amounts
    const ethForLiquidity = ethers.parseEther("0.005"); // 0.005 ETH for liquidity
    const moreTokenAmount = ethers.parseEther("5000"); // 5,000 MORE tokens (1000:1 ratio)

    // First approve router to spend MORE tokens
    console.log(`\nApproving Base Swap Router to spend ${ethers.formatEther(moreTokenAmount)} MORE tokens...`);
    const approveTx = await moreToken.approve(ROUTER_ADDRESS, moreTokenAmount);
    await approveTx.wait();
    console.log("✅ Approval successful");

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

    console.log(`\nAdding liquidity:`);
    console.log(`- ${ethers.formatEther(moreTokenAmount)} MORE tokens`);
    console.log(`- ${ethers.formatEther(ethForLiquidity)} ETH`);

    try {
        const tx = await router.addLiquidityETH(
            moreTokenAddress,
            moreTokenAmount,    // Amount of MORE tokens
            moreTokenAmount,    // Min MORE tokens
            ethForLiquidity,    // Min ETH
            signer.address,     // LP tokens recipient
            deadline,
            { value: ethForLiquidity }
        );

        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log(`✅ Liquidity added successfully! Transaction: ${receipt.hash}`);

        console.log("\n🎉 Token is now tradeable on Base Swap!");
        console.log(`Users can trade at: https://sepolia.base.org/swap`);
        console.log("\nInitial price:");
        console.log(`1 ETH = ${Number(ethers.formatEther(moreTokenAmount))} MORE`);
        console.log(`1 MORE = ${Number(ethers.formatEther(ethForLiquidity)) / Number(ethers.formatEther(moreTokenAmount))} ETH`);
    } catch (e: any) {
        console.error("❌ Failed to add liquidity:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Setup failed:", error);
        process.exit(1);
    }); 