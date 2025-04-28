import { IAgentRuntime } from '@elizaos/core';

interface CoinbaseConfig {
    apiKey: string;
    apiSecret: string;
    sandbox?: boolean;
}

interface PaymentDetails {
    recipient: string;
    amount: number;
    sourceCurrency: string;
    targetCurrency: string;
    description: string;
}

interface ConversionRate {
    rate: number;
    timestamp: Date;
    expiresAt: Date;
}

export class CoinbasePaymentService {
    private runtime: IAgentRuntime;
    private coinbaseClient: any; // Replace with actual Coinbase client type
    private rateCache: Map<string, ConversionRate>;
    private readonly RATE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(runtime: IAgentRuntime, config: CoinbaseConfig) {
        this.runtime = runtime;
        this.rateCache = new Map();
        
        // Initialize Coinbase client
        // this.coinbaseClient = new CoinbaseClient({
        //     apiKey: config.apiKey,
        //     apiSecret: config.apiSecret,
        //     sandbox: config.sandbox
        // });
    }

    async processPayment(details: PaymentDetails): Promise<{
        success: boolean;
        transactionId?: string;
        error?: string;
    }> {
        try {
            // Get conversion rate if currencies are different
            let finalAmount = details.amount;
            if (details.sourceCurrency !== details.targetCurrency) {
                const rate = await this.getExchangeRate(
                    details.sourceCurrency,
                    details.targetCurrency
                );
                finalAmount = details.amount * rate;
            }

            // Create payment
            const payment = await this.createPayment({
                ...details,
                amount: finalAmount
            });

            // Process payment
            const result = await this.executePayment(payment);

            return {
                success: true,
                transactionId: result.id
            };

        } catch (error) {
            console.error('Payment processing failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getExchangeRate(
        fromCurrency: string,
        toCurrency: string
    ): Promise<number> {
        const cacheKey = `${fromCurrency}_${toCurrency}`;
        const cached = this.rateCache.get(cacheKey);

        if (cached && cached.expiresAt > new Date()) {
            return cached.rate;
        }

        try {
            // Get current rate from Coinbase
            // const rate = await this.coinbaseClient.getExchangeRate(fromCurrency, toCurrency);
            const rate = 1; // Placeholder until Coinbase client is integrated

            // Cache the rate
            this.rateCache.set(cacheKey, {
                rate,
                timestamp: new Date(),
                expiresAt: new Date(Date.now() + this.RATE_CACHE_DURATION)
            });

            return rate;

        } catch (error) {
            console.error('Failed to get exchange rate:', error);
            throw new Error(`Failed to get exchange rate for ${fromCurrency} to ${toCurrency}`);
        }
    }

    private async createPayment(details: PaymentDetails): Promise<any> {
        // Create payment using Coinbase API
        // return this.coinbaseClient.createPayment({
        //     amount: details.amount,
        //     currency: details.targetCurrency,
        //     recipient: details.recipient,
        //     description: details.description
        // });
        return details; // Placeholder
    }

    private async executePayment(payment: any): Promise<any> {
        // Execute payment using Coinbase API
        // return this.coinbaseClient.executePayment(payment.id);
        return { id: 'mock-transaction-id' }; // Placeholder
    }

    async cleanup(): Promise<void> {
        this.rateCache.clear();
    }
} 