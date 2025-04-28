import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { Plugin3DGeneration } from '@plugin-3d-generation';
import { DataProcessingService } from './DataProcessingService';
import path from 'path';
import fs from 'fs/promises';
import { ResourceManager, EventController } from '../../utils/ResourceControl';
import { IPFSService } from './IPFSService'

interface RetryConfig {
    maxAttempts: number;
    delayMs: number;
    backoffFactor: number;
}

interface CollaborationEvents {
    '3dGenerationStarted': (prompt: string) => void;
    '3dGenerationCompleted': (modelPath: string) => void;
    'lyricGenerationStarted': (prompt: string) => void;
    'lyricGenerationCompleted': (lyrics: string) => void;
    'trainingStarted': (type: string) => void;
    'trainingCompleted': (type: string, metrics: any) => void;
    'error': (error: Error, context: string) => void;
    'initializationStarted': () => void;
    'initializationCompleted': () => void;
    'initializationFailed': (error: Error) => void;
    'recoveryStarted': (context: string) => void;
    'recoveryCompleted': (context: string) => void;
    'recoveryFailed': (context: string, error: Error) => void;
    '3dTrainingProgress': (data: { epoch: number; loss: number; accuracy: number }) => void;
    'lyricsTrainingProgress': (data: { epoch: number; loss: number; accuracy: number }) => void;
}

interface GenerationConfig {
    baseModel: string;
    styleReference?: string;
    iterations?: number;
    temperature?: number;
}

interface TrainingMetrics {
    loss: number;
    accuracy: number;
    epochsCompleted: number;
}

enum ServiceState {
    UNINITIALIZED = 'UNINITIALIZED',
    INITIALIZING = 'INITIALIZING',
    READY = 'READY',
    ERROR = 'ERROR'
}

