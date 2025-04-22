import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TokenMockGenerator } from '../utils/token-mock-generator';
import { performance } from 'perf_hooks';
import {
    ContractService,
    TokenDistributionService,
    TokenAnalyticsService
} from '../../src/services';

interface PerformanceMetric {
    operation: string;
    duration: number;
    success: boolean;
    error?: string;
    metadata?: any;
}

class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];

    async measure(operation: string, fn: () => Promise<any>): Promise<PerformanceMetric> {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            const metric = {
                operation,
                duration,
                success: true,
                metadata: result
            };
            this.metrics.push(metric);
            return metric;
        } catch (error: any) {
            const duration = performance.now() - start;
            const metric = {
                operation,
                duration,
                success: false,
                error: error.message
            };
            this.metrics.push(metric);
            return metric;
        }
    }

    getMetrics() {
        return this.metrics;
    }

    generateReport() {
        const totalOperations = this.metrics.length;
        const successfulOperations = this.metrics.filter(m => m.success).length;
        const averageDuration = this.metrics.reduce((acc, m) => acc + m.duration, 0) / totalOperations;

        return {
            totalOperations,
            successfulOperations,
            failedOperations: totalOperations - successfulOperations,
            averageDuration,
            successRate: (successfulOperations / totalOperations) * 100,
            slowestOperation: this.metrics.reduce((a, b) => a.duration > b.duration ? a : b),
            fastestOperation: this.metrics.reduce((a, b) => a.duration < b.duration ? a : b),
            operationBreakdown: this.metrics.reduce((acc: any, m) => {
                if (!acc[m.operation]) {
                    acc[m.operation] = {
                        count: 0,
                        totalDuration: 0,
                        failures: 0
                    };
                }
                acc[m.operation].count++;
                acc[m.operation].totalDuration += m.duration;
                if (!m.success) acc[m.operation].failures++;
                return acc;
            }, {})
        };
    }
}

