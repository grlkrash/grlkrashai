import { Plugin3DGeneration } from '@plugin-3d-generation';
import path from 'path';
import fs from 'fs/promises';

export class DataProcessor {
    private readonly ASSETS_PATH: string;
    private readonly CACHE_PATH: string;

    constructor(assetsPath: string) {
        this.ASSETS_PATH = assetsPath;
        this.CACHE_PATH = path.join(assetsPath, 'cache');
        this.initializeDirectories();
    }

    private async initializeDirectories() {
        const dirs = [
            path.join(this.ASSETS_PATH, '3d', 'generated'),
            path.join(this.ASSETS_PATH, 'lyrics', 'generated'),
            this.CACHE_PATH
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async process3DModel(modelPath: string): Promise<any> {
        const generator = new Plugin3DGeneration();
        const model = await generator.loadModel(modelPath);
        
        // Optimize and normalize the model
        const optimized = await generator.optimizeModel(model, {
            reducePolygons: true,
            textureQuality: 'high',
            maxSize: 50 * 1024 * 1024 // 50MB max
        });

        return optimized;
    }

    async processLyrics(content: string): Promise<string[]> {
        // Clean and normalize lyrics
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    async cacheData(key: string, data: any) {
        const cachePath = path.join(this.CACHE_PATH, `${key}.json`);
        await fs.writeFile(cachePath, JSON.stringify(data));
    }

    async getCachedData(key: string): Promise<any | null> {
        try {
            const cachePath = path.join(this.CACHE_PATH, `${key}.json`);
            const data = await fs.readFile(cachePath, 'utf-8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
} 