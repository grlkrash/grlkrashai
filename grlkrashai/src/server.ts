import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createClient } from 'redis';
import { ethers } from 'ethers';
import { validatePlatformTokens } from './config/platformConfig';
import { DiscordBotService } from './services/discord/DiscordBotService';
import twitterRoutes from './api/twitter.js';
import youtubeRoutes from './api/youtube.js';

// Initialize environment
dotenv.config();
validateEnvironment();

const app = express();
const port = process.env.PORT || 3002;

// Redis setup for rate limiting
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', err => console.error('Redis error:', err));

// Production-safe CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5177'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// Enhanced rate limiting with Redis
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    store: redisClient
});

app.use(limiter);
app.use(express.json());

// Centralized error handler
const errorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        code: err.code
    });
};

app.use(errorHandler);

// Health check with service status
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        redis: redisClient.isReady ? 'connected' : 'disconnected',
        services: {
            discord: DiscordBotService.getInstance().isReady(),
            contracts: Boolean(process.env.RPC_URL && process.env.PRIVATE_KEY)
        }
    });
});

// Routes
app.use('/api/twitter', twitterRoutes);
app.use('/api/youtube', youtubeRoutes);

// Initialize services and start server
let server: any;
async function startServer() {
    try {
        await redisClient.connect();
        await initializeServices();
        server = app.listen(port, () => console.log(`Server running on port ${port}`));
        setupGracefulShutdown();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
function setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
        console.log(`${signal} received. Shutting down gracefully...`);
        server?.close(() => {
            redisClient.quit();
            console.log('Server closed');
            process.exit(0);
        });
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        shutdown('UNCAUGHT_EXCEPTION');
    });
}

// Environment validation
function validateEnvironment() {
    const required = [
        'RPC_URL', 'PRIVATE_KEY', 'MEMORY_CRYSTAL_ADDRESS',
        'MORE_TOKEN_ADDRESS', 'MORE_POOL_ADDRESS', 'REDIS_URL'
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}

startServer(); 