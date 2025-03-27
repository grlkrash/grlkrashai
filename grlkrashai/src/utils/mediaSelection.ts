import fs from 'fs';
import path from 'path';

export enum AccessLevel {
    BASIC = 'basic',
    PREMIUM = 'premium',
    ELITE = 'elite'
}

interface MediaAsset {
    name: string;
    contentURI: string;
    type: string;
    size: number;
    accessLevel: AccessLevel;
}

// Probability weights for each access level (out of 100)
const ACCESS_LEVEL_WEIGHTS = {
    [AccessLevel.BASIC]: 70,    // 70% chance
    [AccessLevel.PREMIUM]: 25,  // 25% chance
    [AccessLevel.ELITE]: 5      // 5% chance
};

// Load and parse the contract mapping
const loadMediaAssets = (): Record<string, MediaAsset> => {
    const mappingPath = path.join(process.cwd(), 'ipfs_results', 'contract_mapping.json');
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

    // Assign access levels based on predefined rules
    const mediaAssets: Record<string, MediaAsset> = {};
    
    for (const [key, value] of Object.entries(mapping)) {
        const asset = value as MediaAsset;
        
        // Assign access level based on content type and characteristics
        // This is a simple example - you can modify the rules as needed
        if (key.includes('FULL') || key.includes('BONUS')) {
            asset.accessLevel = AccessLevel.ELITE;
        } else if (key.includes('PART') || key.includes('ALT')) {
            asset.accessLevel = AccessLevel.PREMIUM;
        } else {
            asset.accessLevel = AccessLevel.BASIC;
        }
        
        mediaAssets[key] = asset;
    }
    
    return mediaAssets;
};

// Weighted random selection function
const weightedRandom = (weights: number[]): number => {
    const sum = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * sum;
    
    for (let i = 0; i < weights.length; i++) {
        if (random < weights[i]) return i;
        random -= weights[i];
    }
    return weights.length - 1;
};

// Select a random media asset based on access level probabilities
export const selectRandomMedia = (forceAccessLevel?: AccessLevel): MediaAsset => {
    const mediaAssets = loadMediaAssets();
    const assets = Object.values(mediaAssets);
    
    // If forcing a specific access level, filter for only those assets
    if (forceAccessLevel) {
        const filteredAssets = assets.filter(asset => asset.accessLevel === forceAccessLevel);
        if (filteredAssets.length === 0) {
            throw new Error(`No assets found for access level: ${forceAccessLevel}`);
        }
        return filteredAssets[Math.floor(Math.random() * filteredAssets.length)];
    }
    
    // Otherwise use weighted random selection
    const accessLevels = Object.values(AccessLevel);
    const weights = accessLevels.map(level => ACCESS_LEVEL_WEIGHTS[level]);
    const selectedIndex = weightedRandom(weights);
    const selectedLevel = accessLevels[selectedIndex];
    
    const eligibleAssets = assets.filter(asset => asset.accessLevel === selectedLevel);
    if (eligibleAssets.length === 0) {
        throw new Error(`No assets found for access level: ${selectedLevel}`);
    }
    
    return eligibleAssets[Math.floor(Math.random() * eligibleAssets.length)];
}; 