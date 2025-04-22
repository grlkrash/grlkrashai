import { handleForgeCrystal } from './forgeCrystal.js';
import { handleHolderMint, handleHolderPlay, handleHolderList, handleHolderStop } from './holderCommands.js';
import { PlayMode, SortOrder, MediaType } from '../utils/mediaPlayer.js';
import { CrystalHolder } from '../contracts/CrystalHolder';
import { TwitterService } from '../services/TwitterService';
import { WalletService } from '../services/WalletService';
import { soundManager, SoundEffect } from '../utils/soundEffects';
import { TwitterAuthService } from '../services/TwitterAuthService';
import { MemoryCrystal } from '../contracts/MemoryCrystal';

interface CommandResult {
    message: string;
}

interface Crystal {
    id: number;
    type: string;
    metadata: {
        name: string;
        description: string;
        image: string;
    };
}

interface Tweet {
    url: string;
    id: string;
}

export const HOLDER_PATTERNS = {
    // Wallet commands
    WALLET: {
        CONNECT: [
            /connect (?:my )?wallet/i,
            /login/i,
            /sign in/i
        ],
        DISCONNECT: [
            /disconnect (?:my )?wallet/i,
            /logout/i,
            /sign out/i
        ]
    },

    // Crystal commands
    CRYSTAL: {
        FORGE: [
            /forge (?:a )?(?:new )?crystal/i,
            /create (?:a )?(?:new )?crystal/i,
            /mint (?:a )?(?:new )?crystal/i
        ],
        VIEW: [
            /view crystal (\d+)/i,
            /show crystal (\d+)/i,
            /display crystal (\d+)/i
        ]
    },

    // Holder commands
    HOLDER: {
        ADD: [
            /add (?:crystal )?to holder/i,
            /store in holder/i,
            /put in holder/i,
            /add to collection/i
        ],
        AUTO_ADD: [
            /auto add on/i,
            /enable auto add/i,
            /turn on auto add/i
        ],
        AUTO_BIND: [
            /auto bind on/i,
            /enable auto bind/i,
            /turn on auto bind/i
        ],
        VIEW: [
            /view (?:my )?collection/i,
            /show (?:my )?crystals/i,
            /list (?:my )?crystals/i
        ]
    },

    // Media player commands
    PLAYER: {
        SHUFFLE: [
            /shuffle (?:my )?crystals/i,
            /mix (?:my )?crystals/i,
            /random play/i
        ],
        SORT: [
            /sort by (.+)/i,
            /order by (.+)/i,
            /arrange by (.+)/i
        ],
        FILTER: [
            /filter (.+)/i,
            /show only (.+)/i,
            /display (.+)/i
        ],
        PLAY: [
            /play crystal (\d+)/i,
            /start crystal (\d+)/i,
            /watch crystal (\d+)/i
        ],
        STOP: [
            /stop/i,
            /pause/i,
            /end playback/i
        ]
    },

    // Social commands
    SOCIAL: {
        TWEET: [
            /tweet about (?:my )?crystal (\d+)/i,
            /share crystal (\d+)/i,
            /post about crystal (\d+)/i
        ],
        REPLY: [
            /reply to tweet (\d+) with (.+)/i,
            /respond to (\d+) with (.+)/i
        ]
    },

    // Help commands
    HELP: [
        /help/i,
        /commands/i,
        /what can you do/i,
        /how do I/i
    ]
};

// Keep track of last forged crystal
let lastForgedCrystalId: number | null = null;

// Keep track of media player settings
let autoBindEnabled = false;

