import fs from 'fs/promises';
import path from 'path';
import * as url from 'url'; // Import url first
import logger from './logger.js'; 

// --- Define __dirname correctly for ESM ---
// Must be defined AFTER url import but potentially BEFORE LYRICS_DIR if LYRICS_DIR uses it
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// --- Define path to the lyrics directory ---
// Path relative from src/utils/ up two levels to project root, then down to LYRICS EXAMPLES
const LYRICS_DIR = path.join(__dirname, '../../LYRICS EXAMPLES'); 

// --- Rest of the code ---
let loadedLyrics: string[] = [];

/**
 * Reads all .txt files from the lyrics directory and loads their lines.
 * @returns {Promise<boolean>} True if loading was successful (or files don't exist), false otherwise.
 */
export async function loadLyrics(): Promise<boolean> {
    logger.info(`Attempting to load lyrics from: ${LYRICS_DIR}`);
    try {
        const files = await fs.readdir(LYRICS_DIR);
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');

        if (txtFiles.length === 0) {
            logger.warn(`No .txt files found in lyrics directory: ${LYRICS_DIR}`);
            loadedLyrics = []; 
            return true; 
        }

        logger.info(`Found ${txtFiles.length} lyric file(s): ${txtFiles.join(', ')}`);

        const allLines: string[] = [];
        for (const file of txtFiles) {
            const filePath = path.join(LYRICS_DIR, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                // Split into lines, trim whitespace, filter out empty lines
                const lines = content.split(/\r?\n/) // Handles different line endings
                                     .map(line => line.trim())
                                     .filter(line => line.length > 0);
                allLines.push(...lines);
            } catch (readError) {
                logger.error(`Failed to read lyric file: ${filePath}`, { readError });
            }
        }

        loadedLyrics = allLines;
        logger.info(`Successfully loaded ${loadedLyrics.length} lines from ${txtFiles.length} lyric file(s).`);
        return true;

    } catch (error: any) {
        if (error.code === 'ENOENT') {
             logger.warn(`Lyrics directory not found: ${LYRICS_DIR}. Skipping lyric loading.`);
             loadedLyrics = [];
             return true; 
        }
        logger.error('Failed to load lyrics', { message: error?.message, code: error?.code });
        loadedLyrics = [];
        return false;
    }
}

/**
 * Gets a specified number of random lines from the loaded lyrics.
 * @param count The number of random lines to retrieve. Defaults to 3.
 * @returns {string[]} An array of random lyric lines, or empty if none loaded.
 */
export function getRandomLyricLines(count = 3): string[] {
    if (loadedLyrics.length === 0) {
        return [];
    }
    // Simple shuffle and slice
    const shuffled = [...loadedLyrics].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, loadedLyrics.length));
} 