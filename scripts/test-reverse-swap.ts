import { ethers } from "hardhat";

async function main() {
    const moreTokenAddress = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";
    const poolAddress = "0xbd35e8f3E7176551A4455AA7839cf02A87388759";
    console.log("🧪 Testing MORE -> ETH Swap...");

    // Get contract instances
    const [signer] = await ethers.getSigners();
    console.log(`Using signer address: ${signer.address}`);

    const moreToken = await ethers.getContractAt("MOREToken", moreTokenAddress);
    const morePool = await ethers.getContractAt("MOREPool", poolAddress);

    // Check initial state
    console.log("\n📊 Initial Status:");
    console.log("================");
    try {
        const [moreReserve, ethReserve] = await morePool.getReserves();
        console.log(`Pool MORE Reserve: ${ethers.formatEther(moreReserve)} MORE`);
        console.log(`Pool ETH Reserve: ${ethers.formatEther(ethReserve)} ETH`);

        const moreBalance = await moreToken.balanceOf(signer.address);
        const ethBalance = await ethers.provider.getBalance(signer.address);
        console.log(`\nYour MORE Balance: ${ethers.formatEther(moreBalance)} MORE`);
        console.log(`Your ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
        
        // Test swap MORE -> ETH
        console.log("\n🔄 Testing Swap MORE -> ETH...");
        // Swap a small amount relative to pool reserves (about 0.0000001 MORE)
        const swapAmount = ethers.parseEther("0.0000001");
        console.log(`Swapping ${ethers.formatEther(swapAmount)} MORE for ETH...`);

        // Calculate expected ETH output (using x * y = k formula)
        // For 0.3% fee, multiply input by 0.997
        const inputWithFee = (swapAmount * 997n) / 1000n;
        const expectedEthOut = (inputWithFee * ethReserve) / (moreReserve + inputWithFee);
        console.log(`Expected ETH output: ${ethers.formatEther(expectedEthOut)} ETH`);

        // Approve pool to spend MORE tokens
        console.log("\n🔑 Approving pool to spend MORE tokens...");
        const approveTx = await moreToken.approve(poolAddress, swapAmount);
        await approveTx.wait();
        console.log("✅ Approval successful!");
        
        // Execute swap
        const tx = await morePool.swap(
            swapAmount, // MORE amount in
            0n, // ETH amount in
            0n, // Min MORE out
            expectedEthOut, // Min ETH out
            { value: 0 }
        );
        
        console.log("Waiting for swap confirmation...");
        await tx.wait();
        console.log("✅ Swap successful!");

        // Check updated state
        const [newMoreReserve, newEthReserve] = await morePool.getReserves();
        console.log("\n📈 Updated Pool Status:");
        console.log(`MORE Reserve: ${ethers.formatEther(newMoreReserve)} MORE`);
        console.log(`ETH Reserve: ${ethers.formatEther(newEthReserve)} ETH`);

        // Check updated balances
        const newMoreBalance = await moreToken.balanceOf(signer.address);
        const newEthBalance = await ethers.provider.getBalance(signer.address);
        console.log("\n💰 Your Updated Balances:");
        console.log(`MORE: ${ethers.formatEther(newMoreBalance)} MORE`);
        console.log(`ETH: ${ethers.formatEther(newEthBalance)} ETH`);

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