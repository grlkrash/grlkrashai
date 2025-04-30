import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Kill any existing node processes
try {
  spawn('pkill', ['-f', 'node']);
} catch (error) {
  console.log('No existing node processes to kill');
}

// Start the server with proper ESM flags
const serverProcess = spawn('node', [
  '--experimental-specifier-resolution=node',
  '--loader',
  'ts-node/esm',
  resolve(__dirname, 'src/server.ts')
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.PORT || '3001',
    TS_NODE_PROJECT: resolve(__dirname, 'tsconfig.server.json')
  }
});

serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
});

process.on('SIGINT', () => {
  serverProcess.kill();
  process.exit();
}); 