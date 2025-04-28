import { ethers } from 'ethers';
import { WalletService } from '../services/WalletService';

// Contract ABI
const HOLDER_ABI = [
    // Add your contract ABI here
];

// Contract interface
interface ICrystalHolder extends ethers.BaseContract {
    bindCrystal(crystalId: number): Promise<ethers.ContractTransaction>;
    getBoundCrystals(): Promise<number[]>;
    playMedia(crystalId: number): Promise<string>;
    [key: string]: any;
}

export class CrystalHolder {
    private static contract: ICrystalHolder;

    public static async connect(userAddress: string): Promise<ICrystalHolder> {
        const walletService = WalletService.getInstance();

        if (!this.contract || !walletService.isWalletConnected()) {
            // Create contract instance
            this.contract = new ethers.Contract(
                process.env.CRYSTAL_HOLDER_ADDRESS!,
                HOLDER_ABI,
                walletService.getProvider()
            ) as ICrystalHolder;
        }

        // Get signer from wallet service
        const signer = walletService.getSigner();
        if (!signer) {
            throw new Error('Wallet not connected');
        }

        return this.contract.connect(signer) as ICrystalHolder;
    }

    public static async isWalletConnected(): Promise<boolean> {
        return WalletService.getInstance().isWalletConnected();
    }

    public static async connectWallet(): Promise<void> {
        await WalletService.getInstance().connect();
    }

    public static async disconnectWallet(): Promise<void> {
        await WalletService.getInstance().disconnect();
    }
} 