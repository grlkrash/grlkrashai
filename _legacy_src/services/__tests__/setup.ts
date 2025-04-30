import { config } from 'dotenv';
import { Redis } from 'ioredis';

// Load environment variables
config();

// Mock Redis
jest.mock('ioredis', () => {
  const Redis = jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn(),
  }));
  return Redis;
});

// Mock WalletConnect
jest.mock('@walletconnect/client', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      on: jest.fn(),
      killSession: jest.fn(),
    })),
  };
});

// Global test timeout
jest.setTimeout(30000);

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 