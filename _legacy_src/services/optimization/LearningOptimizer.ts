import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { OptimizationMetrics } from './OptimizationManager';

interface LearningModel {
    weights: Map<string, number>;
    biases: Map<string, number>;
    history: {
        features: any;
        outcome: number;
        timestamp: Date;
    }[];
    confidence: number;
}

interface FeatureSet {
    content: {
        length: number;
        type: string;
        hasMedia: boolean;
        mediaType?: string;
        hashtags: string[];
    };
    timing: {
        hourOfDay: number;
        dayOfWeek: number;
        timezone: string;
    };
    audience: {
        size: number;
        demographics: any;
        interests: string[];
    };
    performance: {
        historicalEngagement: number;
        recentTrend: number;
        volatility: number;
    };
}

export class LearningOptimizer extends EventEmitter {
    private runtime: IAgentRuntime;
    private models: Map<string, LearningModel>;
    private readonly LEARNING_RATE = 0.01;
    private readonly MIN_CONFIDENCE = 0.6;
    private readonly HISTORY_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.models = new Map();
    }

    async trainModel(
        platform: string,
        contentId: string,
        features: FeatureSet,
        metrics: OptimizationMetrics
    ): Promise<void> {
        const model = await this.getOrCreateModel(platform, contentId);
        
        // Add to history
        model.history.push({
            features,
            outcome: this.calculateOutcome(metrics),
            timestamp: new Date()
        });

        // Prune old history
        this.pruneHistory(model);

        // Update weights and biases
        await this.updateModelParameters(model, features, metrics);

        // Recalculate confidence
        model.confidence = await this.calculateModelConfidence(model);

        // Save updated model
        this.models.set(`${platform}:${contentId}`, model);
    }

    async predictPerformance(
        platform: string,
        contentId: string,
        features: FeatureSet
    ): Promise<{
        score: number;
        confidence: number;
        factors: { factor: string; weight: number }[];
    }> {
        const model = await this.getOrCreateModel(platform, contentId);
        
        // Calculate prediction
        const score = this.calculatePrediction(model, features);
        
        // Extract important factors
        const factors = this.extractImportantFactors(model, features);

        return {
            score,
            confidence: model.confidence,
            factors
        };
    }

    private async getOrCreateModel(
        platform: string,
        contentId: string
    ): Promise<LearningModel> {
        const key = `${platform}:${contentId}`;
        if (this.models.has(key)) {
            return this.models.get(key)!;
        }

        // Initialize new model
        const model: LearningModel = {
            weights: new Map(),
            biases: new Map(),
            history: [],
            confidence: this.MIN_CONFIDENCE
        };

        this.models.set(key, model);
        return model;
    }

    private calculateOutcome(metrics: OptimizationMetrics): number {
        return (
            metrics.engagement * 0.4 +
            metrics.reach * 0.3 +
            metrics.conversion * 0.3
        );
    }

    private pruneHistory(model: LearningModel): void {
        const cutoff = Date.now() - this.HISTORY_WINDOW;
        model.history = model.history.filter(entry => 
            entry.timestamp.getTime() > cutoff
        );
    }

    private async updateModelParameters(
        model: LearningModel,
        features: FeatureSet,
        metrics: OptimizationMetrics
    ): Promise<void> {
        const flatFeatures = this.flattenFeatures(features);
        const outcome = this.calculateOutcome(metrics);

        // Update weights using gradient descent
        for (const [feature, value] of Object.entries(flatFeatures)) {
            const currentWeight = model.weights.get(feature) || 0;
            const prediction = this.calculatePrediction(model, features);
            const error = outcome - prediction;
            
            const newWeight = currentWeight + this.LEARNING_RATE * error * (value as number);
            model.weights.set(feature, newWeight);
        }

        // Update biases
        for (const category of Object.keys(features)) {
            const currentBias = model.biases.get(category) || 0;
            const prediction = this.calculatePrediction(model, features);
            const error = outcome - prediction;
            
            const newBias = currentBias + this.LEARNING_RATE * error;
            model.biases.set(category, newBias);
        }
    }

    private calculatePrediction(model: LearningModel, features: FeatureSet): number {
        const flatFeatures = this.flattenFeatures(features);
        let prediction = 0;

        // Apply weights
        for (const [feature, value] of Object.entries(flatFeatures)) {
            prediction += (model.weights.get(feature) || 0) * (value as number);
        }

        // Apply biases
        for (const category of Object.keys(features)) {
            prediction += model.biases.get(category) || 0;
        }

        return prediction;
    }

    private flattenFeatures(features: FeatureSet): Record<string, number | boolean> {
        const flat: Record<string, number | boolean> = {};

        // Recursively flatten nested object
        const flatten = (obj: any, prefix = ''): void => {
            for (const [key, value] of Object.entries(obj)) {
                const featureKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flatten(value, featureKey);
                } else if (Array.isArray(value)) {
                    flat[`${featureKey}.length`] = value.length;
                    value.forEach((item, index) => {
                        flat[`${featureKey}.${index}`] = typeof item === 'number' ? item : 1;
                    });
                } else {
                    flat[featureKey] = typeof value === 'number' ? value : value ? 1 : 0;
                }
            }
        };

        flatten(features);
        return flat;
    }

    private async calculateModelConfidence(model: LearningModel): Promise<number> {
        if (model.history.length < 10) {
            return this.MIN_CONFIDENCE;
        }

        // Calculate prediction accuracy
        const recentPredictions = model.history.slice(-10);
        let totalError = 0;

        for (const entry of recentPredictions) {
            const prediction = this.calculatePrediction(model, entry.features);
            const error = Math.abs(prediction - entry.outcome);
            totalError += error;
        }

        const averageError = totalError / recentPredictions.length;
        const confidence = Math.max(
            this.MIN_CONFIDENCE,
            1 - (averageError / 2)
        );

        return confidence;
    }

    private extractImportantFactors(
        model: LearningModel,
        features: FeatureSet
    ): { factor: string; weight: number }[] {
        const flatFeatures = this.flattenFeatures(features);
        const factors: { factor: string; weight: number }[] = [];

        for (const [feature, value] of Object.entries(flatFeatures)) {
            const weight = model.weights.get(feature) || 0;
            const impact = Math.abs(weight * (value as number));
            
            if (impact > 0.1) {
                factors.push({
                    factor: feature,
                    weight: impact
                });
            }
        }

        // Sort by impact
        factors.sort((a, b) => b.weight - a.weight);
        return factors.slice(0, 10); // Return top 10 factors
    }

    async cleanup(): Promise<void> {
        this.models.clear();
        this.removeAllListeners();
    }
} 