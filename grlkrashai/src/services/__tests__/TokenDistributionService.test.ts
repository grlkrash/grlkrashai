import { IAgentRuntime } from '@elizaos/core';
import { TokenDistributionService } from '../payment/TokenDistributionService';
import { TokenContract } from '../types/contracts';

describe('TokenDistributionService', () => {
    let service: TokenDistributionService;
    let mockRuntime: jest.Mocked<IAgentRuntime>;
    let mockTokenContract: jest.Mocked<TokenContract>;

    beforeEach(() => {
        mockRuntime = {
            // Add mock implementation
        } as unknown as jest.Mocked<IAgentRuntime>;

        mockTokenContract = {
            // Add mock implementation
            transfer: jest.fn().mockResolvedValue({ hash: 'test_hash' }),
            balanceOf: jest.fn().mockResolvedValue(1000000)
        } as unknown as jest.Mocked<TokenContract>;

        service = new TokenDistributionService(
            mockRuntime,
            mockTokenContract,
            'test_token_address'
        );
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('Token Distribution', () => {
        test('should distribute tokens based on engagement', async () => {
            const distributionHandler = jest.fn();
            service.on('tokensDistributed', distributionHandler);

            const recipient = '0x123...';
            const amount = 100;
            const metrics = {
                engagement: 0.8,
                reach: 1000,
                conversion: 0.2
            };

            await service.distributeTokens(recipient, amount, metrics);

            expect(distributionHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipient,
                    amount,
                    metrics
                })
            );
            expect(mockTokenContract.transfer).toHaveBeenCalled();
        });

        test('should handle failed distributions', async () => {
            const errorHandler = jest.fn();
            service.on('error', errorHandler);

            // Mock transfer failure
            mockTokenContract.transfer = jest.fn().mockRejectedValue(
                new Error('Transfer failed')
            );

            const recipient = '0x123...';
            const amount = 100;
            const metrics = {
                engagement: 0.8,
                reach: 1000,
                conversion: 0.2
            };

            await service.distributeTokens(recipient, amount, metrics);

            expect(errorHandler).toHaveBeenCalledWith(
                expect.any(Error),
                'distributeTokens'
            );
        });
    });

    describe('Reward Calculation', () => {
        test('should calculate rewards based on metrics', async () => {
            const calculationHandler = jest.fn();
            service.on('rewardCalculated', calculationHandler);

            const metrics = {
                engagement: 0.8,
                reach: 1000,
                conversion: 0.2
            };

            const reward = await service.calculateReward(metrics);

            expect(calculationHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    metrics,
                    amount: expect.any(Number)
                })
            );
            expect(reward).toBeGreaterThan(0);
        });
    });

    describe('Distribution Limits', () => {
        test('should enforce daily distribution limits', async () => {
            const limitHandler = jest.fn();
            service.on('limitReached', limitHandler);

            // Attempt to distribute more than daily limit
            const recipient = '0x123...';
            const largeAmount = 1000000;
            const metrics = {
                engagement: 0.8,
                reach: 1000,
                conversion: 0.2
            };

            await service.distributeTokens(recipient, largeAmount, metrics);

            expect(limitHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipient,
                    attemptedAmount: largeAmount,
                    remainingLimit: expect.any(Number)
                })
            );
        });
    });

    describe('Distribution History', () => {
        test('should track distribution history', async () => {
            const historyHandler = jest.fn();
            service.on('historyUpdated', historyHandler);

            const recipient = '0x123...';
            const amount = 100;
            const metrics = {
                engagement: 0.8,
                reach: 1000,
                conversion: 0.2
            };

            await service.distributeTokens(recipient, amount, metrics);
            const history = await service.getDistributionHistory(recipient);

            expect(historyHandler).toHaveBeenCalled();
            expect(history).toContainEqual(
                expect.objectContaining({
                    recipient,
                    amount,
                    metrics
                })
            );
        });

        test('should clean up old history entries', async () => {
            const cleanupHandler = jest.fn();
            service.on('historyCleanup', cleanupHandler);

            // Add old distribution record
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 100); // 100 days old

            (service as any).distributionHistory.push({
                recipient: '0x123...',
                amount: 100,
                timestamp: oldDate,
                metrics: {
                    engagement: 0.8,
                    reach: 1000,
                    conversion: 0.2
                }
            });

            await service.cleanup();

            expect(cleanupHandler).toHaveBeenCalled();
            const history = (service as any).distributionHistory;
            expect(history.length).toBe(0);
        });
    });
}); 