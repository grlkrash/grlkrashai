import { jest } from '@jest/globals';

// Mock environment variables
process.env.TWITTER_API_KEY = 'mock_api_key';
process.env.TWITTER_API_SECRET = 'mock_api_secret';
process.env.TWITTER_ACCESS_TOKEN = 'mock_access_token';
process.env.TWITTER_ACCESS_SECRET = 'mock_access_secret';
process.env.TWITTER_SUPER_ADMIN = '@superadmin';

// Mock Twitter API
jest.mock('twitter-api-v2', () => {
    return {
        TwitterApi: jest.fn().mockImplementation(() => ({
            v2: {
                tweet: jest.fn().mockResolvedValue({ data: { id: '123' } }),
                reply: jest.fn().mockResolvedValue({ data: { id: '124' } }),
                me: jest.fn().mockResolvedValue({ data: { id: 'user_id' } }),
                followers: jest.fn().mockResolvedValue({ data: Array(10).fill({ id: 'follower_id' }) }),
                userTimeline: jest.fn().mockResolvedValue({
                    data: Array(5).fill({ id: 'tweet_id', author_id: 'author_id' })
                }),
                tweetLikedBy: jest.fn().mockResolvedValue({ data: Array(5).fill({ username: 'liker' }) }),
                tweetRetweetedBy: jest.fn().mockResolvedValue({ data: Array(3).fill({ username: 'retweeter' }) }),
                user: jest.fn().mockResolvedValue({ data: { id: 'user_id', username: 'test_user' } })
            },
            v1: {
                uploadMedia: jest.fn().mockResolvedValue('media_id')
            }
        }))
    };
}); 