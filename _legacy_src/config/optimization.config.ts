export const optimizationConfig = {
    platforms: {
        twitter: {
            enabled: true,
            thresholds: {
                engagement: 0.05, // 5% engagement rate
                reach: 1000,
                conversion: 0.02 // 2% conversion rate
            },
            schedule: {
                frequency: 'daily',
                timeOfDay: '09:00'
            },
            learning: {
                features: ['sentiment', 'viralPotential', 'threadPotential'],
                weights: {
                    engagement: 0.4,
                    reach: 0.3,
                    conversion: 0.3
                },
                minSampleSize: 50
            }
        },
        instagram: {
            enabled: true,
            thresholds: {
                engagement: 0.03, // 3% engagement rate
                reach: 2000,
                conversion: 0.015 // 1.5% conversion rate
            },
            schedule: {
                frequency: 'daily',
                timeOfDay: '12:00'
            },
            learning: {
                features: ['visualAppeal', 'hashtagRelevance', 'carouselPerformance'],
                weights: {
                    engagement: 0.5,
                    reach: 0.3,
                    conversion: 0.2
                },
                minSampleSize: 30
            }
        },
        youtube: {
            enabled: true,
            thresholds: {
                engagement: 0.08, // 8% engagement rate
                reach: 500,
                conversion: 0.01 // 1% conversion rate
            },
            schedule: {
                frequency: 'weekly',
                timeOfDay: '15:00',
                dayOfWeek: 1 // Monday
            },
            learning: {
                features: ['retentionRate', 'clickThroughRate', 'watchTime'],
                weights: {
                    engagement: 0.3,
                    reach: 0.3,
                    conversion: 0.4
                },
                minSampleSize: 20
            }
        },
        tiktok: {
            enabled: true,
            thresholds: {
                engagement: 0.1, // 10% engagement rate
                reach: 1500,
                conversion: 0.03 // 3% conversion rate
            },
            schedule: {
                frequency: 'daily',
                timeOfDay: '18:00'
            },
            learning: {
                features: ['soundUsage', 'trendAlignment', 'effectPerformance'],
                weights: {
                    engagement: 0.4,
                    reach: 0.4,
                    conversion: 0.2
                },
                minSampleSize: 40
            }
        }
    },
    globalSettings: {
        minPerformanceScore: 0.7,
        maxOptimizationsPerDay: 10,
        requireApproval: false,
        autoPublish: true
    },
    learning: {
        modelSettings: {
            learningRate: 0.01,
            batchSize: 32,
            epochs: 10,
            validationSplit: 0.2
        },
        featureImportance: {
            minImportanceScore: 0.1,
            updateFrequency: 'daily'
        },
        dataRetention: {
            maxHistoryDays: 90,
            pruningFrequency: 'weekly'
        },
        crossPlatformLearning: {
            enabled: true,
            shareableFeatures: [
                'audience',
                'timing',
                'engagement',
                'hashtags'
            ],
            minConfidenceForSharing: 0.8
        }
    }
} as const; 