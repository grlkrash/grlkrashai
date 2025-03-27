import { IAgentRuntime } from '@elizaos/core';
import { ContentService } from '../services/ContentService';
import { IPFSContentService } from '../services/IPFSContentService';
import { ContentOptimizationService } from '../services/ContentOptimizationService';
import { DynamicContentService } from '../services/DynamicContentService';
import { ContentAnalysisService } from '../services/ContentAnalysisService';

export class ServiceMigration {
    private runtime: IAgentRuntime;
    private contentService: ContentService;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.contentService = new ContentService(runtime);
    }

    async migrateContentData(
        ipfsContent: IPFSContentService,
        contentOptimization: ContentOptimizationService,
        dynamicContent: DynamicContentService,
        contentAnalysis: ContentAnalysisService
    ): Promise<void> {
        try {
            // Migrate IPFS content data
            const ipfsMetrics = await ipfsContent.getAllContentMetrics();
            for (const [hash, metrics] of Object.entries(ipfsMetrics)) {
                await this.contentService.importContentMetrics(hash, metrics);
            }

            // Migrate optimization settings
            const optimizationSettings = await contentOptimization.getSettings();
            await this.contentService.importOptimizationSettings(optimizationSettings);

            // Migrate dynamic content templates
            const templates = await dynamicContent.getTemplates();
            await this.contentService.importContentTemplates(templates);

            // Migrate content analysis data
            const analysisData = await contentAnalysis.getAnalysisData();
            await this.contentService.importAnalysisData(analysisData);

            console.log('Content data migration completed successfully');
        } catch (error) {
            console.error('Error during content data migration:', error);
            throw error;
        }
    }

    async validateMigration(): Promise<{
        success: boolean;
        issues: string[];
    }> {
        const issues: string[] = [];
        try {
            // Validate content metrics
            const metrics = await this.contentService.getAllContentMetrics();
            if (!metrics || Object.keys(metrics).length === 0) {
                issues.push('Content metrics migration failed or incomplete');
            }

            // Validate optimization settings
            const settings = await this.contentService.getOptimizationSettings();
            if (!settings) {
                issues.push('Optimization settings migration failed');
            }

            // Validate content templates
            const templates = await this.contentService.getContentTemplates();
            if (!templates || templates.length === 0) {
                issues.push('Content templates migration failed or incomplete');
            }

            // Validate analysis data
            const analysisData = await this.contentService.getAnalysisData();
            if (!analysisData) {
                issues.push('Analysis data migration failed');
            }

            return {
                success: issues.length === 0,
                issues
            };
        } catch (error) {
            console.error('Error during migration validation:', error);
            return {
                success: false,
                issues: ['Migration validation failed with error: ' + error.message]
            };
        }
    }

    async rollbackMigration(): Promise<void> {
        try {
            await this.contentService.clearMigratedData();
            console.log('Migration rollback completed successfully');
        } catch (error) {
            console.error('Error during migration rollback:', error);
            throw error;
        }
    }
} 