export const commands = {
    'forge crystal': async (args: string[], userAddress: string): Promise<CommandResult> => {
        // Parse access level from args
        const accessLevel = args[0]?.toLowerCase();
        if (!accessLevel || !['basic', 'premium', 'elite'].includes(accessLevel)) {
            return {
                message: '⚠️ Please specify an access level: basic, premium, or elite\n' +
                        'Example: forge crystal basic'
            };
        }

        try {
            const result = await handleForgeCrystal({
                accessLevel: accessLevel as 'basic' | 'premium' | 'elite',
                userAddress
            });

            // Store the newly forged crystal ID
            if (result.crystalId) {
                lastForgedCrystalId = result.crystalId;
                
                // Auto-bind if enabled
                if (autoBindEnabled) {
                    const bindResult = await handleHolderMint(lastForgedCrystalId, userAddress);
                    lastForgedCrystalId = null;
                    result.message += '\n\n' + bindResult.message;
                } else {
                    result.message += '\n\nSay "add to holder" to add this crystal to your collection!';
                }
            }

            return result;
        } catch (error: any) {
            return {
                message: `❌ Error forging crystal: ${error.message}`
            };
        }
    },

    // Quick add command
    'add': async (args: string[], userAddress: string): Promise<CommandResult> => {
        if (!lastForgedCrystalId) {
            return {
                message: "❌ No crystal to add! Forge a new crystal first with 'forge crystal basic/premium/elite'"
            };
        }
        const result = await handleHolderMint(lastForgedCrystalId, userAddress);
        lastForgedCrystalId = null; // Clear the stored crystal ID after adding
        return result;
    },

    // Auto-add toggle command
    'auto add': async (args: string[], userAddress: string): Promise<CommandResult> => {
        const enable = args[0]?.toLowerCase() === 'on';
        autoBindEnabled = enable;
        return {
            message: `🔮 Automatic adding of new crystals is now ${enable ? 'enabled' : 'disabled'}\n` +
                    (enable ? 
                        'New crystals will be automatically added to your holder after forging.' :
                        'Use "add" after forging to add new crystals to your collection.')
        };
    },

    // Natural language holder commands
    'holder': async (args: string[], userAddress: string): Promise<CommandResult> => {
        const input = args.join(' ').trim();
        
        // Check for add patterns
        for (const pattern of HOLDER_PATTERNS.HOLDER.ADD) {
            if (pattern.test(input)) {
                if (!lastForgedCrystalId) {
                    return {
                        message: "❌ No crystal to add! Forge a new crystal first with 'forge crystal basic/premium/elite'"
                    };
                }
                const result = await handleHolderMint(lastForgedCrystalId, userAddress);
                lastForgedCrystalId = null; // Clear the stored crystal ID after adding
                return result;
            }
        }

        // Check for auto-add patterns
        for (const pattern of HOLDER_PATTERNS.HOLDER.AUTO_ADD) {
            if (pattern.test(input)) {
                const enable = input.match(/on|enable/i) !== null;
                autoBindEnabled = enable;
                return {
                    message: `🔮 Automatic adding of new crystals is now ${enable ? 'enabled' : 'disabled'}\n` +
                            (enable ? 
                                'New crystals will be automatically added to your holder after forging.' :
                                'Use "add" after forging to add new crystals to your collection.')
                };
            }
        }
        
        // Check for shuffle patterns
        for (const pattern of HOLDER_PATTERNS.PLAYER.SHUFFLE) {
            if (pattern.test(input)) {
                return await handleHolderPlay(userAddress, PlayMode.SHUFFLE);
            }
        }
        
        // Check for sort patterns
        for (const pattern of HOLDER_PATTERNS.PLAYER.SORT) {
            if (pattern.test(input)) {
                let order: SortOrder;
                if (input.match(/(?:up|asc)/i)) order = SortOrder.ID_ASC;
                else if (input.match(/(?:down|desc)/i)) order = SortOrder.ID_DESC;
                else if (input.match(/type/i)) order = SortOrder.TYPE;
                else if (input.match(/new/i)) order = SortOrder.NEWEST;
                else order = SortOrder.OLDEST;
                
                return await handleHolderPlay(userAddress, undefined, order);
            }
        }
        
        // Check for filter patterns
        for (const pattern of HOLDER_PATTERNS.PLAYER.FILTER) {
            if (pattern.test(input)) {
                let type: MediaType | null = null;
                if (input.match(/audio/i)) type = MediaType.AUDIO;
                else if (input.match(/video/i)) type = MediaType.VIDEO;
                else if (input.match(/image/i)) type = MediaType.IMAGE;
                
                return await handleHolderPlay(userAddress, undefined, undefined, type);
            }
        }
        
        // Check for play patterns
        for (const pattern of HOLDER_PATTERNS.PLAYER.PLAY) {
            if (pattern.test(input)) {
                return await handleHolderPlay(userAddress);
            }
        }
        
        // Check for stop patterns
        for (const pattern of HOLDER_PATTERNS.PLAYER.STOP) {
            if (pattern.test(input)) {
                return await handleHolderStop();
            }
        }
        
        // Check for list patterns
        for (const pattern of HOLDER_PATTERNS.HOLDER.VIEW) {
            if (pattern.test(input)) {
                return await handleHolderList(userAddress);
            }
        }
        
        // If no pattern matched, show help
        return {
            message: `🎵 Crystal Holder Commands:\n\n` +
                    `After forging a crystal:\n` +
                    `- "add" (quick command)\n` +
                    `- "add to holder"\n` +
                    `- "store in holder"\n\n` +
                    `Auto-add settings:\n` +
                    `- "auto add on/off"\n` +
                    `- "enable/disable auto add"\n` +
                    `- "turn on/off auto add"\n\n` +
                    `To play your media:\n` +
                    `- "play holder"\n` +
                    `- "shuffle crystals"\n` +
                    `- "play random"\n\n` +
                    `To sort crystals:\n` +
                    `- "sort by id up/down"\n` +
                    `- "sort by type"\n` +
                    `- "sort by date newest/oldest"\n\n` +
                    `To filter crystals:\n` +
                    `- "show only audio/video/images"\n` +
                    `- "clear filter"\n` +
                    `- "show all"\n\n` +
                    `To stop playing:\n` +
                    `- "stop holder"\n` +
                    `- "pause playback"\n` +
                    `- "close player"\n\n` +
                    `To view your collection:\n` +
                    `- "show my crystals"\n` +
                    `- "what crystals do i have"\n` +
                    `- "display collection"`
        };
    },

    // Handle auto-bind commands
    'auto': async (args: string[], userAddress: string): Promise<CommandResult> => {
        const input = args.join(' ').trim();
        
        for (const pattern of HOLDER_PATTERNS.HOLDER.AUTO_BIND) {
            if (pattern.test(input)) {
                const enable = input.match(/on|enable/i) !== null;
                autoBindEnabled = enable;
                return {
                    message: `🔮 Automatic binding of new crystals is now ${enable ? 'enabled' : 'disabled'}\n` +
                            (enable ? 
                                'New crystals will be automatically added to your holder after forging.' :
                                'Say "add to holder" after forging to add new crystals to your collection.')
                };
            }
        }
        
        return {
            message: `⚠️ Invalid auto command. Try:\n` +
                    `- "auto bind on/off"\n` +
                    `- "enable/disable auto bind"\n` +
                    `- "turn on/off auto binding"`
        };
    },

    // Wallet connection commands
    'wallet': async (args: string[], userAddress: string): Promise<CommandResult> => {
        const input = args.join(' ').trim();
        
        for (const pattern of HOLDER_PATTERNS.WALLET.CONNECT) {
            if (pattern.test(input)) {
                try {
                    await CrystalHolder.connectWallet();
                    return {
                        message: `✨ Wallet connected successfully!\n` +
                                `You can now forge crystals and manage your collection.`
                    };
                } catch (error: any) {
                    return {
                        message: `❌ Connection error: ${error.message}`
                    };
                }
            }
        }
        
        for (const pattern of HOLDER_PATTERNS.WALLET.DISCONNECT) {
            if (pattern.test(input)) {
                try {
                    await CrystalHolder.disconnectWallet();
                    return {
                        message: `👋 Wallet disconnected.\n` +
                                `Say "connect wallet" when you want to reconnect.`
                    };
                } catch (error: any) {
                    return {
                        message: `❌ Disconnection error: ${error.message}`
                    };
                }
            }
        }
        
        return {
            message: `⚠️ Invalid wallet command. Try:\n` +
                    `- "connect wallet"\n` +
                    `- "disconnect wallet"`
        };
    },

    'twitter': async (args: string[], userAddress: string): Promise<CommandResult> => {
        const input = args.join(' ').trim();
        const twitterService = TwitterService.getInstance();
        const twitterAuth = TwitterAuthService.getInstance();
        
        // Check for verification commands
        if (input.startsWith('verify')) {
            if (twitterAuth.isVerified(userAddress)) {
                return {
                    message: "✅ Your Twitter account is already verified!"
                };
            }

            // Start verification process
            const code = await twitterAuth.startVerification(userAddress);
            return {
                message: `🔐 Please tweet the following code to verify your account:\n\n` +
                        `${code}\n\n` +
                        `Then use the command: twitter confirm <tweet-url>`
            };
        }

        // Check for confirmation of verification
        if (input.startsWith('confirm')) {
            const tweetUrl = args.slice(1).join(' ');
            if (!tweetUrl) {
                return {
                    message: "❌ Please provide the URL of your verification tweet"
                };
            }

            try {
                await twitterAuth.verifyTwitterAccount(userAddress, tweetUrl);
                return {
                    message: "✅ Twitter account verified successfully! You can now use Twitter commands."
                };
            } catch (error: any) {
                return {
                    message: `❌ Verification failed: ${error.message}`
                };
            }
        }

        // Check for crystal sharing patterns
        for (const pattern of HOLDER_PATTERNS.SOCIAL.TWEET) {
            const match = input.match(pattern);
            if (match) {
                const crystalId = parseInt(match[1]);
                if (!isNaN(crystalId)) {
                    try {
                        // Get crystal details and media
                        const crystal = await MemoryCrystal.connect(userAddress);
                        const mediaURI = await crystal.getMediaURI(crystalId);
                        const mediaId = await twitterService.uploadMedia(mediaURI);
                        
                        const message = `🔮 Check out my Memory Crystal #${crystalId}!\n` +
                                     `#GRLKRASH #MemoryCrystals`;
                                     
                        const result = await twitterService.tweet(message, [mediaId]);
                        return {
                            message: `🐦 Successfully shared Crystal #${crystalId} on Twitter!\n` +
                                    `View your tweet here: ${result}`
                        };
                    } catch (error: any) {
                        return {
                            message: `❌ Failed to share crystal: ${error.message}`
                        };
                    }
                }
            }
        }
        
        // Check for reply patterns
        for (const pattern of HOLDER_PATTERNS.SOCIAL.REPLY) {
            const match = input.match(pattern);
            if (match) {
                const tweetId = match[1];
                const replyText = match[2];
                try {
                    const result = await twitterService.replyToTweet(tweetId, replyText);
                    return {
                        message: `🐦 Reply posted successfully!\n` +
                                `View your reply here: ${result}`
                    };
                } catch (error: any) {
                    return {
                        message: `❌ Failed to post reply: ${error.message}`
                    };
                }
            }
        }
        
        return {
            message: `⚠️ Invalid Twitter command. Try:\n` +
                    `- "twitter verify" (start verification)\n` +
                    `- "twitter confirm <tweet-url>" (complete verification)\n` +
                    `- "tweet about crystal <id>"\n` +
                    `- "share crystal <id>"\n` +
                    `- "reply to tweet <id> with <message>"`
        };
    }
}; 

// Handle crystal sharing
async function handleCrystalShare(crystalId: number, userAddress: string): Promise<CommandResult> {
    try {
        const contract = await CrystalHolder.connect(userAddress);
        const crystals = await contract.getBoundCrystals();
        
        if (!crystals.includes(crystalId)) {
            return {
                message: `❌ Crystal #${crystalId} not found in your collection.`
            };
        }

        const mediaUrl = await contract.playMedia(crystalId);
        const tweetUrl = await TwitterService.getInstance().tweet(
            `Check out my Memory Crystal #${crystalId}!`,
            [mediaUrl]
        );
        
        return {
            message: `🐦 Successfully shared Crystal #${crystalId} on Twitter!\n` +
                    `View your tweet here: ${tweetUrl}`
        };
    } catch (error: any) {
        return {
            message: `❌ Failed to share crystal: ${error.message}`
        };
    }
} 