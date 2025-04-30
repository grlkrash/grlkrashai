import { ethers } from 'ethers';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Eth from '@ledgerhq/hw-app-eth';
import { EventEmitter } from 'events';

export class LedgerService extends EventEmitter {
    private static instance: LedgerService;
    private transport: any;
    private eth: any;
    private connected: boolean = false;
    private address: string | null = null;
    private readonly derivationPath = "44'/60'/0'/0/0";

    private constructor() {
        super();
    }

    static getInstance(): LedgerService {
        if (!LedgerService.instance) {
            LedgerService.instance = new LedgerService();
        }
        return LedgerService.instance;
    }

    async connect(): Promise<boolean> {
        try {
            if (this.connected) return true;

            this.transport = await TransportWebUSB.create();
            this.eth = new Eth(this.transport);

            const { address } = await this.eth.getAddress(this.derivationPath);
            this.address = address;
            this.connected = true;

            this.setupListeners();
            this.emit('connected', { address });

            return true;
        } catch (error) {
            console.error('Failed to connect to Ledger:', error);
            this.emit('error', error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;

        try {
            await this.transport.close();
            this.connected = false;
            this.address = null;
            this.emit('disconnected');
        } catch (error) {
            console.error('Error disconnecting from Ledger:', error);
            this.emit('error', error);
        }
    }

    async reconnect(): Promise<boolean> {
        await this.disconnect();
        return this.connect();
    }

    async getAddress(): Promise<string> {
        if (!this.connected) throw new Error('Ledger not connected');
        if (!this.address) throw new Error('Address not available');
        return this.address;
    }

    async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
        if (!this.connected) throw new Error('Ledger not connected');

        try {
            // Ensure all values are hex strings
            const transaction = {
                to: tx.to,
                value: tx.value ? ethers.toBeHex(tx.value) : '0x0',
                data: tx.data || '0x',
                gasPrice: tx.gasPrice ? ethers.toBeHex(tx.gasPrice) : undefined,
                gasLimit: tx.gasLimit ? ethers.toBeHex(tx.gasLimit) : undefined,
                nonce: tx.nonce ? ethers.toBeHex(tx.nonce) : undefined,
                chainId: tx.chainId || 84532 // Base Sepolia
            };

            // Get the serialized transaction
            const unsignedTx = ethers.Transaction.from(transaction).unsignedSerialized;

            // Sign with Ledger
            const signature = await this.eth.signTransaction(
                this.derivationPath,
                unsignedTx
            );

            // Combine the unsigned transaction with the signature
            return ethers.Transaction.from({
                ...transaction,
                signature: {
                    r: '0x' + signature.r,
                    s: '0x' + signature.s,
                    v: parseInt(signature.v)
                }
            }).serialized;
        } catch (error: any) {
            if (error.statusCode === 27904) {
                throw new Error('Transaction rejected on Ledger device');
            }
            throw error;
        }
    }

    async signMessage(message: string): Promise<string> {
        if (!this.connected) throw new Error('Ledger not connected');

        try {
            const signature = await this.eth.signPersonalMessage(
                this.derivationPath,
                ethers.toBeArray(ethers.hashMessage(message))
            );

            return ethers.Signature.from({
                r: '0x' + signature.r,
                s: '0x' + signature.s,
                v: signature.v
            }).serialized;
        } catch (error: any) {
            if (error.statusCode === 27904) {
                throw new Error('Message signing rejected on Ledger device');
            }
            throw error;
        }
    }

    private setupListeners() {
        this.transport.on('disconnect', () => {
            this.connected = false;
            this.address = null;
            this.emit('disconnected');
        });
    }

    isConnected(): boolean {
        return this.connected;
    }

    async verifyAddress(): Promise<boolean> {
        if (!this.connected) throw new Error('Ledger not connected');

        try {
            await this.eth.getAddress(this.derivationPath, true); // true enables display on device
            return true;
        } catch (error) {
            console.error('Address verification failed:', error);
            return false;
        }
    }
} 