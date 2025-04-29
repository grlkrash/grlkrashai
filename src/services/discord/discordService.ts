import { Client, Events, GatewayIntentBits, TextChannel, MessageCreateOptions } from 'discord.js';
import logger from '../../utils/logger.js';
import config from '../../config.js';
import path from 'path';
import * as url from 'url';
import { promises as fs } from 'fs';

// Declare the client variable at the module scope
let client: Client | null = null;

/**
 * Initializes the Discord client and logs in.
 * @returns {Promise<Client | null>} The initialized client, or null if login fails.
 */
export async function initializeDiscordClient(): Promise<Client | null> {
    if (client) {
        logger.warn('Discord client already initialized.');
        return client;
    }

    logger.info('Initializing Discord client...');

    // Create a new client instance with necessary intents
    // Guilds: Required for basic server information
    // GuildMessages: Required to receive messages in servers
    // MessageContent: Required to read the content of messages (Needs enabling in Dev Portal!)
    const discordClient = new Client({ 
        intents: [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMessages, 
            GatewayIntentBits.MessageContent 
        ] 
    });

    // Event handler for when the client is ready
    discordClient.once(Events.ClientReady, readyClient => {
        logger.info(`Discord client ready! Logged in as ${readyClient.user.tag}`);
        client = readyClient; // Assign the ready client to the module scope variable
    });

    // Event handler for client errors
    discordClient.on(Events.Error, error => {
        logger.error('Discord client error:', { message: error.message, stack: error.stack });
    });

    // Log in to Discord with your client's token
    try {
        await discordClient.login(config.discord.botToken);
        // Note: The 'ready' event will fire after login is successful. 
        // We return the client instance immediately, but actual readiness is handled by the event.
        // A more robust implementation might return a promise that resolves on 'ready'.
        logger.info('Discord login process initiated successfully.');
        // Assigning here too, although 'ready' is the final confirmation
        client = discordClient; 
        return client; 
    } catch (error: any) {
        logger.error('Failed to log in to Discord:', { message: error?.message });
        client = null;
        return null;
    }
}

/**
 * Gets the current Discord client instance.
 * @returns {Client | null} The client instance or null if not initialized.
 */
export function getDiscordClient(): Client | null {
    return client;
}

/**
 * Logs out and destroys the Discord client.
 */
export async function shutdownDiscordClient(): Promise<void> {
    if (client) {
        logger.info('Shutting down Discord client...');
        await client.destroy();
        client = null;
        logger.info('Discord client shut down.');
    } else {
        logger.info('Discord client not initialized, nothing to shut down.');
    }
}

/**
 * Sends a text message to a Discord channel
 * @param channelId The ID of the channel to send the message to
 * @param content The text content to send
 * @returns Promise resolving to a boolean indicating success/failure
 */
export async function sendDiscordMessage(channelId: string, content: string): Promise<boolean> {
    try {
        if (!client) {
            logger.error('Discord client not initialized');
            return false;
        }
        
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            logger.error(`Channel ${channelId} not found`);
            return false;
        }
        
        if (!('send' in channel)) {
            logger.error(`Channel ${channelId} is not a text-based channel`);
            return false;
        }
        
        await (channel as TextChannel).send(content);
        return true;
    } catch (error: any) {
        logger.error('Error sending Discord message', { channelId, message: error?.message, code: error?.code, stack: error?.stack });
        return false;
    }
}

/**
 * Sends an image with text to a Discord channel
 * @param channelId The ID of the channel to send the message to
 * @param content The text content to send
 * @param imageKey The key or path to the image to send
 * @returns Promise resolving to a boolean indicating success/failure
 */
export async function sendDiscordImageMessage(channelId: string, content: string, imageKey: string): Promise<boolean> {
    let imagePath = '';
    try {
        if (!client) {
            logger.error('Discord client not initialized');
            return false;
        }
        
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            logger.error(`Channel ${channelId} not found`);
            return false;
        }
        
        if (!('send' in channel)) {
            logger.error(`Channel ${channelId} is not a text-based channel`);
            return false;
        }
        
        // Map image key to filename
        const imageMap: { [key: string]: string } = {
            'pfp1': 'pfp1.png',
            'pfp2': 'pfp2.png',
            'pfp3': 'pfp3.png',
            'pfp4': 'pfp4.png',
            'pfp5': 'pfp5.png',
            'roblox': 'pfproblox.png',
            'minecraft': 'pfpminecraft.png'
        };
        
        const filename = imageMap[imageKey] || 'pfp1.png';
        const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
        imagePath = path.join(__dirname, '../../..', 'public/images/pfp', filename);
        logger.info('Attempting to attach image from path:', imagePath);
        
        const messageOptions: MessageCreateOptions = {
            content,
            files: [{
                attachment: imagePath,
                name: filename
            }]
        };
        
        await (channel as TextChannel).send(messageOptions);
        return true;
    } catch (error: any) {
        logger.error('Error sending Discord image message', { channelId, imageKey, imagePath, message: error?.message, code: error?.code, stack: error?.stack });
        return false;
    }
} 