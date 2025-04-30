import { EventEmitter } from 'events';

interface RateLimit {
    hourly: { count: number; reset: Date };
    daily: { count: number; reset: Date };
}

export class RateLimitManager extends EventEmitter {
    private readonly limits: Record<string, {
        perHour: number;
        perDay: number;
    }>;
    private usage: Map<string, RateLimit>;

    constructor() {
        super();
        this.limits = {
            'instagram:post': { perHour: 3, perDay: 25 },
            'instagram:story': { perHour: 10, perDay: 100 },
            'instagram:reel': { perHour: 5, perDay: 50 },
            'instagram:comment': { perHour: 60, perDay: 500 },
            'tiktok:video': { perHour: 4, perDay: 30 },
            'tiktok:comment': { perHour: 50, perDay: 400 },
            'youtube:upload': { perHour: 2, perDay: 20 },
            'youtube:comment': { perHour: 40, perDay: 300 }
        };
        this.usage = new Map();
    }

    async checkLimit(platform: string, action: string): Promise<boolean> {
        const key = `${platform}:${action}`;
        const usage = this.getUsage(key);
        
        if (!usage) {
            this.initializeUsage(key);
            return true;
        }

        // Reset counters if needed
        this.resetIfNeeded(usage);

        const limit = this.limits[key];
        if (!limit) return true;

        return usage.hourly.count < limit.perHour && 
               usage.daily.count < limit.perDay;
    }

    async incrementUsage(platform: string, action: string): Promise<void> {
        const key = `${platform}:${action}`;
        let usage = this.getUsage(key);
        
        if (!usage) {
            usage = this.initializeUsage(key);
        }

        this.resetIfNeeded(usage);

        usage.hourly.count++;
        usage.daily.count++;

        // Emit events when approaching limits
        const limit = this.limits[key];
        if (limit) {
            if (usage.hourly.count >= limit.perHour * 0.8) {
                this.emit('approachingHourlyLimit', { platform, action, usage: usage.hourly });
            }
            if (usage.daily.count >= limit.perDay * 0.8) {
                this.emit('approachingDailyLimit', { platform, action, usage: usage.daily });
            }
        }
    }

    private getUsage(key: string): RateLimit | undefined {
        return this.usage.get(key);
    }

    private initializeUsage(key: string): RateLimit {
        const usage: RateLimit = {
            hourly: { count: 0, reset: this.getNextHourReset() },
            daily: { count: 0, reset: this.getNextDayReset() }
        };
        this.usage.set(key, usage);
        return usage;
    }

    private resetIfNeeded(usage: RateLimit): void {
        const now = new Date();
        
        if (now > usage.hourly.reset) {
            usage.hourly = { count: 0, reset: this.getNextHourReset() };
        }
        
        if (now > usage.daily.reset) {
            usage.daily = { count: 0, reset: this.getNextDayReset() };
        }
    }

    private getNextHourReset(): Date {
        const next = new Date();
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
        return next;
    }

    private getNextDayReset(): Date {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        return next;
    }

    async getRemainingLimits(platform: string, action: string): Promise<{
        hourly: { remaining: number; reset: Date };
        daily: { remaining: number; reset: Date };
    }> {
        const key = `${platform}:${action}`;
        const usage = this.getUsage(key);
        const limit = this.limits[key];

        if (!usage || !limit) {
            return {
                hourly: { remaining: Infinity, reset: new Date() },
                daily: { remaining: Infinity, reset: new Date() }
            };
        }

        this.resetIfNeeded(usage);

        return {
            hourly: {
                remaining: limit.perHour - usage.hourly.count,
                reset: usage.hourly.reset
            },
            daily: {
                remaining: limit.perDay - usage.daily.count,
                reset: usage.daily.reset
            }
        };
    }

    async cleanup(): Promise<void> {
        this.usage.clear();
        this.removeAllListeners();
    }
} 