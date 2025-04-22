import { ethers } from "hardhat";

async function main() {
    const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
    const poolAddress = "0xbd35e8f3E7176551A4455AA7839cf02A87388759";
    console.log("🧪 Testing MORE Pool Features...");

    // Get contract instances
    const [signer] = await ethers.getSigners();
    console.log(`Using signer address: ${signer.address}`);

    const moreToken = await ethers.getContractAt("MOREToken", moreTokenAddress);
    const morePool = await ethers.getContractAt("MOREPool", poolAddress);

    // Check initial state
    console.log("\n📊 Pool Status:");
    console.log("==============");
    try {
        const [moreReserve, ethReserve] = await morePool.getReserves();
        console.log(`MORE Reserve: ${ethers.formatEther(moreReserve)} MORE`);
        console.log(`ETH Reserve: ${ethers.formatEther(ethReserve)} ETH`);
        
        // Test swap ETH -> MORE
        console.log("\n🔄 Testing Swap ETH -> MORE...");
        const swapAmount = ethers.parseEther("0.001");
        console.log(`Swapping ${ethers.formatEther(swapAmount)} ETH for MORE...`);

        // Calculate expected MORE output (using x * y = k formula)
        // For 0.3% fee, multiply input by 0.997
        const inputWithFee = (swapAmount * 997n) / 1000n;
        const expectedMoreOut = (inputWithFee * moreReserve) / (ethReserve + inputWithFee);
        console.log(`Expected MORE output: ${ethers.formatEther(expectedMoreOut)} MORE`);
        
        const tx = await morePool.swap(
            0n, // MORE amount in
            swapAmount, // ETH amount in
            expectedMoreOut, // Min MORE out
            0n, // Min ETH out
            { value: swapAmount }
        );
        
        console.log("Waiting for swap confirmation...");
        await tx.wait();
        console.log("✅ Swap successful!");

        // Check updated state
        const [newMoreReserve, newEthReserve] = await morePool.getReserves();
        console.log("\n📈 Updated Pool Status:");
        console.log(`MORE Reserve: ${ethers.formatEther(newMoreReserve)} MORE`);
        console.log(`ETH Reserve: ${ethers.formatEther(newEthReserve)} ETH`);

        // Check balances
        const moreBalance = await moreToken.balanceOf(signer.address);
        const ethBalance = await ethers.provider.getBalance(signer.address);
        console.log("\n💰 Your Balances:");
        console.log(`MORE: ${ethers.formatEther(moreBalance)} MORE`);
        console.log(`ETH: ${ethers.formatEther(ethBalance)} ETH`);

        // Check fees
        const fees = await morePool.accumulatedFees();
        console.log("\n💸 Trading Fees:");
        console.log(`Accumulated: ${ethers.formatEther(fees)} ETH`);
        
        if (fees > 0n) {
            console.log("Distributing fees...");
            const distributeTx = await morePool.distributeFees();
            await distributeTx.wait();
            console.log("✅ Fees distributed!");
        }

    } catch (error: any) {
        console.error("❌ Test failed:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 