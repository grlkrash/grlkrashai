import { ethers } from 'hardhat';
import { faker } from '@faker-js/faker';

export class TokenMockGenerator {
    static generateMilestone() {
        const types = [
            'community_growth',
            'content_creation',
            'platform_integration',
            'token_holding',
            'engagement_streak',
            'referral_achievement'
        ];

        const platforms = [
            'spotify',
            'apple_music',
            'youtube',
            'twitter',
            'instagram',
            'tiktok'
        ];

        return {
            id: `milestone_${faker.string.uuid()}`,
            type: faker.helpers.arrayElement(types),
            platform: faker.helpers.arrayElement(platforms),
            target: faker.number.int({ min: 1000, max: 100000 }),
            achieved: faker.number.int({ min: 1000, max: 150000 }),
            reward: ethers.utils.parseEther(
                faker.number.float({ min: 10, max: 1000 }).toString()
            ),
            timestamp: faker.date.recent(),
            metadata: {
                difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
                duration: faker.number.int({ min: 1, max: 30 }), // days
                requirements: Array(3).fill(null).map(() => faker.lorem.sentence()),
                bonusMultiplier: faker.number.float({ min: 1, max: 2, precision: 0.1 })
            }
        };
    }

    static generateDistributionEvent() {
        return {
            id: faker.string.uuid(),
            type: faker.helpers.arrayElement([
                'milestone_reward',
                'community_bonus',
                'platform_integration',
                'referral_reward',
                'staking_reward',
                'engagement_bonus'
            ]),
            amount: ethers.utils.parseEther(
                faker.number.float({ min: 1, max: 100 }).toString()
            ),
            timestamp: faker.date.recent(),
            status: faker.helpers.arrayElement([
                'pending',
                'processing',
                'completed',
                'failed'
            ]),
            metadata: {
                gas: faker.number.int({ min: 50000, max: 300000 }),
                nonce: faker.number.int({ min: 0, max: 1000 }),
                blockNumber: faker.number.int({ min: 1000000, max: 9999999 })
            }
        };
    }

    static generateTokenMetrics() {
        return {
            velocity: faker.number.float({ min: 0.1, max: 5, precision: 0.01 }),
            circulatingSupply: ethers.utils.parseEther(
                faker.number.int({ min: 1000000, max: 10000000 }).toString()
            ),
            holders: faker.number.int({ min: 100, max: 10000 }),
            averageHoldingTime: faker.number.int({ min: 1, max: 365 }), // days
            distribution: {
                community: faker.number.float({ min: 0.3, max: 0.4 }),
                team: faker.number.float({ min: 0.1, max: 0.15 }),
                treasury: faker.number.float({ min: 0.2, max: 0.3 }),
                rewards: faker.number.float({ min: 0.15, max: 0.25 })
            },
            priceMetrics: {
                currentPrice: faker.number.float({ min: 0.1, max: 10, precision: 0.0001 }),
                volume24h: faker.number.float({ min: 10000, max: 1000000 }),
                marketCap: faker.number.float({ min: 1000000, max: 100000000 })
            }
        };
    }

    static generateStakingPosition() {
        return {
            id: faker.string.uuid(),
            amount: ethers.utils.parseEther(
                faker.number.float({ min: 100, max: 10000 }).toString()
            ),
            duration: faker.number.int({ min: 30, max: 365 }), // days
            apy: faker.number.float({ min: 5, max: 20, precision: 0.1 }),
            startTime: faker.date.past(),
            endTime: faker.date.future(),
            rewards: {
                accumulated: ethers.utils.parseEther(
                    faker.number.float({ min: 1, max: 1000 }).toString()
                ),
                claimed: ethers.utils.parseEther(
                    faker.number.float({ min: 0, max: 500 }).toString()
                ),
                multiplier: faker.number.float({ min: 1, max: 2, precision: 0.1 })
            },
            status: faker.helpers.arrayElement([
                'active',
                'locked',
                'completed',
                'withdrawn'
            ])
        };
    }

    static generateVestingSchedule() {
        const totalAmount = faker.number.float({ min: 10000, max: 1000000 });
        const periods = faker.number.int({ min: 4, max: 12 });
        const amountPerPeriod = totalAmount / periods;

        return {
            id: faker.string.uuid(),
            beneficiary: faker.finance.ethereumAddress(),
            totalAmount: ethers.utils.parseEther(totalAmount.toString()),
            startTime: faker.date.future(),
            duration: faker.number.int({ min: 180, max: 1080 }), // days
            periods,
            schedule: Array(periods).fill(null).map((_, index) => ({
                period: index + 1,
                amount: ethers.utils.parseEther(amountPerPeriod.toString()),
                releaseTime: faker.date.future(),
                released: faker.helpers.arrayElement([true, false])
            })),
            metadata: {
                vestingType: faker.helpers.arrayElement([
                    'team',
                    'advisor',
                    'partnership',
                    'development'
                ]),
                cliffPeriod: faker.number.int({ min: 30, max: 180 }), // days
                revocable: faker.datatype.boolean()
            }
        };
    }

    static generateTokenomicsSnapshot() {
        return {
            timestamp: faker.date.recent(),
            totalSupply: ethers.utils.parseEther('100000000'),
            circulatingSupply: ethers.utils.parseEther(
                faker.number.int({ min: 10000000, max: 50000000 }).toString()
            ),
            distribution: {
                publicSale: faker.number.float({ min: 0.3, max: 0.4 }),
                privateSale: faker.number.float({ min: 0.1, max: 0.2 }),
                team: faker.number.float({ min: 0.1, max: 0.15 }),
                advisors: faker.number.float({ min: 0.05, max: 0.1 }),
                ecosystem: faker.number.float({ min: 0.1, max: 0.2 }),
                reserves: faker.number.float({ min: 0.05, max: 0.15 })
            },
            metrics: {
                holders: faker.number.int({ min: 1000, max: 50000 }),
                transactions24h: faker.number.int({ min: 100, max: 5000 }),
                averageTransactionValue: ethers.utils.parseEther(
                    faker.number.float({ min: 100, max: 1000 }).toString()
                )
            },
            stakingStats: {
                totalStaked: ethers.utils.parseEther(
                    faker.number.int({ min: 1000000, max: 10000000 }).toString()
                ),
                stakingAPY: faker.number.float({ min: 5, max: 20, precision: 0.1 }),
                averageStakingDuration: faker.number.int({ min: 30, max: 365 }) // days
            }
        };
    }
} 