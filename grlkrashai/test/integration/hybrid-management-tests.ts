import { describe, it, beforeAll, afterAll } from '@jest/globals';
import { ethers } from 'ethers';
import { LedgerService } from '../../src/services/LedgerService';
import { WebInterfaceService } from '../../src/services/interface/WebInterfaceService';
import { MetricsService } from '../../src/services/analytics/MetricsService';
import { SpotifyAnalyticsService } from '../../src/services/analytics/SpotifyAnalyticsService';
import { TokenAnalyticsService } from '../../src/services/analytics/TokenAnalyticsService';
import { AutoEngagementService } from '../../src/services/engagement/AutoEngagementService';
import { DynamicLiquidityService } from '../../src/services/liquidity/DynamicLiquidityService';

describe('Hybrid Management System Tests', () => {
    let ledgerService: LedgerService;
    let webInterface: WebInterfaceService;
    let metricsService: MetricsService;
    let spotifyAnalytics: SpotifyAnalyticsService;
    let tokenAnalytics: TokenAnalyticsService;
    let autoEngagement: AutoEngagementService;
    let liquidityService: DynamicLiquidityService;

    beforeAll(async () => {
        // Initialize services
        ledgerService = LedgerService.getInstance();
        spotifyAnalytics = new SpotifyAnalyticsService();
        tokenAnalytics = new TokenAnalyticsService();
        autoEngagement = new AutoEngagementService();
        
        metricsService = MetricsService.getInstance(
            spotifyAnalytics,
            tokenAnalytics,
            autoEngagement
        );
        
        webInterface = WebInterfaceService.getInstance(
            spotifyAnalytics,
            tokenAnalytics,
            autoEngagement
        );

        liquidityService = new DynamicLiquidityService(
            global.mockData.token,
            spotifyAnalytics,
            tokenAnalytics,
            autoEngagement
        );

        // Connect Ledger
        await ledgerService.connect();
    });

    describe('Ledger Integration', () => {
        it('should connect to Ledger device', async () => {
            expect(ledgerService.isConnected()).toBe(true);
        });

        it('should retrieve correct admin address', async () => {
            const address = await ledgerService.getAddress();
            expect(address).toBe(process.env.ADMIN_ADDRESS);
        });

        it('should sign transactions', async () => {
            const tx = {
                to: ethers.ZeroAddress,
                value: 0n,
                data: '0x'
            };
            const signature = await ledgerService.signTransaction(tx);
            expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
        });

        it('should handle multiple signing requests', async () => {
            const txs = Array(3).fill(null).map(() => ({
                to: ethers.ZeroAddress,
                value: 0n,
                data: '0x'
            }));

            const signatures = await Promise.all(
                txs.map(tx => ledgerService.signTransaction(tx))
            );

            signatures.forEach(sig => {
                expect(sig).toMatch(/^0x[a-fA-F0-9]+$/);
            });
        });

        it('should handle disconnection and reconnection', async () => {
            await ledgerService.disconnect();
            expect(ledgerService.isConnected()).toBe(false);

            await ledgerService.reconnect();
            expect(ledgerService.isConnected()).toBe(true);
        });
    });

    describe('Metrics and Analytics', () => {
        it('should track streaming metrics', async () => {
            const metrics = await metricsService.getStreamingMetrics();
            expect(metrics).toHaveProperty('total');
            expect(metrics).toHaveProperty('daily');
            expect(metrics).toHaveProperty('growth');
            expect(typeof metrics.total).toBe('number');
        });

        it('should track token metrics', async () => {
            const metrics = await metricsService.getTokenMetrics();
            expect(metrics).toHaveProperty('price');
            expect(metrics).toHaveProperty('volume');
            expect(metrics).toHaveProperty('liquidity');
        });

        it('should track engagement metrics', async () => {
            const metrics = await metricsService.getEngagementMetrics();
            expect(metrics).toHaveProperty('users');
            expect(metrics).toHaveProperty('interactions');
            expect(metrics).toHaveProperty('rewards');
        });
    });

    describe('Dynamic Liquidity Management', () => {
        it('should calculate correct liquidity targets', async () => {
            const metrics = {
                streams: 50000,
                volume24h: 100000,
                currentLiquidity: 50000
            };

            await liquidityService.checkAndAdjustLiquidity(metrics);
            const events = await new Promise(resolve => {
                const events: any[] = [];
                liquidityService.once('liquidityAdded', e => events.push(e));
                liquidityService.once('liquidityRemoved', e => events.push(e));
                setTimeout(() => resolve(events), 1000);
            });

            expect(events.length).toBeGreaterThan(0);
        });

        it('should handle rate limiting for adjustments', async () => {
            const metrics = {
                streams: 50000,
                volume24h: 100000,
                currentLiquidity: 50000
            };

            // Multiple rapid adjustments should be rate limited
            await Promise.all([
                liquidityService.checkAndAdjustLiquidity(metrics),
                liquidityService.checkAndAdjustLiquidity(metrics),
                liquidityService.checkAndAdjustLiquidity(metrics)
            ]);

            const events = await new Promise(resolve => {
                const events: any[] = [];
                liquidityService.once('liquidityAdded', e => events.push(e));
                liquidityService.once('liquidityRemoved', e => events.push(e));
                setTimeout(() => resolve(events), 1000);
            });

            expect(events.length).toBeLessThanOrEqual(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle Ledger errors gracefully', async () => {
            // Simulate Ledger error
            jest.spyOn(ledgerService as any, 'eth').mockImplementationOnce(() => {
                throw new Error('Device error');
            });

            await expect(ledgerService.signMessage('test')).rejects.toThrow();
            expect(ledgerService.isConnected()).toBe(false);

            // Should recover
            await ledgerService.reconnect();
            expect(ledgerService.isConnected()).toBe(true);
        });

        it('should handle rate limit errors', async () => {
            const requests = Array(200).fill(null).map(() => 
                webInterface.makeRequest('/api/metrics')
            );

            const results = await Promise.allSettled(requests);
            const failed = results.filter(r => r.status === 'rejected');
            expect(failed.length).toBeGreaterThan(0);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete milestone flow', async () => {
            // 1. Verify Ledger connection
            expect(ledgerService.isConnected()).toBe(true);

            // 2. Get current metrics
            const beforeMetrics = await metricsService.getStreamingMetrics();

            // 3. Simulate milestone reached
            const milestone = {
                type: 'streaming',
                target: beforeMetrics.total + 10000,
                reward: ethers.parseEther('100')
            };

            // 4. Check liquidity adjustment
            const liquidityBefore = (await metricsService.getTokenMetrics()).liquidity;
            
            await liquidityService.checkAndAdjustLiquidity({
                streams: milestone.target,
                volume24h: 100000,
                currentLiquidity: liquidityBefore
            });

            const liquidityAfter = (await metricsService.getTokenMetrics()).liquidity;
            expect(liquidityAfter).not.toBe(liquidityBefore);
        });
    });

    afterAll(async () => {
        await ledgerService.disconnect();
    });
}); 