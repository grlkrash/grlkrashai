export interface TokenMetrics {
    marketCap: number;
    price: number;
    totalSupply: number;
    circulatingSupply: number;
    liquidityLocked: number;
}

export interface TokenContract {
    getMarketCap(): Promise<number>;
    unlockLiquidity(percentage: number): Promise<void>;
    getMetrics(): Promise<TokenMetrics>;
    distributeRewards(amount: number, recipients: string[]): Promise<void>;
    issueCommunityRewards(amount: number): Promise<void>;
} 