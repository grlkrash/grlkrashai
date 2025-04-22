import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { performance } from 'perf_hooks';
import { AutonomousMockGenerator } from '../utils/autonomous-mock-generator';
import {
    AutoEngagementService,
    CampaignAutomationService,
    ContentSchedulerService,
    AnalyticsService
} from '../../src/services';

class AutonomousPerformanceMonitor {
    private metrics: any[] = [];
    private thresholds = {
        campaign: { p95: 1000, p99: 2000 },
        engagement: { p95: 500, p99: 1000 },
        content: { p95: 2000, p99: 5000 },
        analytics: { p95: 1000, p99: 3000 }
    };

    async measure(category: string, operation: string, fn: () => Promise<any>) {
        const start = performance.now();
        const heapStart = process.memoryUsage().heapUsed;
        
        try {
            const result = await fn();
            const duration = performance.now() - start;
            const heapUsed = process.memoryUsage().heapUsed - heapStart;
            
            this.metrics.push({
                category,
                operation,
                duration,
                heapUsed,
                success: true
            });
            
            return { result, duration, heapUsed };
        } catch (error) {
            const duration = performance.now() - start;
            const heapUsed = process.memoryUsage().heapUsed - heapStart;
            
            this.metrics.push({
                category,
                operation,
                duration,
                heapUsed,
                success: false,
                error
            });
            
            throw error;
        }
    }

    validatePerformance(category: string, duration: number) {
        const threshold = this.thresholds[category as keyof typeof this.thresholds];
        return {
            meetsP95: duration <= threshold.p95,
            meetsP99: duration <= threshold.p99
        };
    }

    generateReport() {
        const byCategory = this.metrics.reduce((acc: any, m) => {
            if (!acc[m.category]) {
                acc[m.category] = {
                    operations: 0,
                    totalDuration: 0,
                    totalHeap: 0,
                    failures: 0,
                    p95violations: 0,
                    p99violations: 0
                };
            }
            
            acc[m.category].operations++;
            acc[m.category].totalDuration += m.duration;
            acc[m.category].totalHeap += m.heapUsed;
            if (!m.success) acc[m.category].failures++;
            
            const perf = this.validatePerformance(m.category, m.duration);
            if (!perf.meetsP95) acc[m.category].p95violations++;
            if (!perf.meetsP99) acc[m.category].p99violations++;
            
            return acc;
        }, {});

        return {
            summary: {
                totalOperations: this.metrics.length,
                successRate: this.metrics.filter(m => m.success).length / this.metrics.length,
                averageDuration: this.metrics.reduce((acc, m) => acc + m.duration, 0) / this.metrics.length,
                totalHeapUsed: this.metrics.reduce((acc, m) => acc + m.heapUsed, 0)
            },
            categories: Object.entries(byCategory).map(([category, stats]: [string, any]) => ({
                category,
                avgDuration: stats.totalDuration / stats.operations,
                avgHeapUsed: stats.totalHeap / stats.operations,
                successRate: (stats.operations - stats.failures) / stats.operations,
                p95compliance: (stats.operations - stats.p95violations) / stats.operations,
                p99compliance: (stats.operations - stats.p99violations) / stats.operations
            }))
        };
    }
}

