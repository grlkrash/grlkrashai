import { ethers } from 'ethers';
import { TransactionManager } from '../../utils/TransactionManager';

export class ContractService {
    private readonly manager: TransactionManager;
    private readonly wallet: ethers.Wallet;
    private readonly provider: ethers.Provider;

    constructor(
        privateKey: string,
        rpcUrl: string
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.manager = TransactionManager.getInstance();
    }

    async executeTransaction(
        contractAddress: string,
        abi: ethers.InterfaceAbi,
        method: string,
        args: any[]
    ): Promise<ethers.TransactionReceipt> {
        const contract = new ethers.Contract(contractAddress, abi, this.wallet);
        const tx = await contract[method].populateTransaction(...args);
        
        return this.manager.submitTransaction(tx, this.wallet, this.provider);
    }

    async estimateGas(
        contractAddress: string,
        abi: ethers.InterfaceAbi,
        method: string,
        args: any[]
    ): Promise<bigint> {
        const contract = new ethers.Contract(contractAddress, abi, this.wallet);
        return contract[method].estimateGas(...args);
    }
} 