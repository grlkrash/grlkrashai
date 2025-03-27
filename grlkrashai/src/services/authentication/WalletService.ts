import { BrowserProvider, JsonRpcSigner } from 'ethers';
import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
import { NodeStorage } from '../utils/NodeStorage';

interface CoinbaseWalletSDKOptions {
    appName: string;
    darkMode?: boolean;
    appLogoUrl?: string;
}

// Provider type
type WalletProvider = BrowserProvider;

export class WalletService {
    private static instance: WalletService;
    private provider?: BrowserProvider;
    private signer?: JsonRpcSigner;
    private coinbaseWallet?: any;
    private wcModal?: any;
    private autoConnect: boolean = true;
    private lastConnectedWallet?: 'coinbase' | 'walletconnect';
    private address?: string;
    private storage: NodeStorage;

    private chainConfig = {
        chainId: 84532,
        chainName: 'Base Sepolia',
        nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://sepolia.base.org'],
        blockExplorerUrls: ['https://sepolia.basescan.org']
    };

    private constructor() {
        this.storage = new NodeStorage();
        this.autoConnect = false;
        
        // Load preferences from storage
        const autoConnectPref = this.storage.getItem('walletAutoConnect');
        if (autoConnectPref !== null) {
            this.autoConnect = autoConnectPref === 'true';
        }
        
        this.lastConnectedWallet = this.storage.getItem('lastConnectedWallet') as 'coinbase' | 'walletconnect' || undefined;
    }

