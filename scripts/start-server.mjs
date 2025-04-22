import { ProcessManager } from '../src/utils/ProcessManager.js';

const manager = ProcessManager.getInstance();

async function startServer() {
    const env = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '3000'
    };

    try {
        await manager.safeStart(['node', '--loader', 'ts-node/esm', 'src/server.ts'], env);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 