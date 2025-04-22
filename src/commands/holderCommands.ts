import { ethers } from 'ethers';
import { CrystalHolder } from '../contracts/CrystalHolder';
import { MediaPlayer, PlayMode, SortOrder, MediaType } from '../utils/mediaPlayer';

// Singleton media player instance
const mediaPlayer = new MediaPlayer();

export async function handleHolderMint(crystalId: number, userAddress: string) {
    try {
        const holder = await CrystalHolder.connect(userAddress);
        const tx = await holder.bindCrystal(crystalId);
        await tx.wait();
        
        return {
            message: `✨ Crystal #${crystalId} has been added to your holder!`
        };
    } catch (error: any) {
        return {
            message: `❌ Error adding crystal to holder: ${error.message}`
        };
    }
}

export async function handleHolderPlay(
    userAddress: string,
    playMode?: PlayMode,
    sortOrder?: SortOrder,
    mediaType?: MediaType | null
) {
    try {
        const holder = await CrystalHolder.connect(userAddress);
        const crystals = await holder.getBoundCrystals();
        
        if (crystals.length === 0) {
            return {
                message: "❌ No crystals in your holder! Forge some crystals first."
            };
        }

        // Update media player settings
        if (playMode !== undefined) {
            mediaPlayer.setPlayMode(playMode);
        }
        if (sortOrder !== undefined) {
            mediaPlayer.setSortOrder(sortOrder);
        }
        if (mediaType !== undefined) {
            mediaPlayer.setTypeFilter(mediaType);
        }
        
        // Load and start playing crystals
        await mediaPlayer.loadCrystals(crystals);
        await mediaPlayer.play();
        
        // Format message based on settings
        let message = "🎵 Playing your crystal collection";
        if (playMode === PlayMode.SHUFFLE) {
            message += " (shuffled)";
        }
        if (sortOrder !== undefined) {
            message += ` (sorted by ${SortOrder[sortOrder].toLowerCase()})`;
        }
        if (mediaType !== null) {
            message += ` (${mediaType ? MediaType[mediaType].toLowerCase() : 'all'} media only)`;
        }
        
        return { message };
    } catch (error: any) {
        return {
            message: `❌ Error playing holder: ${error.message}`
        };
    }
}

export async function handleHolderStop() {
    try {
        await mediaPlayer.stop();
        return {
            message: "⏹️ Stopped playing"
        };
    } catch (error: any) {
        return {
            message: `❌ Error stopping playback: ${error.message}`
        };
    }
}

export async function handleHolderList(userAddress: string) {
    try {
        const holder = await CrystalHolder.connect(userAddress);
        const crystals = await holder.getBoundCrystals();
        
        if (crystals.length === 0) {
            return {
                message: "❌ No crystals in your holder! Forge some crystals first."
            };
        }
        
        const message = `🔮 Your Crystal Collection:\n\n` +
            crystals.map(id => `Crystal #${id}`).join('\n');
            
        return { message };
    } catch (error: any) {
        return {
            message: `❌ Error listing crystals: ${error.message}`
        };
    }
} 