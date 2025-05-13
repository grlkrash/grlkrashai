import { fal } from '@fal-ai/client';
import config from '../../config.js'; 
import logger from '../../utils/logger.js'; 
import * as fs from 'fs/promises';
import * as path from 'path';
import * as url from 'url';
import fetch from 'node-fetch'; // Or use global fetch if node >= 18
import { Buffer } from 'buffer';

const FAL_3D_ENDPOINT = "fal-ai/hyper3d/rodin"; 

/**
 * Generates a 3D model using Fal.ai, downloads it, and saves it locally.
 * @param prompt The text prompt for the 3D model.
 * @returns {Promise<string | null>} The absolute local file path of the saved .glb file on success, or null on failure.
 */
export async function generateAndSave3DModel(prompt: string): Promise<string | null> {
    const apiKey = config.fal.apiKey;
    if (!apiKey) {
        logger.error('[Fal.ai] API Key missing.');
        return null;
    }

    // Configure fal client with the API key
    fal.config({
        credentials: apiKey,
    });

    logger.info('[Fal.ai] Starting 3D generation', { prompt });
    try {
        const response: any = await fal.subscribe(FAL_3D_ENDPOINT, {
            input: {
                prompt: prompt,
                input_image_urls: [], // Basic text-to-3D
                geometry_file_format: "glb", 
            },
        });

        const modelUrl = response?.data?.model_mesh?.url;
        const originalFileName = response?.data?.model_mesh?.file_name;

        if (modelUrl && originalFileName) {
            logger.info(`[Fal.ai] Success. URL: ${modelUrl}`);
            logger.info(`[Fal.ai] Downloading 3D model...`);
            
            let buffer;
            try {
                const fetchResponse = await fetch(modelUrl);
                if (!fetchResponse.ok || !fetchResponse.body) {
                    throw new Error(`Download failed: ${fetchResponse.statusText}`);
                }
                const arrayBuffer = await fetchResponse.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
                logger.info(`[Fal.ai] Downloaded ${buffer.length} bytes.`);
            } catch (error: any) {
                logger.error('[Fal.ai] Error downloading or processing Fal.ai model data', { errorMessage: error?.message });
                return null;
            }

            // Save Locally
            const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
            const saveDir = path.resolve(__dirname, '../../../content_cache/fal_3d'); 
            const safeOriginalName = path.basename(originalFileName).replace(/[^a-z0-9._-]/gi, '_');
            const localFileName = `generated_3d_${Date.now()}_${safeOriginalName}`;
            const localFilePath = path.join(saveDir, localFileName);

            try {
                await fs.mkdir(saveDir, { recursive: true });
                await fs.writeFile(localFilePath, buffer);
                logger.info(`[Fal.ai] Saved 3D model to: ${localFilePath}`);
                
                return localFilePath; // Return absolute path
            } catch (error: any) {
                logger.error('[Fal.ai] Error saving Fal.ai model to disk', { errorMessage: error?.message });
                return null;
            }

        } else {
             throw new Error('Fal.ai response missing model data.');
        }
    } catch (error: any) {
        logger.error('[Fal.ai] 3D generation failed.', { errorMessage: error?.message });
        return null; 
    }
} 