import { ethers } from 'hardhat';
import { faker } from '@faker-js/faker';

export class MockDataGenerator {
    static async generateWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey
        };
    }

    static generateMusicContent() {
        return {
            title: faker.music.songName(),
            artist: faker.person.fullName(),
            genre: faker.helpers.arrayElement(['Pop', 'Rock', 'Electronic', 'Hip Hop']),
            duration: faker.number.int({ min: 120, max: 300 }),
            releaseDate: faker.date.recent(),
            coverArt: faker.image.url(),
            description: faker.lorem.paragraph()
        };
    }

    static generateSocialMediaPost() {
        return {
            content: faker.lorem.sentence(),
            hashtags: Array(3).fill(null).map(() => faker.word.sample()),
            mediaUrls: [faker.image.url()],
            scheduledTime: faker.date.future(),
            platform: faker.helpers.arrayElement(['twitter', 'instagram', 'tiktok'])
        };
    }

    static generateCampaign() {
        return {
            title: faker.company.catchPhrase(),
            budget: faker.number.float({ min: 1000, max: 10000 }),
            startDate: faker.date.future(),
            endDate: faker.date.future(),
            targetAudience: {
                age: [faker.number.int({ min: 18, max: 25 }), faker.number.int({ min: 26, max: 35 })],
                locations: Array(3).fill(null).map(() => faker.location.country()),
                interests: Array(3).fill(null).map(() => faker.word.sample())
            },
            platforms: ['spotify', 'twitter', 'instagram'].sort(() => Math.random() - 0.5)
        };
    }

    static generateEngagementMetrics() {
        return {
            likes: faker.number.int({ min: 100, max: 10000 }),
            shares: faker.number.int({ min: 10, max: 1000 }),
            comments: faker.number.int({ min: 5, max: 500 }),
            views: faker.number.int({ min: 1000, max: 100000 }),
            engagementRate: faker.number.float({ min: 1, max: 5, precision: 0.01 })
        };
    }

    static generateCommunityEvent() {
        return {
            title: faker.company.catchPhrase(),
            description: faker.lorem.paragraph(),
            date: faker.date.future(),
            location: {
                type: faker.helpers.arrayElement(['online', 'physical']),
                venue: faker.location.streetAddress(),
                city: faker.location.city(),
                country: faker.location.country()
            },
            capacity: faker.number.int({ min: 50, max: 500 }),
            type: faker.helpers.arrayElement(['launch', 'meetup', 'concert', 'workshop']),
            speakers: Array(3).fill(null).map(() => ({
                name: faker.person.fullName(),
                bio: faker.lorem.sentence(),
                avatar: faker.image.avatar()
            }))
        };
    }

    static generateUserProfile() {
        return {
            id: faker.string.uuid(),
            username: faker.internet.userName(),
            email: faker.internet.email(),
            avatar: faker.image.avatar(),
            bio: faker.lorem.sentence(),
            joinDate: faker.date.past(),
            socialLinks: {
                twitter: faker.internet.url(),
                instagram: faker.internet.url(),
                spotify: faker.internet.url()
            },
            preferences: {
                genres: Array(3).fill(null).map(() => faker.helpers.arrayElement(['Pop', 'Rock', 'Electronic', 'Hip Hop'])),
                notifications: faker.helpers.arrayElement(['all', 'important', 'none']),
                privacy: faker.helpers.arrayElement(['public', 'private'])
            }
        };
    }
} 