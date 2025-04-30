import { ethers } from 'ethers';
import { EventEmitter } from 'events';

export class TransactionManager extends EventEmitter {
    private static instance: TransactionManager;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 15000;
    private pendingTxs = new Map<string, { 
        nonce: number, 
        retries: number,
        gasPrice: bigint,
        lastCheck: number 
    }>();

    static getInstance(): TransactionManager {
        if (!TransactionManager.instance) {
            TransactionManager.instance = new TransactionManager();
        }
        return TransactionManager.instance;
    }

    async submitTransaction(
        tx: ethers.TransactionRequest,
        wallet: ethers.Wallet,
        provider: ethers.Provider
    ): Promise<ethers.TransactionReceipt> {
        const nonce = await wallet.getNonce();
        const gasPrice = await this.getOptimalGasPrice(provider);
        
        tx.nonce = nonce;
        tx.gasPrice = gasPrice;

        const signedTx = await wallet.signTransaction(tx);
        const txHash = ethers.keccak256(signedTx);
        
        this.pendingTxs.set(txHash, { nonce, retries: 0, gasPrice, lastCheck: Date.now() });
        
        try {
            const response = await provider.broadcastTransaction(signedTx);
            return await this.monitorTransaction(response.hash, wallet, provider);
        } catch (error) {
            return this.handleTransactionError(tx, txHash, wallet, provider);
        }
    }

    private async monitorTransaction(
        txHash: string,
        wallet: ethers.Wallet,
        provider: ethers.Provider,
        timeout: number = 300000
    ): Promise<ethers.TransactionReceipt> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) {
                this.pendingTxs.delete(txHash);
                return receipt;
            }
            
            const txData = this.pendingTxs.get(txHash);
            if (txData && Date.now() - txData.lastCheck > this.RETRY_DELAY) {
                await this.checkAndResubmit(txHash, wallet, provider);
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        throw new Error('Transaction timeout');
    }

    private async checkAndResubmit(
        txHash: string,
        wallet: ethers.Wallet,
        provider: ethers.Provider
    ): Promise<void> {
        const txData = this.pendingTxs.get(txHash);
        if (!txData || txData.retries >= this.MAX_RETRIES) return;

        const newGasPrice = txData.gasPrice * BigInt(120) / BigInt(100);
        const tx = await provider.getTransaction(txHash);
        
        if (tx) {
            const newTx = {
                ...tx,
                gasPrice: newGasPrice,
                nonce: txData.nonce
            };
            
            await wallet.signTransaction(newTx);
            txData.gasPrice = newGasPrice;
            txData.retries++;
            txData.lastCheck = Date.now();
            this.pendingTxs.set(txHash, txData);
        }
    }

    private async getOptimalGasPrice(provider: ethers.Provider): Promise<bigint> {
        const feeData = await provider.getFeeData();
        return feeData.gasPrice ?? BigInt(0);
    }

    private async handleTransactionError(
        tx: ethers.TransactionRequest,
        txHash: string,
        wallet: ethers.Wallet,
        provider: ethers.Provider
    ): Promise<ethers.TransactionReceipt> {
        const txData = this.pendingTxs.get(txHash);
        if (!txData || txData.retries >= this.MAX_RETRIES) {
            throw new Error('Max retries exceeded');
        }

        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.submitTransaction(tx, wallet, provider);
    }
} 