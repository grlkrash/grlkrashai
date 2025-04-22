import { faker } from '@faker-js/faker';

export class AutonomousMockGenerator {
    private static platforms = ['twitter', 'discord', 'telegram', 'medium'];
    private static contentTypes = ['post', 'thread', 'article', 'announcement'];
    private static engagementTypes = ['like', 'share', 'comment', 'click'];
    private static errorTypes = ['rate_limit', 'api_error', 'validation_error', 'timeout'];

    static generateCampaign() {
        return {
            id: faker.string.uuid(),
            name: faker.company.catchPhrase(),
            platform: faker.helpers.arrayElement(this.platforms),
            startDate: faker.date.recent(),
            endDate: faker.date.future(),
            budget: faker.number.float({ min: 1000, max: 10000 }),
            targetAudience: {
                demographics: {
                    ageRange: [faker.number.int({ min: 18, max: 30 }), faker.number.int({ min: 31, max: 65 })],
                    locations: Array(3).fill(null).map(() => faker.location.country()),
                    interests: Array(5).fill(null).map(() => faker.word.sample())
                },
                engagementMetrics: {
                    minFollowers: faker.number.int({ min: 100, max: 10000 }),
                    avgEngagementRate: faker.number.float({ min: 0.01, max: 0.1 }),
                    activityScore: faker.number.float({ min: 0, max: 1 })
                }
            },
            content: Array(5).fill(null).map(() => ({
                type: faker.helpers.arrayElement(this.contentTypes),
                text: faker.lorem.paragraph(),
                media: faker.image.url(),
                schedule: faker.date.future(),
                targeting: {
                    timeZones: Array(3).fill(null).map(() => faker.location.timeZone()),
                    languages: Array(2).fill(null).map(() => faker.location.language())
                }
            })),
            performance: {
                reach: faker.number.int({ min: 1000, max: 100000 }),
                engagement: faker.number.float({ min: 0.01, max: 0.2 }),
                conversion: faker.number.float({ min: 0.001, max: 0.05 }),
                roi: faker.number.float({ min: -0.5, max: 5 })
            }
        };
    }

    static generateAutonomousOperation() {
        return {
            id: faker.string.uuid(),
            type: faker.helpers.arrayElement(['content', 'engagement', 'analytics', 'optimization']),
            timestamp: faker.date.recent(),
            platform: faker.helpers.arrayElement(this.platforms),
            parameters: {
                action: faker.helpers.arrayElement(['post', 'analyze', 'optimize', 'monitor']),
                target: faker.internet.url(),
                constraints: {
                    maxAttempts: faker.number.int({ min: 1, max: 5 }),
                    timeout: faker.number.int({ min: 1000, max: 10000 }),
                    concurrency: faker.number.int({ min: 1, max: 10 })
                }
            },
            context: {
                userSegment: faker.helpers.arrayElement(['new', 'active', 'dormant']),
                timeWindow: faker.helpers.arrayElement(['immediate', 'scheduled', 'adaptive']),
                priority: faker.number.int({ min: 1, max: 5 })
            },
            status: faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed']),
            metrics: this.generateAutonomousMetrics()
        };
    }

    static generateAutonomousMetrics() {
        return {
            timestamp: faker.date.recent(),
            performance: {
                latency: faker.number.int({ min: 50, max: 2000 }),
                throughput: faker.number.int({ min: 10, max: 1000 }),
                errorRate: faker.number.float({ min: 0, max: 0.1 }),
                successRate: faker.number.float({ min: 0.9, max: 1 })
            },
            engagement: {
                type: faker.helpers.arrayElement(this.engagementTypes),
                count: faker.number.int({ min: 0, max: 1000 }),
                uniqueUsers: faker.number.int({ min: 0, max: 500 }),
                duration: faker.number.int({ min: 0, max: 300 })
            },
            resources: {
                cpuUsage: faker.number.float({ min: 0, max: 100 }),
                memoryUsage: faker.number.int({ min: 50, max: 500 }),
                networkIO: faker.number.int({ min: 100, max: 10000 })
            },
            quality: {
                accuracy: faker.number.float({ min: 0.8, max: 1 }),
                relevance: faker.number.float({ min: 0.7, max: 1 }),
                engagement: faker.number.float({ min: 0, max: 1 })
            }
        };
    }

    static generateEngagementStrategy() {
        return {
            id: faker.string.uuid(),
            platform: faker.helpers.arrayElement(this.platforms),
            targetMetrics: {
                reach: faker.number.int({ min: 1000, max: 100000 }),
                engagement: faker.number.float({ min: 0.01, max: 0.2 }),
                conversion: faker.number.float({ min: 0.001, max: 0.05 })
            },
            rules: Array(3).fill(null).map(() => ({
                condition: faker.helpers.arrayElement(['time_based', 'performance_based', 'audience_based']),
                threshold: faker.number.float({ min: 0, max: 1 }),
                action: faker.helpers.arrayElement(['increase_frequency', 'adjust_timing', 'modify_content'])
            })),
            schedule: {
                startTime: faker.date.recent(),
                endTime: faker.date.future(),
                frequency: faker.helpers.arrayElement(['hourly', 'daily', 'weekly']),
                timezone: faker.location.timeZone()
            },
            adaptiveParameters: {
                learningRate: faker.number.float({ min: 0.001, max: 0.1 }),
                explorationRate: faker.number.float({ min: 0.05, max: 0.3 }),
                minConfidence: faker.number.float({ min: 0.7, max: 0.9 })
            }
        };
    }

    static generateErrorScenario() {
        return {
            type: faker.helpers.arrayElement(this.errorTypes),
            timestamp: faker.date.recent(),
            severity: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
            context: {
                operation: faker.helpers.arrayElement(['post', 'analyze', 'optimize', 'monitor']),
                platform: faker.helpers.arrayElement(this.platforms),
                parameters: {
                    attempt: faker.number.int({ min: 1, max: 5 }),
                    timeout: faker.number.int({ min: 1000, max: 10000 })
                }
            },
            impact: {
                userCount: faker.number.int({ min: 0, max: 1000 }),
                resourceUsage: faker.number.float({ min: 0, max: 100 }),
                serviceHealth: faker.number.float({ min: 0, max: 1 })
            },
            resolution: {
                status: faker.helpers.arrayElement(['pending', 'in_progress', 'resolved']),
                strategy: faker.helpers.arrayElement(['retry', 'fallback', 'abort']),
                timeToResolve: faker.number.int({ min: 0, max: 3600 })
            }
        };
    }
} 