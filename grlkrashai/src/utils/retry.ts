export async function retry<T>(
    attempts: number,
    fn: () => Promise<T>,
    delay = 1000
): Promise<T> {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error: any) {
            if (i === attempts - 1) throw error;
            if (error.code === 'NONCE_EXPIRED' || 
                error.code === 'REPLACEMENT_UNDERPRICED' ||
                error.message.includes('nonce') || 
                error.message.includes('replacement fee')) {
                await new Promise(r => setTimeout(r, delay * (i + 1)));
                continue;
            }
            throw error;
        }
    }
    throw new Error('Retry failed');
} 