export class CollaborationService extends EventController {
    private runtime: IAgentRuntime;
    private generator3D: Plugin3DGeneration;
    private dataProcessor: DataProcessingService;
    private ipfsService: IPFSService;
    private readonly ASSETS_PATH = path.join(__dirname, 'assets');
    private readonly MODEL_CACHE = new Map<string, any>();
    private readonly LYRIC_CACHE = new Map<string, string[]>();
    private isTraining = false;
    private state: ServiceState = ServiceState.UNINITIALIZED;
    private initializationPromise: Promise<void> | null = null;
    private initializationError: Error | null = null;
    private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
        maxAttempts: 3,
        delayMs: 1000,
        backoffFactor: 2
    };
    private eventQueue: Array<{event: string, args: any[]}> = [];
    private isInitialized = false;
    private resourceManager: ResourceManager;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.generator3D = new Plugin3DGeneration();
        this.dataProcessor = new DataProcessingService();
        this.ipfsService = new IPFSService();
        this.resourceManager = ResourceManager.getInstance();
        this.initialize();
    }

    private initialize(): void {
        if (this.initializationPromise) return;

        this.state = ServiceState.INITIALIZING;
        this.emit('initializationStarted');

        this.initializationPromise = this.initializeService()
            .then(() => {
                this.state = ServiceState.READY;
                this.emit('initializationCompleted');
            })
            .catch((error) => {
                this.state = ServiceState.ERROR;
                this.initializationError = error;
                this.emit('initializationFailed', error);
                throw error;
            });
    }

    private async ensureReady(): Promise<void> {
        switch (this.state) {
            case ServiceState.READY:
                return;
            case ServiceState.ERROR:
                await this.attemptRecovery();
                break;
            case ServiceState.INITIALIZING:
                if (!this.initializationPromise) {
                    throw new Error('Initialization promise not found');
                }
                await this.initializationPromise;
                break;
            case ServiceState.UNINITIALIZED:
                this.initialize();
                await this.initializationPromise;
                break;
        }
    }

    private async initializeService(): Promise<void> {
        try {
            await this.loadBaseModels();
            await this.loadLyricDatabase();
            this.isInitialized = true;
            this.eventQueue.forEach(({event, args}) => super.emit(event, ...args));
            this.eventQueue = [];
        } catch (error) {
            this.emit('error', error, 'Service Initialization');
            throw error;
        }
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
        context: string,
        config: Partial<RetryConfig> = {}
    ): Promise<T> {
        const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config };
        let lastError: Error;
        let delay = retryConfig.delayMs;

        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt === retryConfig.maxAttempts) break;

                this.emit('error', error, `${context} (Attempt ${attempt}/${retryConfig.maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= retryConfig.backoffFactor;
            }
        }

        throw lastError;
    }

    private async attemptRecovery(): Promise<void> {
        if (this.state !== ServiceState.ERROR) return;

        this.emit('recoveryStarted', 'Service Recovery');
        
        try {
            this.state = ServiceState.INITIALIZING;
            await this.withRetry(
                async () => {
                    await this.initializeService();
                    this.state = ServiceState.READY;
                    this.initializationError = null;
                    this.emit('recoveryCompleted', 'Service Recovery');
                },
                'Service Recovery',
                { maxAttempts: 5, delayMs: 5000 }
            );
        } catch (error) {
            this.state = ServiceState.ERROR;
            this.initializationError = error;
            this.emit('recoveryFailed', 'Service Recovery', error);
            throw error;
        }
    }

    private async loadBaseModels() {
        try {
            const modelAssets = await this.ipfsService.getAssetByType('blend');
            for (const assetKey of modelAssets) {
                const modelData = await this.ipfsService.getAsset(assetKey);
                this.MODEL_CACHE.set(assetKey, modelData);
            }
            this.emit('initializationCompleted');
        } catch (error) {
            this.emit('error', error as Error, 'loadBaseModels');
            throw error;
        }
    }

    private async loadLyricDatabase() {
        const lyricsPath = path.join(this.ASSETS_PATH, 'lyrics');
        const files = await fs.readdir(lyricsPath);
        
        await Promise.all(files.map(async (file) => {
            if (file.endsWith('.txt')) {
                await this.withRetry(
                    async () => {
                        const processed = await this.dataProcessor.processLyrics(path.join(lyricsPath, file));
                        const content = await fs.readFile(processed.processedPath, 'utf-8');
                        this.LYRIC_CACHE.set(file, content.split('\n'));
                    },
                    `Loading lyrics: ${file}`
                );
            }
        }));
    }

    async generate3DModel(prompt: string, config: GenerationConfig) {
        await this.ensureReady();
        this.emit('3dGenerationStarted', prompt);

        try {
            const baseModel = await this.ipfsService.getAsset(config.baseModel);
            const result = await this.generator3D.generate(baseModel, prompt, config);
            this.emit('3dGenerationCompleted', result.modelPath);
            return result;
        } catch (error) {
            this.emit('error', error as Error, 'generate3DModel');
            throw error;
        }
    }

    async generateLyrics(prompt: string, config: GenerationConfig) {
        await this.ensureReady();
        
        return this.withRetry(async () => {
            this.emit('lyricGenerationStarted', prompt);

            const referenceLyrics = Array.from(this.LYRIC_CACHE.values())
                .flat()
                .join('\n');

            const result = await this.runtime.llm.complete({
                prompt: `Based on these reference lyrics:\n${referenceLyrics}\n\nGenerate new lyrics with this prompt: ${prompt}`,
                temperature: config.temperature || 0.9,
                maxTokens: 500
            });

            this.emit('lyricGenerationCompleted', result);
            return result;
        }, 'Lyric Generation');
    }

    async train3DModel(trainingConfig: { epochs: number; batchSize: number }) {
        await this.ensureReady();
        
        const release = await this.resourceManager.acquire(['gpu', 'training']);
        try {
            this.emit('trainingStarted', '3d');
            const assets = await Promise.all(
                Array.from(this.MODEL_CACHE.entries())
                    .map(([_, model]) => this.dataProcessor.process3DAsset(model))
            );

            const trainingData = await this.dataProcessor.prepareTrainingData(assets);
            let currentEpoch = 0;
            
            const metrics = await this.generator3D.train({
                data: trainingData['3d'],
                ...trainingConfig,
                onProgress: (epochData: any) => {
                    currentEpoch = epochData.epoch;
                    this.emit('3dTrainingProgress', epochData);
                }
            });

            this.emit('trainingCompleted', '3d', metrics);
            return metrics;
        } finally {
            release();
        }
    }

    async trainLyricGeneration(trainingConfig: { epochs: number; batchSize: number }) {
        await this.ensureReady();
        
        if (this.isTraining) throw new Error('Training already in progress');
        
        try {
            this.isTraining = true;
            this.emit('trainingStarted', 'lyrics');

            return await this.withRetry(async () => {
                const assets = await Promise.all(
                    Array.from(this.LYRIC_CACHE.entries())
                        .map(([file]) => this.dataProcessor.processLyrics(path.join(this.ASSETS_PATH, 'lyrics', file)))
                );

                const trainingData = await this.dataProcessor.prepareTrainingData(assets);
                
                let currentEpoch = 0;
                const metrics = await this.runtime.llm.train({
                    data: trainingData['lyrics'],
                    ...trainingConfig,
                    onProgress: (epochData: any) => {
                        currentEpoch = epochData.epoch;
                        this.emit('lyricsTrainingProgress', epochData);
                    }
                });

                this.emit('trainingCompleted', 'lyrics', metrics);
                return metrics;
            }, 'Lyrics Training');
        } finally {
            this.isTraining = false;
        }
    }

    async getServiceState(): Promise<{ 
        state: ServiceState; 
        error?: string;
        modelCount?: number;
        lyricCount?: number;
    }> {
        const state = {
            state: this.state,
            modelCount: this.MODEL_CACHE.size,
            lyricCount: this.LYRIC_CACHE.size
        };

        if (this.state === ServiceState.ERROR && this.initializationError) {
            return { ...state, error: this.initializationError.message };
        }

        return state;
    }

    async cleanup() {
        await this.ensureReady();
        this.MODEL_CACHE.clear();
        this.LYRIC_CACHE.clear();
    }

    private queueEvent(event: string, ...args: any[]): void {
        if (!this.isInitialized) {
            this.eventQueue.push({event, args});
        } else {
            super.emit(event, ...args);
        }
    }

    emit(event: string, ...args: any[]): boolean {
        return this.queueEvent(event, ...args);
    }
} 