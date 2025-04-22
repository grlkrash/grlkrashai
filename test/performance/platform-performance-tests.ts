import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { performance } from 'perf_hooks';
import { PlatformMockGenerator } from '../utils/platform-mock-generator';
import { 
    SpotifyService,
    TwitterService,
    DiscordService,
    TokenDistributionService
} from '../../src/services';

class PlatformPerformanceMonitor {
    private metrics: any[] = [];
    private thresholds = {
        spotify: { p95: 2000, p99: 5000 },
        twitter: { p95: 1500, p99: 3000 },
        discord: { p95: 1000, p99: 2000 },
        distribution: { p95: 500, p99: 1000 }
    };

    async measure(platform: string, operation: string, fn: () => Promise<any>) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.metrics.push({ platform, operation, duration, success: true });
            return { result, duration };
        } catch (error) {
            const duration = performance.now() - start;
            this.metrics.push({ platform, operation, duration, success: false, error });
            throw error;
        }
    }

    validatePerformance(platform: string, duration: number) {
        const threshold = this.thresholds[platform as keyof typeof this.thresholds];
        return {
            meetsP95: duration <= threshold.p95,
            meetsP99: duration <= threshold.p99
        };
    }

    generateReport() {
        const byPlatform = this.metrics.reduce((acc: any, m) => {
            if (!acc[m.platform]) {
                acc[m.platform] = {
                    operations: 0,
                    totalDuration: 0,
                    failures: 0,
                    p95violations: 0,
                    p99violations: 0
                };
            }
            acc[m.platform].operations++;
            acc[m.platform].totalDuration += m.duration;
            if (!m.success) acc[m.platform].failures++;
            
            const perf = this.validatePerformance(m.platform, m.duration);
            if (!perf.meetsP95) acc[m.platform].p95violations++;
            if (!perf.meetsP99) acc[m.platform].p99violations++;
            
            return acc;
        }, {});

        return {
            summary: {
                totalOperations: this.metrics.length,
                successRate: this.metrics.filter(m => m.success).length / this.metrics.length,
                averageDuration: this.metrics.reduce((acc, m) => acc + m.duration, 0) / this.metrics.length
            },
            platforms: Object.entries(byPlatform).map(([platform, stats]: [string, any]) => ({
                platform,
                avgDuration: stats.totalDuration / stats.operations,
                successRate: (stats.operations - stats.failures) / stats.operations,
                p95compliance: (stats.operations - stats.p95violations) / stats.operations,
                p99compliance: (stats.operations - stats.p99violations) / stats.operations
            }))
        };
    }
}

describe('Platform Integration Performance Tests', () => {
    let monitor: PlatformPerformanceMonitor;
    let spotifyService: SpotifyService;
    let twitterService: TwitterService;
    let discordService: DiscordService;
    let tokenDistribution: TokenDistributionService;

    before(() => {
        monitor = new PlatformPerformanceMonitor();
        spotifyService = new SpotifyService();
        twitterService = new TwitterService();
        discordService = new DiscordService();
        tokenDistribution = new TokenDistributionService();
    });

    describe('Concurrent Platform Operations', () => {
        it('should handle multiple platform updates simultaneously', async () => {
            const operations = 10;
            const platforms = ['spotify', 'twitter', 'discord'];
            const tasks = [];

            for (let i = 0; i < operations; i++) {
                for (const platform of platforms) {
                    const data = PlatformMockGenerator.generateEngagementSnapshot();
                    tasks.push(
                        monitor.measure(platform, 'update', async () => {
                            switch (platform) {
                                case 'spotify':
                                    return spotifyService.processEngagement(data);
                                case 'twitter':
                                    return twitterService.processEngagement(data);
                                case 'discord':
                                    return discordService.processEngagement(data);
                            }
                        })
                    );
                }
            }

            const results = await Promise.all(tasks);
            results.forEach(r => {
                const { meetsP95 } = monitor.validatePerformance(
                    r.result.platform,
                    r.duration
                );
                expect(meetsP95).to.be.true;
            });
        });
    });

    describe('Cross-Platform Data Processing', () => {
        it('should efficiently process cross-platform milestones', async () => {
            const batchSize = 50;
            const activities = Array(batchSize).fill(null).map(() => 
                PlatformMockGenerator.generateCrossPlatformActivity()
            );

            const { duration } = await monitor.measure(
                'distribution',
                'milestone_batch',
                () => Promise.all(
                    activities.map(a => tokenDistribution.processCrossPlatformMilestone(a))
                )
            );

            expect(duration / batchSize).to.be.lt(100); // 100ms per milestone max
        });

        it('should handle rapid engagement updates', async () => {
            const updateCount = 100;
            const snapshots = Array(updateCount).fill(null).map(() =>
                PlatformMockGenerator.generateEngagementSnapshot()
            );

            const results = await Promise.all(
                snapshots.map(s =>
                    monitor.measure(
                        'distribution',
                        'engagement_update',
                        () => tokenDistribution.updateEngagementMetrics(s)
                    )
                )
            );

            const avgDuration = results.reduce((acc, r) => acc + r.duration, 0) / updateCount;
            expect(avgDuration).to.be.lt(50); // 50ms per update max
        });
    });

    describe('Platform-Specific Performance', () => {
        it('should maintain Spotify API response times', async () => {
            const operations = 20;
            const tasks = Array(operations).fill(null).map(() => {
                const data = PlatformMockGenerator.spotify();
                return monitor.measure(
                    'spotify',
                    'metrics_update',
                    () => spotifyService.updateMetrics(data)
                );
            });

            const results = await Promise.all(tasks);
            results.forEach(r => {
                const { meetsP95 } = monitor.validatePerformance('spotify', r.duration);
                expect(meetsP95).to.be.true;
            });
        });

        it('should maintain Twitter API response times', async () => {
            const operations = 20;
            const tasks = Array(operations).fill(null).map(() => {
                const data = PlatformMockGenerator.twitter();
                return monitor.measure(
                    'twitter',
                    'engagement_update',
                    () => twitterService.updateEngagement(data)
                );
            });

            const results = await Promise.all(tasks);
            results.forEach(r => {
                const { meetsP95 } = monitor.validatePerformance('twitter', r.duration);
                expect(meetsP95).to.be.true;
            });
        });

        it('should maintain Discord API response times', async () => {
            const operations = 20;
            const tasks = Array(operations).fill(null).map(() => {
                const data = PlatformMockGenerator.discord();
                return monitor.measure(
                    'discord',
                    'activity_update',
                    () => discordService.updateActivity(data)
                );
            });

            const results = await Promise.all(tasks);
            results.forEach(r => {
                const { meetsP95 } = monitor.validatePerformance('discord', r.duration);
                expect(meetsP95).to.be.true;
            });
        });
    });

    after(() => {
        const report = monitor.generateReport();
        console.log('\nPlatform Performance Report:');
        console.log('===========================');
        console.log(`Total Operations: ${report.summary.totalOperations}`);
        console.log(`Overall Success Rate: ${(report.summary.successRate * 100).toFixed(2)}%`);
        console.log(`Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);
        
        console.log('\nPlatform Breakdown:');
        report.platforms.forEach(p => {
            console.log(`\n${p.platform}:`);
            console.log(`  Avg Duration: ${p.avgDuration.toFixed(2)}ms`);
            console.log(`  Success Rate: ${(p.successRate * 100).toFixed(2)}%`);
            console.log(`  P95 Compliance: ${(p.p95compliance * 100).toFixed(2)}%`);
            console.log(`  P99 Compliance: ${(p.p99compliance * 100).toFixed(2)}%`);
        });
    });
}); 