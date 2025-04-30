import { spawn } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';
import { ScriptMonitor } from '../src/utils/monitor';

// Load environment variables
config();

// Required environment variables
const REQUIRED_ENV = [
    'RPC_URL',
    'PRIVATE_KEY',
    'IPFS_NODE',
    'TWITTER_API_KEY',
    'SPOTIFY_CLIENT_ID',
    'DISCORD_BOT_TOKEN'
];

async function checkEnvironment() {
    const missing = REQUIRED_ENV.filter(env => !process.env[env]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

async function setupTestNetwork() {
    console.log('Setting up local test network...');
    return new Promise((resolve, reject) => {
        const hardhat = spawn('npx', ['hardhat', 'node'], {
            stdio: 'pipe'
        });

        hardhat.stdout.on('data', (data) => {
            if (data.toString().includes('Started HTTP and WebSocket JSON-RPC server')) {
                resolve(hardhat);
            }
        });

        hardhat.stderr.on('data', (data) => {
            console.error(`Hardhat Error: ${data}`);
        });

        setTimeout(() => {
            reject(new Error('Hardhat node failed to start in time'));
        }, 30000);
    });
}

async function runTests() {
    const monitor = new ScriptMonitor('feature-tests');
    
    try {
        // Check environment
        await checkEnvironment();
        
        // Start local network
        const hardhat = await setupTestNetwork();
        
        console.log('Running feature tests...');
        const mocha = spawn('npx', ['mocha', '-r', 'ts-node/register', 'test/integration/feature-test-runner.ts'], {
            stdio: 'inherit',
            env: {
                ...process.env,
                TS_NODE_PROJECT: resolve(__dirname, '../tsconfig.json')
            }
        });

        await new Promise((resolve, reject) => {
            mocha.on('exit', (code) => {
                if (code === 0) {
                    resolve(null);
                } else {
                    reject(new Error(`Tests failed with code ${code}`));
                }
            });
        });

        // Cleanup
        hardhat.kill();
        monitor.complete();
        
    } catch (error) {
        monitor.fail(error as Error);
        throw error;
    }
}

// Run tests
runTests().catch(console.error); 