describe('Token Performance Tests', () => {
    let contractService: ContractService;
    let tokenDistribution: TokenDistributionService;
    let tokenAnalytics: TokenAnalyticsService;
    let monitor: PerformanceMonitor;
    let moreTokenContract: any;

    before(async () => {
        contractService = new ContractService();
        tokenDistribution = new TokenDistributionService();
        tokenAnalytics = new TokenAnalyticsService();
        monitor = new PerformanceMonitor();

        // Get or deploy contract
        moreTokenContract = await contractService.getMoreTokenContract();
        if (!moreTokenContract) {
            moreTokenContract = await contractService.deployMoreToken();
        }
    });

    describe('Token Distribution Performance', () => {
        it('should handle batch distributions efficiently', async () => {
            const batchSizes = [10, 50, 100, 500];
            
            for (const size of batchSizes) {
                const recipients = Array(size).fill(null).map(() => ethers.Wallet.createRandom().address);
                const amounts = recipients.map(() => ethers.utils.parseEther('1'));
                
                const metric = await monitor.measure(
                    `batch_distribution_${size}`,
                    () => tokenDistribution.batchDistribute(recipients, amounts)
                );
                
                expect(metric.success).to.be.true;
                expect(metric.duration).to.be.lt(size * 100); // 100ms per transfer max
            }
        });

        it('should handle concurrent distribution requests', async () => {
            const concurrentRequests = 10;
            const distributions = Array(concurrentRequests).fill(null).map(() => {
                const event = TokenMockGenerator.generateDistributionEvent();
                return monitor.measure(
                    'concurrent_distribution',
                    () => tokenDistribution.distribute(
                        ethers.Wallet.createRandom().address,
                        event.amount
                    )
                );
            });
            
            const results = await Promise.all(distributions);
            const failedRequests = results.filter(r => !r.success);
            
            expect(failedRequests.length).to.equal(0);
            results.forEach(r => {
                expect(r.duration).to.be.lt(1000); // 1 second max per request
            });
        });
    });

    describe('Token Analytics Performance', () => {
        it('should efficiently calculate token metrics', async () => {
            const metric = await monitor.measure(
                'token_metrics_calculation',
                () => tokenAnalytics.getTokenMetrics()
            );
            
            expect(metric.success).to.be.true;
            expect(metric.duration).to.be.lt(5000); // 5 seconds max
        });

        it('should handle large-scale holder analysis', async () => {
            const holderCounts = [100, 500, 1000];
            
            for (const count of holderCounts) {
                const metric = await monitor.measure(
                    `holder_analysis_${count}`,
                    async () => {
                        const holders = Array(count).fill(null).map(() => ({
                            address: ethers.Wallet.createRandom().address,
                            balance: ethers.utils.parseEther(
                                Math.random().toString()
                            )
                        }));
                        return tokenAnalytics.analyzeHolderDistribution(holders);
                    }
                );
                
                expect(metric.success).to.be.true;
                expect(metric.duration).to.be.lt(count * 10); // 10ms per holder max
            }
        });
    });

    describe('Milestone Processing Performance', () => {
        it('should efficiently process milestone batches', async () => {
            const batchSizes = [10, 50, 100];
            
            for (const size of batchSizes) {
                const milestones = Array(size).fill(null).map(() => 
                    TokenMockGenerator.generateMilestone()
                );
                
                const metric = await monitor.measure(
                    `milestone_processing_${size}`,
                    () => Promise.all(
                        milestones.map(m => 
                            tokenDistribution.handleMilestoneAchievement(
                                m,
                                ethers.Wallet.createRandom().address
                            )
                        )
                    )
                );
                
                expect(metric.success).to.be.true;
                expect(metric.duration).to.be.lt(size * 200); // 200ms per milestone max
            }
        });
    });

    describe('Contract Interaction Performance', () => {
        it('should handle rapid contract reads efficiently', async () => {
            const readCount = 100;
            const reads = Array(readCount).fill(null).map(() => 
                monitor.measure(
                    'contract_read',
                    () => moreTokenContract.balanceOf(
                        ethers.Wallet.createRandom().address
                    )
                )
            );
            
            const results = await Promise.all(reads);
            results.forEach(r => {
                expect(r.success).to.be.true;
                expect(r.duration).to.be.lt(100); // 100ms max per read
            });
        });

        it('should maintain performance under load', async () => {
            const operations = 50;
            const tasks = Array(operations).fill(null).map(() => {
                const type = Math.random() > 0.5 ? 'read' : 'write';
                if (type === 'read') {
                    return monitor.measure(
                        'load_test_read',
                        () => moreTokenContract.totalSupply()
                    );
                } else {
                    return monitor.measure(
                        'load_test_write',
                        () => tokenDistribution.distribute(
                            ethers.Wallet.createRandom().address,
                            ethers.utils.parseEther('1')
                        )
                    );
                }
            });
            
            const results = await Promise.all(tasks);
            const successRate = results.filter(r => r.success).length / results.length;
            expect(successRate).to.be.gt(0.95); // 95% success rate minimum
        });
    });

    after(() => {
        const report = monitor.generateReport();
        console.log('\nPerformance Test Report:');
        console.log('=======================');
        console.log(`Total Operations: ${report.totalOperations}`);
        console.log(`Success Rate: ${report.successRate.toFixed(2)}%`);
        console.log(`Average Duration: ${report.averageDuration.toFixed(2)}ms`);
        console.log('\nOperation Breakdown:');
        Object.entries(report.operationBreakdown).forEach(([op, stats]: [string, any]) => {
            console.log(`\n${op}:`);
            console.log(`  Count: ${stats.count}`);
            console.log(`  Avg Duration: ${(stats.totalDuration / stats.count).toFixed(2)}ms`);
            console.log(`  Failures: ${stats.failures}`);
        });
    });
}); 