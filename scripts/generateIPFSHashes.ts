import fs from 'fs';
import path from 'path';
import { AccessLevel } from '../src/utils/mediaSelection.js';

interface IPFSAsset {
    name: string;
    type: string;
    ipfsHash: string;
    contentURI: string;
    size: number;
    accessLevel: AccessLevel;
    previewHash?: string;
    previewURI?: string;
}

interface IPFSHashes {
    assets: IPFSAsset[];
    byType: {
        music: IPFSAsset[];
        video: IPFSAsset[];
        images: IPFSAsset[];
    };
    byAccessLevel: {
        basic: IPFSAsset[];
        premium: IPFSAsset[];
        elite: IPFSAsset[];
    };
}

async function generateIPFSHashes(): Promise<void> {
    // Read the contract mapping
    const contractMapping = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'ipfs_results', 'contract_mapping.json'), 'utf-8')
    );

    // Initialize the IPFS hashes structure
    const ipfsHashes: IPFSHashes = {
        assets: [],
        byType: {
            music: [],
            video: [],
            images: []
        },
        byAccessLevel: {
            basic: [],
            premium: [],
            elite: []
        }
    };

    // Process each asset
    for (const [name, data] of Object.entries(contractMapping)) {
        const asset = data as any;
        
        // Determine access level based on name and type
        let accessLevel = AccessLevel.BASIC;
        if (name.includes('FULL') || name.includes('BONUS')) {
            accessLevel = AccessLevel.ELITE;
        } else if (name.includes('PART') || name.includes('ALT')) {
            accessLevel = AccessLevel.PREMIUM;
        }

        const ipfsAsset: IPFSAsset = {
            name,
            type: asset.type,
            ipfsHash: asset.contentURI.replace('ipfs://', ''),
            contentURI: asset.contentURI,
            size: asset.size,
            accessLevel
        };

        // Add to main assets array
        ipfsHashes.assets.push(ipfsAsset);

        // Add to type-specific array
        if (asset.type === 'music') {
            ipfsHashes.byType.music.push(ipfsAsset);
        } else if (asset.type === 'video') {
            ipfsHashes.byType.video.push(ipfsAsset);
        } else if (asset.type === 'images') {
            ipfsHashes.byType.images.push(ipfsAsset);
        }

        // Add to access level-specific array
        if (accessLevel === AccessLevel.BASIC) {
            ipfsHashes.byAccessLevel.basic.push(ipfsAsset);
        } else if (accessLevel === AccessLevel.PREMIUM) {
            ipfsHashes.byAccessLevel.premium.push(ipfsAsset);
        } else {
            ipfsHashes.byAccessLevel.elite.push(ipfsAsset);
        }
    }

    // Save the organized IPFS hashes
    fs.writeFileSync(
        path.join(process.cwd(), 'ipfs_results', 'ipfs_hashes.json'),
        JSON.stringify(ipfsHashes, null, 2)
    );

    // Print summary
    console.log('\nIPFS Hashes Summary:');
    console.log(`Total assets: ${ipfsHashes.assets.length}`);
    console.log('\nBy Type:');
    console.log(`Music: ${ipfsHashes.byType.music.length}`);
    console.log(`Video: ${ipfsHashes.byType.video.length}`);
    console.log(`Images: ${ipfsHashes.byType.images.length}`);
    console.log('\nBy Access Level:');
    console.log(`Basic: ${ipfsHashes.byAccessLevel.basic.length}`);
    console.log(`Premium: ${ipfsHashes.byAccessLevel.premium.length}`);
    console.log(`Elite: ${ipfsHashes.byAccessLevel.elite.length}`);
}

// Run the script
console.log('Generating IPFS hashes file...');
generateIPFSHashes().catch(console.error); 