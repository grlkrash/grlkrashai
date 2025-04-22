import dotenv from 'dotenv';
dotenv.config();

export const walletVerificationConfig = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        prefix: 'wallet_verification:'
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
        expiresIn: '30d'
    },
    verification: {
        nonceExpiry: 600, // 10 minutes
        rateLimit: {
            attempts: 5,
            window: 3600 // 1 hour
        }
    },
    platforms: {
        discord: {
            enabled: true,
            commands: {
                verifyWallet: 'verify-wallet',
                submitSignature: 'submit-signature',
                unlinkWallet: 'unlink-wallet',
                walletInfo: 'wallet-info'
            }
        },
        telegram: {
            enabled: true,
            commands: {
                verifyWallet: 'verify_wallet',
                submitSignature: 'submit_signature',
                unlinkWallet: 'unlink_wallet',
                walletInfo: 'wallet_info'
            }
        }
    }
}; 