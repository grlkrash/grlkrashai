import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  return {
    root: '.',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      commonjsOptions: {
        include: [/node_modules/],
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 5177,
      strictPort: true,
      open: true,
      host: true
    },
    optimizeDeps: {
      include: ['ethers', '@coinbase/wallet-sdk'],
      esbuildOptions: {
        target: 'es2020'
      }
    },
    assetsInclude: ['**/*.js', '**/*.mp3'],
    define: {
      'process.env': {
        BASE_SEPOLIA_RPC: process.env.BASE_SEPOLIA_RPC,
        WALLET_CONNECT_PROJECT_ID: process.env.WALLET_CONNECT_PROJECT_ID,
        COINBASE_PROJECT_ID: process.env.COINBASE_PROJECT_ID,
        NETWORK_NAME: process.env.NETWORK_NAME,
        RPC_URL: process.env.RPC_URL,
        TWITTER_BEARER_TOKEN: JSON.stringify(process.env.TWITTER_BEARER_TOKEN),
        TWITTER_CLIENT_ID: JSON.stringify(process.env.TWITTER_CLIENT_ID),
        TWITTER_CLIENT_SECRET: JSON.stringify(process.env.TWITTER_CLIENT_SECRET),
        TWITTER_REDIRECT_URI: JSON.stringify(process.env.TWITTER_REDIRECT_URI),
        DEBUG: true
      },
      global: 'globalThis'
    }
  }
}) 