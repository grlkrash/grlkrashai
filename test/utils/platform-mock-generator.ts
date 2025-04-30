import { faker } from '@faker-js/faker';
import { ethers } from 'hardhat';

export class PlatformMockGenerator {
    static spotify() {
        return {
            artist: {
                id: faker.string.uuid(),
                name: faker.person.fullName(),
                monthlyListeners: faker.number.int({ min: 1000, max: 1000000 }),
                followers: faker.number.int({ min: 100, max: 100000 }),
                tracks: Array(5).fill(null).map(() => ({
                    id: faker.string.uuid(),
                    title: faker.music.songName(),
                    plays: faker.number.int({ min: 1000, max: 100000 }),
                    playlists: faker.number.int({ min: 10, max: 1000 }),
                    duration: faker.number.int({ min: 120, max: 300 })
                }))
            },
            engagement: {
                saves: faker.number.int({ min: 100, max: 10000 }),
                shares: faker.number.int({ min: 10, max: 1000 }),
                playlistAdds: faker.number.int({ min: 50, max: 500 }),
                uniqueListeners: faker.number.int({ min: 500, max: 50000 })
            },
            metrics: {
                avgPlayDuration: faker.number.int({ min: 60, max: 240 }),
                completionRate: faker.number.float({ min: 0.6, max: 0.95 }),
                skipRate: faker.number.float({ min: 0.05, max: 0.2 }),
                growthRate: faker.number.float({ min: 0.01, max: 0.5 })
            }
        };
    }

    static twitter() {
        const hashtags = Array(3).fill(null).map(() => faker.word.sample());
        return {
            profile: {
                handle: `@${faker.internet.userName()}`,
                followers: faker.number.int({ min: 1000, max: 100000 }),
                following: faker.number.int({ min: 100, max: 5000 }),
                tweets: faker.number.int({ min: 100, max: 10000 })
            },
            tweets: Array(5).fill(null).map(() => ({
                id: faker.string.uuid(),
                content: faker.lorem.sentence(),
                hashtags,
                likes: faker.number.int({ min: 10, max: 10000 }),
                retweets: faker.number.int({ min: 5, max: 5000 }),
                replies: faker.number.int({ min: 1, max: 1000 }),
                impressions: faker.number.int({ min: 100, max: 100000 })
            })),
            engagement: {
                engagementRate: faker.number.float({ min: 0.01, max: 0.1 }),
                clickThrough: faker.number.float({ min: 0.01, max: 0.05 }),
                mentionCount: faker.number.int({ min: 10, max: 1000 })
            }
        };
    }

    static discord() {
        return {
            user: {
                id: faker.string.uuid(),
                username: faker.internet.userName(),
                discriminator: faker.number.int({ min: 1000, max: 9999 }),
                roles: Array(3).fill(null).map(() => 
                    faker.helpers.arrayElement([
                        'community_leader',
                        'moderator',
                        'contributor',
                        'active_member'
                    ])
                )
            },
            activity: {
                messageCount: faker.number.int({ min: 100, max: 5000 }),
                reactionsGiven: faker.number.int({ min: 50, max: 1000 }),
                reactionsReceived: faker.number.int({ min: 50, max: 1000 }),
                threadParticipation: faker.number.int({ min: 10, max: 100 }),
                voiceMinutes: faker.number.int({ min: 60, max: 3600 })
            },
            contribution: {
                helpfulResponses: faker.number.int({ min: 10, max: 200 }),
                eventParticipation: faker.number.int({ min: 1, max: 20 }),
                resourcesShared: faker.number.int({ min: 5, max: 50 }),
                reportedIssues: faker.number.int({ min: 1, max: 10 })
            }
        };
    }

    static generateCrossPlatformActivity() {
        return {
            userId: faker.string.uuid(),
            platforms: {
                spotify: this.spotify(),
                twitter: this.twitter(),
                discord: this.discord()
            },
            metrics: {
                totalEngagement: faker.number.int({ min: 1000, max: 100000 }),
                crossPlatformMultiplier: faker.number.float({ min: 1, max: 2 }),
                consistencyScore: faker.number.float({ min: 0.7, max: 1 }),
                rewardEligibility: faker.datatype.boolean()
            },
            rewards: {
                pending: ethers.utils.parseEther(
                    faker.number.float({ min: 1, max: 1000 }).toString()
                ),
                claimed: ethers.utils.parseEther(
                    faker.number.float({ min: 0, max: 500 }).toString()
                ),
                multiplier: faker.number.float({ min: 1, max: 3 })
            }
        };
    }

    static generateEngagementSnapshot() {
        return {
            timestamp: faker.date.recent(),
            userId: faker.string.uuid(),
            data: {
                spotify: {
                    listeners: faker.number.int({ min: 1000, max: 100000 }),
                    growth: faker.number.float({ min: -0.1, max: 0.5 })
                },
                twitter: {
                    followers: faker.number.int({ min: 1000, max: 100000 }),
                    engagement: faker.number.float({ min: 0.01, max: 0.1 })
                },
                discord: {
                    activity: faker.number.float({ min: 0, max: 1 }),
                    reputation: faker.number.int({ min: 0, max: 1000 })
                }
            },
            analysis: {
                authenticity: faker.number.float({ min: 0.7, max: 1 }),
                consistency: faker.number.float({ min: 0.7, max: 1 }),
                growthRate: faker.number.float({ min: 0.01, max: 0.3 })
            }
        };
    }
} 