import { ethers, BigNumberish, ContractTransactionResponse } from 'ethers';
import { WalletService } from '../services/WalletService';
import MemoryCrystalABI from '../../artifacts/contracts/MemoryCrystal.sol/MemoryCrystal.json';

// Contract interface
interface IMemoryCrystal extends ethers.BaseContract {
    forgeCrystal(accessLevel: number): Promise<ContractTransactionResponse>;
    getContentMetadata(crystalId: number): Promise<any>;
    getPreviewURI(crystalId: number): Promise<string>;
    getMintCost(accessLevel: number): Promise<BigNumberish>;
    [key: string]: any;
}

export class MemoryCrystal {
    private static contract: IMemoryCrystal;
    private static provider: ethers.Provider;

    public static async connect(userAddress: string): Promise<IMemoryCrystal> {
        const walletService = WalletService.getInstance();

        if (!this.contract || !walletService.isWalletConnected()) {
            const contractAddress = process.env.MEMORY_CRYSTAL_ADDRESS;
            if (!contractAddress) {
                throw new Error('Memory Crystal contract address not configured');
            }

            // Get provider
            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

            // Create contract instance
            this.contract = new ethers.Contract(
                contractAddress,
                MemoryCrystalABI.abi,
                this.provider
            ) as IMemoryCrystal;
        }

        // Get signer from wallet service
        const signer = await walletService.getSigner();
        if (!signer) {
            throw new Error('Wallet not connected');
        }

        return this.contract.connect(signer) as IMemoryCrystal;
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