    public static getInstance(): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService();
        }
        return WalletService.instance;
    }

    private async initializeWallet() {
        try {
            console.log('Initializing Coinbase Wallet...');
            
            if (!CoinbaseWalletSDK) {
                throw new Error('Failed to load CoinbaseWalletSDK');
            }

            // Initialize Coinbase Wallet SDK
            const walletOptions = {
                appName: 'Memory Crystal',
                darkMode: true,
                    appLogoUrl: 'https://images.squarespace-cdn.com/content/v1/65c65906bb4b756e7f05e8da/3d35d01b-37fd-4e53-9c60-c9febb156500/krash+logo+small-13.PNG?format=1500w'
            };

            console.log('Creating Coinbase Wallet with options:', JSON.stringify(walletOptions, null, 2));
            this.coinbaseWallet = new CoinbaseWalletSDK(walletOptions);

            if (!this.coinbaseWallet || typeof this.coinbaseWallet.makeWeb3Provider !== 'function') {
                throw new Error('Invalid Coinbase Wallet instance');
            }

            // Create Web3 Provider
            console.log('Creating Web3 Provider...');
            
            // Create provider with explicit parameters
            const rpcUrl = 'https://sepolia.base.org';
            const chainId = 84532;

            if (!rpcUrl || !chainId) {
                throw new Error('Invalid RPC URL or Chain ID');
            }

            console.log('Using RPC URL and Chain ID:', { rpcUrl, chainId });
            
            try {
                // Create provider with options object
                const providerOptions = {
                    infuraId: undefined,
                    chainId: chainId,
                    jsonRpcUrl: rpcUrl,
                    chainName: 'Base Sepolia',
                    ticker: 'ETH',
                    tickerName: 'Ethereum'
                };

                console.log('Creating provider with options:', JSON.stringify(providerOptions, null, 2));
                const provider = this.coinbaseWallet.makeWeb3Provider(undefined, undefined, providerOptions);
                
                if (!provider) {
                    throw new Error('Failed to create Web3 Provider');
                }

                // Request wallet connection with improved popup handling
                console.log('Requesting wallet connection...');
                try {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    console.log('Preparing to request wallet access...');
                    
                    try {
                        console.log('Requesting wallet access...');
                        await provider.request({ 
                            method: 'eth_requestAccounts',
                            params: []
                        });
                        console.log('Wallet access granted');
                    } catch (requestError: any) {
                        console.log('Initial request failed:', requestError.message);
                        if (requestError.message.includes('popup')) {
                            console.log('Trying alternative connection method...');
                            await provider.enable();
                        } else {
                            throw requestError;
                        }
                    }

                    // Store last connected wallet type
                    this.storage.setItem('lastConnectedWallet', 'coinbase');
                    
                    // Create ethers provider
                    console.log('Creating Browser Provider...');
                    this.provider = new BrowserProvider(provider);
                    console.log('Coinbase Wallet initialization complete');

                    // Try to switch to Base Sepolia network
                    try {
                        console.log('Attempting to switch to Base Sepolia...');
                        await provider.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: `0x${this.chainConfig.chainId.toString(16)}` }]
                        });
                        console.log('Successfully switched to Base Sepolia');
                    } catch (switchError: any) {
                        if (switchError.code === 4902) {
                            console.log('Base Sepolia not found, attempting to add it...');
                            try {
                                await provider.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: `0x${this.chainConfig.chainId.toString(16)}`,
                                        chainName: this.chainConfig.chainName,
                                        nativeCurrency: this.chainConfig.nativeCurrency,
                                        rpcUrls: this.chainConfig.rpcUrls,
                                        blockExplorerUrls: this.chainConfig.blockExplorerUrls
                                    }]
                                });
                                console.log('Successfully added Base Sepolia');
                            } catch (addError: any) {
                                console.error('Failed to add Base Sepolia:', addError);
                                throw new Error(`Failed to add network: ${addError.message}`);
                            }
            } else {
                            console.error('Failed to switch to Base Sepolia:', switchError);
                            throw new Error(`Failed to switch network: ${switchError.message}`);
                        }
                    }

                } catch (connectionError: any) {
                    console.error('Connection error:', connectionError);
                    if (connectionError.name === 'PopupBlockedError') {
                        throw connectionError;
                    }
                    throw new Error(`Failed to connect: ${connectionError.message}`);
                }

            } catch (providerError: any) {
                console.error('Provider creation error:', providerError);
                throw new Error(`Failed to create provider: ${providerError.message}`);
            }

        } catch (error: any) {
            console.error('Detailed initialization error:', error);
            throw error;
        }
    }

    private async initializeWalletConnect() {
        try {
            console.log('Initializing WalletConnect...');
            const { createWeb3Modal, defaultWagmiConfig } = await import('@web3modal/wagmi');
                const { baseSepolia } = await import('viem/chains');

                const metadata = {
                name: 'Memory Crystal Interface',
                description: 'Memory Crystal Web3 Interface',
                    url: 'https://grlkrash.ai',
                    icons: ['https://images.squarespace-cdn.com/content/v1/65c65906bb4b756e7f05e8da/3d35d01b-37fd-4e53-9c60-c9febb156500/krash+logo+small-13.PNG?format=1500w']
                };

                const chains = [baseSepolia];
            const projectId = process.env.WALLET_CONNECT_PROJECT_ID;

            if (!projectId) {
                throw new Error('WALLET_CONNECT_PROJECT_ID not found in environment variables');
            }

            console.log('Creating WagmiConfig...');
                const wagmiConfig = defaultWagmiConfig({
                    chains,
                    projectId,
                    metadata
                });

            console.log('Creating Web3Modal...');
                this.wcModal = createWeb3Modal({
                    wagmiConfig,
                    projectId,
                    chains,
                    themeMode: 'dark'
                });

            // Create a provider from the modal
            const provider = await this.wcModal.getProvider();
            if (!provider) {
                throw new Error('Failed to get WalletConnect provider');
            }

            // Create ethers provider
            this.provider = new BrowserProvider(provider);
            
            // Store last connected wallet type
            this.storage.setItem('lastConnectedWallet', 'walletconnect');
            
            console.log('WalletConnect initialization complete');
        } catch (error: any) {
            console.error('WalletConnect initialization error:', error);
            throw new Error(`WalletConnect initialization failed: ${error.message}`);
        }
    }

    public isAutoConnectEnabled(): boolean {
        return this.autoConnect;
    }

    public toggleAutoConnect(): void {
        this.autoConnect = !this.autoConnect;
        this.storage.setItem('walletAutoConnect', this.autoConnect.toString());
    }

    public disconnect(): void {
        if (this.coinbaseWallet) {
            try {
                // For Coinbase Wallet SDK, we need to disconnect the provider
                const provider = this.coinbaseWallet.makeWeb3Provider();
                if (provider && typeof provider.disconnect === 'function') {
                    provider.disconnect();
                }
                // Clear the wallet instance
                this.coinbaseWallet = undefined;
            } catch (error) {
                console.error('Error disconnecting Coinbase Wallet:', error);
            }
        }
        this.provider = undefined;
        this.signer = undefined;
        this.storage.removeItem('lastConnectedWallet');
    }

    public async connect(): Promise<void> {
        try {
            await this.initializeWallet();
            if (!this.provider) {
                console.error('Provider not initialized after wallet initialization');
                throw new Error('Provider initialization failed');
            }
            // Verify provider is working
            try {
                await this.provider.getNetwork();
            } catch (error: any) {
                console.error('Provider verification failed:', error);
                if (error.message.includes('user rejected') || error.code === 4001) {
                    throw new Error('User rejected the connection');
                }
                throw new Error('Provider verification failed');
            }
        } catch (error: any) {
            console.error('Wallet connection error:', error);
            this.provider = undefined;
            this.signer = undefined;
            throw error;
        }
    }

    public async loginOrCreate(): Promise<string> {
        try {
            await this.connect();
            if (!this.provider) {
                throw new Error('Provider initialization failed');
            }
            this.signer = await this.provider.getSigner();
            const address = await this.signer.getAddress();
            return address;
        } catch (error: any) {
            console.error('Login error:', error);
            throw new Error(`Failed to login or create wallet: ${error.message}`);
        }
    }

    public async getSigner(): Promise<JsonRpcSigner | undefined> {
        if (!this.provider) {
            return undefined;
    }
            if (!this.signer) {
            this.signer = await this.provider.getSigner();
        }
        return this.signer;
    }

    public async getAddress(): Promise<string> {
        const signer = await this.getSigner();
        if (!signer) throw new Error('No signer available');
        return await signer.getAddress();
    }

    public async isWalletConnected(): Promise<boolean> {
        try {
            const signer = await this.getSigner();
            return !!signer;
            } catch (error) {
            return false;
        }
    }

    public async getMoreBalance(): Promise<string> {
        if (!this.provider || !this.address) {
            throw new Error('Wallet not connected');
        }
        // TODO: Implement actual token balance check
        return '0.00';
    }

    public async getTokenPrice(): Promise<string> {
        // TODO: Implement price fetching from DEX or price oracle
        return '0.00';
    }
} 