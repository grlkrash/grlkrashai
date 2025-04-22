import { ethers } from "hardhat";
import { withRecovery } from "../utils/retry";
import fs from "fs";

const DEPLOYMENT_LOG = "deployments.json";
const LOCK_FILE = ".deploy.lock";

async function main() {
    try {
        acquireLock();
        await deploy();
        releaseLock();
    } catch (error) {
        releaseLock();
        throw error;
    }
}

async function deploy() {
    console.log("🔮 Deploying Memory Crystal Contract...");
    const [deployer] = await ethers.getSigners();
    
    const deployment = await withRecovery(
        async () => {
            const MemoryCrystal = await ethers.getContractFactory("MemoryCrystal");
            const contract = await MemoryCrystal.deploy();
            await contract.waitForDeployment();
            
            const address = await contract.getAddress();
            await validateDeployment(contract);
            
            return { address, timestamp: Date.now() };
        },
        async () => {
            console.log("Deployment failed, cleaning up...");
        }
    );
    
    // Log deployment
    const log = loadDeploymentLog();
    log.memoryCrystal = deployment;
    saveDeploymentLog(log);
    
    console.log(`✅ Deployed to: ${deployment.address}`);
    console.log(`🔍 Verify: npx hardhat verify --network base-sepolia ${deployment.address}`);
}

async function validateDeployment(contract: any) {
    const code = await contract.provider.getCode(contract.address);
    if (code === '0x') throw new Error('Deployment failed');
    
    const owner = await contract.owner();
    if (!owner) throw new Error('Initialization failed');
}

function loadDeploymentLog(): any {
    try {
        return JSON.parse(fs.readFileSync(DEPLOYMENT_LOG, 'utf8'));
    } catch {
        return {};
    }
}

function saveDeploymentLog(log: any) {
    fs.writeFileSync(DEPLOYMENT_LOG, JSON.stringify(log, null, 2));
}

function acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
        const lockTime = fs.statSync(LOCK_FILE).mtime;
        if (Date.now() - lockTime.getTime() < 3600000) {
            throw new Error('Deployment in progress');
        }
    }
    fs.writeFileSync(LOCK_FILE, Date.now().toString());
}

function releaseLock() {
    if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
    }
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
}); 