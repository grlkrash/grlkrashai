import { WalletConnect } from '@walletconnect/client';
import { IWalletConnectOptions } from '@walletconnect/types';
import QRCode from 'qrcode';
import { ethers } from 'ethers';

interface ConnectionDetails {
    uri: string;
    qrCode: string;
}

export class WalletConnectionService {
    private connector: WalletConnect;

    constructor() {
        const options: IWalletConnectOptions = {
            bridge: 'https://bridge.walletconnect.org',
            qrcodeModal: false
        };
        
        this.connector = new WalletConnect(options);
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.connector.on('connect', (error: Error | null, payload: any) => {
            if (error) {
                console.error('WalletConnect connection error:', error);
                return;
            }
            console.log('WalletConnect connected:', payload);
        });

        this.connector.on('session_request', (error: Error | null, payload: any) => {
            if (error) {
                console.error('Session request error:', error);
                return;
            }
            console.log('Session request:', payload);
        });

        this.connector.on('disconnect', (error: Error | null, payload: any) => {
            if (error) {
                console.error('WalletConnect disconnect error:', error);
                return;
            }
            console.log('WalletConnect disconnected');
        });
    }

    /**
     * Create a new WalletConnect session and generate connection details
     */
    async createSession(): Promise<ConnectionDetails> {
        if (!this.connector.connected) {
            await this.connector.createSession();
        }

        const uri = this.connector.uri;
        const qrCode = await QRCode.toDataURL(uri);

        return {
            uri,
            qrCode
        };
    }

    /**
     * Get the connected wallet address
     */
    getAddress(): string | null {
        if (!this.connector.connected) {
            return null;
        }
        return this.connector.accounts[0];
    }

    /**
     * Request message signature through WalletConnect
     */
    async signMessage(message: string): Promise<string> {
        if (!this.connector.connected) {
            throw new Error('No wallet connected. Please connect first.');
        }

        const address = this.getAddress();
        if (!address) {
            throw new Error('No wallet address available.');
        }

        try {
            const signature = await this.connector.signPersonalMessage([
                ethers.hexlify(ethers.toUtf8Bytes(message)),
                address.toLowerCase()
            ]);

            return signature;
        } catch (error) {
            throw new Error(`Failed to sign message: ${error.message}`);
        }
    }

    /**
     * Kill the current WalletConnect session
     */
    async disconnect(): Promise<void> {
        if (this.connector.connected) {
            await this.connector.killSession();
        }
    }

    /**
     * Check if a wallet is currently connected
     */
    isConnected(): boolean {
        return this.connector.connected;
    }
} 