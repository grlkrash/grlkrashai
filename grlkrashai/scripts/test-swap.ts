import { ethers } from "ethers";

// Base Swap Router V2 on Base Sepolia
const ROUTER_ADDRESS = "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const MORE_TOKEN_ADDRESS = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
const RPC_URL = "https://sepolia.base.org";

const ROUTER_ABI = [
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
    "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)"
];

const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

async function main() {
    console.log("🧪 Testing ETH -> MORE Swap...");

    // Set up provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("Please set PRIVATE_KEY in your environment variables");
    }
    const signer = new ethers.Wallet(privateKey, provider);
    console.log(`Using signer address: ${signer.address}`);

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const moreToken = new ethers.Contract(MORE_TOKEN_ADDRESS, ERC20_ABI, signer);

    // Check initial balances
    const initialMoreBalance = await moreToken.balanceOf(signer.address);
    const initialEthBalance = await provider.getBalance(signer.address);
    const symbol = await moreToken.symbol();
    
    console.log("\n💰 Initial Balances:");
    console.log(`${symbol}: ${ethers.formatEther(initialMoreBalance)} ${symbol}`);
    console.log(`ETH: ${ethers.formatEther(initialEthBalance)} ETH`);

    // Test swap
    console.log("\n🔄 Testing Swap ETH -> MORE...");
    const swapAmount = ethers.parseEther("0.001"); // Swap 0.001 ETH
    try {
        // Get expected output amount
        const amounts = await router.getAmountsOut(
            swapAmount,
            [WETH_ADDRESS, MORE_TOKEN_ADDRESS]
        );
        const expectedMoreAmount = amounts[1];
        console.log(`Expected output: ${ethers.formatEther(expectedMoreAmount)} ${symbol}`);

        // Execute swap
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0, // Accept any amount of tokens (due to price impact)
            [WETH_ADDRESS, MORE_TOKEN_ADDRESS],
            signer.address,
            deadline,
            { value: swapAmount }
        );
        console.log("Waiting for swap confirmation...");
        await tx.wait();
        console.log("✅ Swap successful!");

        // Check final balances
        const finalMoreBalance = await moreToken.balanceOf(signer.address);
        const finalEthBalance = await provider.getBalance(signer.address);
        
        console.log("\n💰 Final Balances:");
        console.log(`${symbol}: ${ethers.formatEther(finalMoreBalance)} ${symbol}`);
        console.log(`ETH: ${ethers.formatEther(finalEthBalance)} ETH`);
        
        console.log("\n📊 Changes:");
        console.log(`${symbol}: +${ethers.formatEther(finalMoreBalance - initialMoreBalance)} ${symbol}`);
        console.log(`ETH: ${ethers.formatEther(finalEthBalance - initialEthBalance)} ETH`);
    } catch (error: any) {
        console.error("❌ Swap failed:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 