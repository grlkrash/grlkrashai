export const twitterConfig = {
    credentials: {
        username: process.env.TWITTER_USERNAME,
        password: process.env.TWITTER_PASSWORD,
        email: process.env.TWITTER_EMAIL,
        twoFactorSecret: process.env.TWITTER_2FA_SECRET
    },
    api: {
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        clientId: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET
    },
    autoMode: {
        defaultFrequency: 30, // minutes
        maxDailyPosts: 48,
        minTimeBetweenPosts: 15, // minutes
        engagementThreshold: 5,
        optimizationInterval: 24 // hours
    }
}; 