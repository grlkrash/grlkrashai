import { ethers, BigNumberish, ContractTransactionReceipt, Log, EventLog } from 'ethers';
import { AccessLevel, selectRandomMedia } from '../utils/mediaSelection.js';
import { generatePreview } from '../utils/previewGeneration.js';
import { MemoryCrystal } from '../contracts/MemoryCrystal.js';
import path from 'path';
import fs from 'fs';

// Load contract ABI and address
const contractABI = JSON.parse(fs.readFileSync('./artifacts/contracts/MemoryCrystal.sol/MemoryCrystal.json', 'utf-8')).abi;
const contractAddress = process.env.MEMORY_CRYSTAL_CONTRACT_ADDRESS;

interface ForgeCrystalOptions {
    accessLevel: 'basic' | 'premium' | 'elite';
    userAddress: string;
}

interface ForgeCrystalResult {
    message: string;
    preview?: string;
    selectedMedia: any;
    crystalId: number;
}

export async function handleForgeCrystal(options: ForgeCrystalOptions): Promise<ForgeCrystalResult> {
    try {
        // Convert access level string to enum number
        const accessLevelEnum = AccessLevel[options.accessLevel.toUpperCase() as keyof typeof AccessLevel];
        const accessLevel = Number(accessLevelEnum);
        
        // Select random media based on access level
        const selectedMedia = selectRandomMedia(accessLevelEnum);
        
        // Generate preview if it doesn't exist
        const previewDir = path.join(process.cwd(), 'content', 'previews');
        const previewPath = path.join(previewDir, selectedMedia.type, path.basename(selectedMedia.contentURI));
        
        if (!fs.existsSync(previewPath)) {
            const contentPath = path.join(process.cwd(), 'content', selectedMedia.type, path.basename(selectedMedia.contentURI));
            await generatePreview(contentPath, previewPath);
        }

        // Connect to contract
        const contract = await MemoryCrystal.connect(options.userAddress);

        // Get minting cost
        const mintCost = await contract.getMintCost(accessLevel);

        // Forge the crystal
        const tx = await contract.forgeCrystal(accessLevel);
        const receipt = await tx.wait() as ContractTransactionReceipt;

        // Get the crystal ID from the event
        const forgeEvent = receipt.logs.find(
            (log): log is EventLog => 
                log instanceof EventLog && 
                log.fragment.name === 'CrystalForged'
        );

        if (!forgeEvent) {
            throw new Error('CrystalForged event not found in transaction receipt');
        }

        const crystalId = forgeEvent.args[0]; // First argument is tokenId

        // Format response message
        const response: ForgeCrystalResult = {
            message: `🔮 Forged a ${options.accessLevel.toUpperCase()} Memory Crystal!\n\n` +
                    `Cost: ${ethers.formatEther(mintCost)} ETH\n` +
                    `Crystal ID: #${crystalId}\n` +
                    `Selected Content: ${selectedMedia.name}\n` +
                    `Type: ${selectedMedia.type}`,
            preview: previewPath,
            selectedMedia,
            crystalId: Number(crystalId)
        };

        return response;

    } catch (error) {
        console.error('Error forging crystal:', error);
        throw error;
    }
}

// Helper function to check if user can afford to mint
export async function canAffordMint(userAddress: string, accessLevel: AccessLevel): Promise<boolean> {
    try {
        const contract = await MemoryCrystal.connect(userAddress);
        const mintCost = await contract.getMintCost(Number(accessLevel));
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const userBalance = await provider.getBalance(userAddress);
        
        return userBalance >= BigInt(mintCost.toString());
    } catch (error) {
        console.error('Error checking mint affordability:', error);
        return false;
    }
} 