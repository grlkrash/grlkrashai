export interface WalletConfig {
    projectId: string;
    network: string;
    rpcUrl: string;
    infuraKey?: string;
}

export const walletConfig: WalletConfig = {
    projectId: process.env.COINBASE_PROJECT_ID || '',
    network: process.env.NETWORK_NAME || 'mainnet',
    rpcUrl: process.env.RPC_URL || '',
    infuraKey: process.env.INFURA_KEY || ''
}; 