describe('Autonomous Operations Performance Tests', () => {
    let monitor: AutonomousPerformanceMonitor;
    let autoEngagement: AutoEngagementService;
    let campaignAutomation: CampaignAutomationService;
    let contentScheduler: ContentSchedulerService;
    let analytics: AnalyticsService;

    before(() => {
        monitor = new AutonomousPerformanceMonitor();
        autoEngagement = new AutoEngagementService();
        campaignAutomation = new CampaignAutomationService();
        contentScheduler = new ContentSchedulerService();
        analytics = new AnalyticsService();
    });

    describe('Campaign Automation Performance', () => {
        it('should handle concurrent campaign optimizations', async () => {
            const campaigns = Array(10).fill(null).map(() => 
                AutonomousMockGenerator.generateCampaign()
            );
            
            const results = await Promise.all(
                campaigns.map(c =>
                    monitor.measure(
                        'campaign',
                        'optimize',
                        () => campaignAutomation.optimizeCampaign(c)
                    )
                )
            );
            
            results.forEach(r => {
                const { meetsP95 } = monitor.validatePerformance('campaign', r.duration);
                expect(meetsP95).to.be.true;
                expect(r.heapUsed).to.be.lt(50 * 1024 * 1024); // 50MB max
            });
        });

        it('should efficiently process campaign metrics', async () => {
            const metrics = Array(100).fill(null).map(() => 
                AutonomousMockGenerator.generateAutonomousMetrics()
            );
            
            const { duration, heapUsed } = await monitor.measure(
                'campaign',
                'process_metrics',
                () => Promise.all(
                    metrics.map(m => campaignAutomation.processCampaignMetrics(m))
                )
            );
            
            expect(duration / metrics.length).to.be.lt(10); // 10ms per metric
            expect(heapUsed / metrics.length).to.be.lt(1024 * 1024); // 1MB per metric
        });
    });

    describe('Autonomous Engagement Performance', () => {
        it('should maintain performance under high engagement load', async () => {
            const operations = Array(500).fill(null).map(() => 
                AutonomousMockGenerator.generateAutonomousOperation()
            );
            
            const chunks = Array(10).fill(null).map((_, i) => 
                operations.slice(i * 50, (i + 1) * 50)
            );
            
            for (const chunk of chunks) {
                const { duration } = await monitor.measure(
                    'engagement',
                    'batch_process',
                    () => Promise.all(
                        chunk.map(op => autoEngagement.processOperation(op))
                    )
                );
                
                expect(duration / chunk.length).to.be.lt(20); // 20ms per operation
            }
        });

        it('should efficiently adapt engagement strategies', async () => {
            const strategies = Array(20).fill(null).map(() =>
                AutonomousMockGenerator.generateEngagementStrategy()
            );
            
            const results = await Promise.all(
                strategies.map(s =>
                    monitor.measure(
                        'engagement',
                        'adapt_strategy',
                        () => autoEngagement.adaptStrategy(s)
                    )
                )
            );
            
            const avgDuration = results.reduce((acc, r) => acc + r.duration, 0) / results.length;
            expect(avgDuration).to.be.lt(100); // 100ms average
        });
    });

    describe('Content Scheduling Performance', () => {
        it('should handle rapid content adaptations', async () => {
            const contentCount = 50;
            const adaptations = Array(contentCount).fill(null).map(() => ({
                content: AutonomousMockGenerator.generateAutonomousOperation(),
                metrics: AutonomousMockGenerator.generateAutonomousMetrics()
            }));
            
            const results = await Promise.all(
                adaptations.map(a =>
                    monitor.measure(
                        'content',
                        'adapt',
                        () => contentScheduler.adaptContent(a.content, a.metrics)
                    )
                )
            );
            
            results.forEach(r => {
                expect(r.duration).to.be.lt(200); // 200ms max per adaptation
            });
        });

        it('should optimize content distribution schedules', async () => {
            const scheduleCount = 100;
            const operations = Array(scheduleCount).fill(null).map(() =>
                AutonomousMockGenerator.generateAutonomousOperation()
            );
            
            const { duration } = await monitor.measure(
                'content',
                'optimize_schedule',
                () => contentScheduler.optimizeSchedule(operations)
            );
            
            expect(duration).to.be.lt(1000); // 1 second max for full optimization
        });
    });

    describe('Analytics Processing Performance', () => {
        it('should efficiently process large metric batches', async () => {
            const metricCount = 1000;
            const metrics = Array(metricCount).fill(null).map(() =>
                AutonomousMockGenerator.generateAutonomousMetrics()
            );
            
            const { duration, heapUsed } = await monitor.measure(
                'analytics',
                'process_metrics',
                () => analytics.processMetricsBatch(metrics)
            );
            
            expect(duration / metricCount).to.be.lt(5); // 5ms per metric
            expect(heapUsed / metricCount).to.be.lt(512 * 1024); // 512KB per metric
        });

        it('should handle real-time analytics updates', async () => {
            const updateCount = 100;
            const updates = Array(updateCount).fill(null).map(() => ({
                metrics: AutonomousMockGenerator.generateAutonomousMetrics(),
                error: AutonomousMockGenerator.generateErrorScenario()
            }));
            
            const results = await Promise.all(
                updates.map(u =>
                    monitor.measure(
                        'analytics',
                        'realtime_update',
                        () => analytics.processRealtimeUpdate(u)
                    )
                )
            );
            
            const avgDuration = results.reduce((acc, r) => acc + r.duration, 0) / results.length;
            expect(avgDuration).to.be.lt(50); // 50ms average
        });
    });

    after(() => {
        const report = monitor.generateReport();
        console.log('\nAutonomous Operations Performance Report:');
        console.log('======================================');
        console.log(`Total Operations: ${report.summary.totalOperations}`);
        console.log(`Success Rate: ${(report.summary.successRate * 100).toFixed(2)}%`);
        console.log(`Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);
        console.log(`Total Heap Used: ${(report.summary.totalHeapUsed / 1024 / 1024).toFixed(2)}MB`);
        
        console.log('\nCategory Breakdown:');
        report.categories.forEach(c => {
            console.log(`\n${c.category}:`);
            console.log(`  Avg Duration: ${c.avgDuration.toFixed(2)}ms`);
            console.log(`  Avg Heap Used: ${(c.avgHeapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Success Rate: ${(c.successRate * 100).toFixed(2)}%`);
            console.log(`  P95 Compliance: ${(c.p95compliance * 100).toFixed(2)}%`);
            console.log(`  P99 Compliance: ${(c.p99compliance * 100).toFixed(2)}%`);
        });
    });
}); 