import { ethers } from 'ethers';
import { CrystalHolder } from '../contracts/CrystalHolder';
import { MemoryCrystal } from '../contracts/MemoryCrystal';

export enum PlayMode {
    SEQUENTIAL = 'SEQUENTIAL',
    SHUFFLE = 'SHUFFLE'
}

export enum SortOrder {
    ID_ASC = 'ID_ASC',
    ID_DESC = 'ID_DESC',
    TYPE = 'TYPE',
    NEWEST = 'NEWEST',
    OLDEST = 'OLDEST'
}

export enum MediaType {
    AUDIO = 'AUDIO',
    VIDEO = 'VIDEO',
    IMAGE = 'IMAGE'
}

export class MediaPlayer {
    private crystals: number[] = [];
    private currentIndex: number = 0;
    private isPlaying: boolean = false;
    private playMode: PlayMode = PlayMode.SEQUENTIAL;
    private sortOrder: SortOrder = SortOrder.ID_ASC;
    private typeFilter: MediaType | null = null;
    private viewer: any; // Replace with actual viewer type
    private holder: Promise<ethers.Contract>;
    private crystal: Promise<ethers.Contract>;

    constructor() {
        // Initialize contracts
        const userAddress = process.env.USER_ADDRESS!;
        this.holder = CrystalHolder.connect(userAddress);
        this.crystal = MemoryCrystal.connect(userAddress);
    }

    public async loadCrystals(crystalIds: number[]) {
        this.crystals = [...crystalIds];
        this.currentIndex = 0;
        await this.applySortingAndFiltering();
    }

    public async play() {
        if (this.crystals.length === 0) {
            throw new Error('No crystals loaded');
        }

        this.isPlaying = true;
        await this.displayCurrentCrystal();
    }

    public async stop() {
        this.isPlaying = false;
        if (this.viewer) {
            this.viewer.close();
            this.viewer = null;
        }
    }

    public setPlayMode(mode: PlayMode) {
        this.playMode = mode;
        if (mode === PlayMode.SHUFFLE) {
            this.shuffleCrystals();
        }
    }

    public setSortOrder(order: SortOrder) {
        this.sortOrder = order;
        this.applySortingAndFiltering();
    }

    public setTypeFilter(type: MediaType | null) {
        this.typeFilter = type;
        this.applySortingAndFiltering();
    }

    private shuffleCrystals() {
        for (let i = this.crystals.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.crystals[i], this.crystals[j]] = [this.crystals[j], this.crystals[i]];
        }
    }

    private async applySortingAndFiltering() {
        // Apply type filter if set
        if (this.typeFilter !== null) {
            const filteredCrystals: number[] = [];
            const crystal = await this.crystal;
            
            for (const id of this.crystals) {
                const metadata = await crystal.getContentMetadata(id);
                if (metadata.type === this.typeFilter) {
                    filteredCrystals.push(id);
                }
            }
            this.crystals = filteredCrystals;
        }

        // Apply sorting
        switch (this.sortOrder) {
            case SortOrder.ID_ASC:
                this.crystals.sort((a, b) => a - b);
                break;
            case SortOrder.ID_DESC:
                this.crystals.sort((a, b) => b - a);
                break;
            case SortOrder.TYPE:
                const crystal = await this.crystal;
                const types = new Map<number, string>();
                for (const id of this.crystals) {
                    const metadata = await crystal.getContentMetadata(id);
                    types.set(id, metadata.type);
                }
                this.crystals.sort((a, b) => {
                    const typeA = types.get(a) || '';
                    const typeB = types.get(b) || '';
                    return typeA.localeCompare(typeB);
                });
                break;
            case SortOrder.NEWEST:
                const newestCrystal = await this.crystal;
                const timestamps = new Map<number, number>();
                for (const id of this.crystals) {
                    const metadata = await newestCrystal.getContentMetadata(id);
                    timestamps.set(id, metadata.timestamp);
                }
                this.crystals.sort((a, b) => {
                    const timeA = timestamps.get(a) || 0;
                    const timeB = timestamps.get(b) || 0;
                    return timeB - timeA;
                });
                break;
            case SortOrder.OLDEST:
                const oldestCrystal = await this.crystal;
                const oldTimestamps = new Map<number, number>();
                for (const id of this.crystals) {
                    const metadata = await oldestCrystal.getContentMetadata(id);
                    oldTimestamps.set(id, metadata.timestamp);
                }
                this.crystals.sort((a, b) => {
                    const timeA = oldTimestamps.get(a) || 0;
                    const timeB = oldTimestamps.get(b) || 0;
                    return timeA - timeB;
                });
                break;
        }
    }

    private async displayCurrentCrystal() {
        if (!this.isPlaying || this.crystals.length === 0) {
            return;
        }

        const currentCrystal = this.crystals[this.currentIndex];
        const holder = await this.holder;
        const crystal = await this.crystal;
        
        // Get media URI and metadata
        const mediaURI = await holder.playMedia(currentCrystal);
        const metadata = await crystal.getContentMetadata(currentCrystal);
        
        // Implementation for displaying crystal content
        // this.viewer = await createViewer(mediaURI, metadata);
        // await this.viewer.display();

        // Auto-advance to next crystal if in sequential mode
        if (this.playMode === PlayMode.SEQUENTIAL) {
            this.currentIndex = (this.currentIndex + 1) % this.crystals.length;
            setTimeout(() => this.displayCurrentCrystal(), 5000); // Adjust timing as needed
        }
    }
} 