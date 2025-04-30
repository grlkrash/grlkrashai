import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { Redis } from 'ioredis';
import { MockDataGenerator } from './utils/mock-data-generator';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Mock environment variables if not set
process.env.RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize global test provider
global.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Initialize mock data
global.mockData = {
    wallet: null as any,
    token: null as any,
    metrics: null as any
};

// Setup before all tests
beforeAll(async () => {
    // Generate test data
    global.mockData.wallet = await MockDataGenerator.generateWallet();
    global.mockData.token = {
        address: '0x' + '1'.repeat(40),
        decimals: 18,
        symbol: 'MORE'
    };
    global.mockData.metrics = {
        streaming: { total: 10000, daily: 1000, growth: 0.05 },
        token: { price: 1.0, volume: 50000, liquidity: 100000 },
        engagement: { users: 1000, interactions: 5000, rewards: 1000 }
    };
});

// Clean up after all tests
afterAll(async () => {
    // Close provider
    await global.provider?.destroy();
    
    // Clean up any remaining connections
    const cleanup = async () => {
        try {
            const redis = new Redis(process.env.REDIS_URL!);
            await redis.quit();
        } catch (error) {
            console.error('Redis cleanup error:', error);
        }
    };
    
    await cleanup();
});

// Global test timeouts
jest.setTimeout(30000);

// Automatically mock the Ledger modules
jest.mock('@ledgerhq/hw-transport-webusb');
jest.mock('@ledgerhq/hw-app-eth', () => ({
    default: jest.fn().mockImplementation(() => ({
        getAddress: jest.fn().mockResolvedValue({ address: process.env.ADMIN_ADDRESS }),
        signTransaction: jest.fn().mockResolvedValue({
            r: '0x1234',
            s: '0x5678',
            v: 28
        }),
        signPersonalMessage: jest.fn().mockResolvedValue({
            r: '0x1234',
            s: '0x5678',
            v: 28
        })
    }))
})); 