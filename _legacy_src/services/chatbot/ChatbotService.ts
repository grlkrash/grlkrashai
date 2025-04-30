/*
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import { commands } from './src/commands/index.js';
import fs from 'fs';
import { TwitterAutoMode } from './src/services/TwitterAutoMode';

// Load environment variables
dotenv.config();

// NFT Contract addresses
const SUPPORTER_NFT_ADDRESS = "0xe7d0Fc9191e8D15eD42533052896cE77EA49aF6C";
const CONTENT_NFT_ADDRESS = "0x3073D430c6526a5DAEaF48EA69cF00f0DC735d45";
const MORE_TOKEN_ADDRESS = "0x7Be109D94A1f51c5adfc5537c542142C5876DC2d";

// NFT-related commands
const NFT_COMMANDS = {
  FORGE_CRYSTAL: "forge", // Mint Supporter NFT
  VIEW_CRYSTALS: "crystals", // View owned NFTs
  SHARE_MEMORY: "share", // Mint Content NFT (owner only)
  UNLOCK_MEMORY: "unlock", // Access content with Supporter NFT
};

// Crystal forging costs in MORE tokens
const CRYSTAL_COSTS = {
  BASIC: "1000",
  PREMIUM: "2500",
  ELITE: "5000"
};

// Add to GRLKRASH_PERSONA
const CRYSTAL_LORE = `
*picks up a glowing crystal* Hey friend! Check out what I found in my secret base - Memory Crystals! They're like digital tokens of our resistance movement, storing our music and memories.

You can interact with them using simple words:
- Say "forge basic" (costs 1,000 MORE)
- Say "forge premium" (costs 2,500 MORE)
- Say "forge elite" (costs 5,000 MORE)
- Say "crystals" to see your collection
- Say "unlock 1" (or any number) to access a stored memory

Each crystal needs MORE tokens to create. Higher level crystals cost more but give you access to exclusive content!
`;

// Initialize provider and signer
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);

// Content NFT ABI
const contentNFTAbi = [
  "function getContentMetadata(uint256 tokenId) view returns (uint8 contentType, uint8 accessLevel, string title, string description, string contentURI, string previewURI, bool isAIGenerated, uint256 createdAt, string[] tags)",
  "function getContentURI(uint256 tokenId) view returns (string)",
  "function getPreviewURI(uint256 tokenId) view returns (string)",
  "function createAIContent(string title, string description, uint8 contentType, uint8 accessLevel, string contentURI, string previewURI, string[] tags) returns (uint256)"
];

// Initialize Content NFT contract
const contentNFT = new ethers.Contract(
  "0x3073D430c6526a5DAEaF48EA69cF00f0DC735d45",
  contentNFTAbi,
  wallet
);

async function handleCommand(command: string, args: string[], userAddress: string) {
    if (command in commands) {
        const result = await commands[command](args, userAddress);
        
        // If there's a preview file, display it
        if (result.preview && fs.existsSync(result.preview)) {
            console.log('\nPreview file:', result.preview);
            // You can add additional preview handling here
        }
        
        return result.message;
    }
    
    return `Unknown command: ${command}`;
}

// Handle unlock command
async function handleUnlock(tokenId: string) {
  try {
    const metadata = await contentNFT.getContentMetadata(tokenId);
    console.log("\nMemory Crystal Content Details:");
    console.log(`Title: ${metadata.title}`);
    console.log(`Description: ${metadata.description}`);
    console.log(`Type: ${getContentTypeName(metadata.contentType)}`);
    console.log(`Access Level Required: ${metadata.accessLevel}`);
    console.log(`${metadata.isAIGenerated ? 'AI-Generated' : 'Original'} Content`);
    console.log(`Tags: ${metadata.tags.join(', ')}`);
    console.log(`Created: ${new Date(Number(metadata.createdAt) * 1000).toLocaleString()}`);
    
    try {
      const contentURI = await contentNFT.getContentURI(tokenId);
      console.log(`\nFull Content: ${contentURI}`);
    } catch (error) {
      console.log("\nYou don't have the required access level to view the full content.");
      console.log(`Preview available at: ${metadata.previewURI}`);
    }
  } catch (error) {
    console.log("Error accessing memory crystal content:", error.message);
  }
}

function getContentTypeName(type: number): string {
  switch(type) {
    case 0: return "Music Track";
    case 1: return "Artwork";
    case 2: return "Experience";
    default: return "Unknown";
  }
}

// Update the main chat loop to handle content commands
async function processUserInput(input: string) {
  if (input.toLowerCase() === 'bye') {
    console.log("GRLKRASH: Keep fighting for music freedom, friend. *waves goodbye* I'll be here when you need me. *plays a farewell riff*");
    process.exit(0);
  }

  if (input.toLowerCase().startsWith('unlock ')) {
    const tokenId = input.split(' ')[1];
    await handleUnlock(tokenId);
    return;
  }

  // ... existing command handling ...

  // Default response
  console.log("GRLKRASH: *strums guitar thoughtfully* Want to explore some memory crystals? Try 'forge basic' to create one, 'crystals' to view your collection, or 'unlock <number>' to access stored memories!");
}

// Main chat function
async function chat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n🎮 GRLKRASH AI Chatbot - Ready to rock! 🎵");
  console.log("-----------------------------------------------");
  console.log("Chat with GRLKRASH... Say 'bye' to end!");
  console.log(CRYSTAL_LORE);

  while (true) {
    const userMessage = await new Promise<string>(resolve => rl.question("\nYou: ", resolve));
    
    if (userMessage.toLowerCase() === "bye") {
      console.log("\nGRLKRASH: Keep fighting for music freedom, friend! *waves goodbye and plays a farewell riff*");
      rl.close();
      break;
    }

    try {
      let response;
      const words = userMessage.toLowerCase().split(" ");
      
      // Handle crystal commands in natural language
      if (words[0] === "forge") {
        const level = words[1] === "basic" ? 1 : words[1] === "premium" ? 2 : words[1] === "elite" ? 3 : 0;
        response = await handleCommand(NFT_COMMANDS.FORGE_CRYSTAL, [level.toString()], wallet.address);
      } else if (words[0] === "crystals") {
        response = await handleCommand(NFT_COMMANDS.VIEW_CRYSTALS, [], wallet.address);
      } else if (words[0] === "unlock" && words[1]) {
        response = await handleCommand(NFT_COMMANDS.UNLOCK_MEMORY, [words[1]], wallet.address);
      } else {
        // Handle regular chat messages
        response = "Hey! Want to check out our Memory Crystals? Try saying 'forge basic' to create one, or 'crystals' to see your collection!";
      }
      
      console.log("\nGRLKRASH:", response);
    } catch (error) {
      console.error("Error:", error);
      console.log("\nGRLKRASH: *guitar string snaps* Oops! Something went wrong. Try again!");
    }
  }
}

// Start the chat
chat().catch(console.error);

// Update the handleAutoModeStart function
private async handleAutoModeStart(): Promise<CommandResponse> {
    if (!this.targetUsername) {
        return { success: false, message: 'No target account specified' };
    }

    try {
        // Get TwitterAutoMode instance
        const autoMode = TwitterAutoMode.getInstance();
        
        // Configure and start auto mode
        autoMode.updateConfig({
            enabled: true,
            targetAccounts: [this.targetUsername],
            campaignTypes: ['engagement', 'growth', 'community'],
            postFrequency: 30 // 30 minutes default
        });

        await autoMode.start();

        this.isRunning = true;
        this.startTime = new Date();
        this.saveState();

        return {
            success: true,
            message: `Auto mode started for @${this.targetUsername}`
        };
    } catch (error) {
        console.error('Error starting auto mode:', error);
        return {
            success: false,
            message: `Failed to start auto mode: ${error.message}`
        };
    }
}

// Update the handleAutoModeStop function
private async handleAutoModeStop(): Promise<CommandResponse> {
    try {
        const autoMode = TwitterAutoMode.getInstance();
        autoMode.stop();
        
        this.isRunning = false;
        this.saveState();

        return {
            success: true,
            message: 'Auto mode stopped'
        };
    } catch (error) {
        console.error('Error stopping auto mode:', error);
        return {
            success: false,
            message: `Failed to stop auto mode: ${error.message}`
        };
    }
} 
*/ 