import { EventEmitter } from 'events';

export class ResourceManager {
    private static instance: ResourceManager;
    private locks = new Map<string, Promise<void>>();
    private readonly maxConcurrent = new Map<string, number>([
        ['gpu', 1], ['memory', 4], ['model', 2], ['training', 1]
    ]);

    static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    async acquire(resources: string[]): Promise<() => void> {
        const sorted = [...new Set(resources)].sort();
        const releases = await Promise.all(sorted.map(r => this.acquireResource(r)));
        return () => releases.forEach(release => release());
    }

    private async acquireResource(resource: string): Promise<() => void> {
        while (this.getCurrentCount(resource) >= (this.maxConcurrent.get(resource) || 1)) {
            await this.locks.get(resource);
        }
        let release: () => void;
        const lock = new Promise<void>(r => release = r);
        this.locks.set(resource, lock);
        return release!;
    }

    private getCurrentCount(resource: string): number {
        return this.locks.has(resource) ? 1 : 0;
    }
}

export class EventController extends EventEmitter {
    private static instance: EventController;
    private readonly limits = new Map<string, {count: number, timestamp: number}>();
    private readonly maxEvents = new Map<string, {limit: number, window: number}>([
        ['training_progress', {limit: 10, window: 60000}],
        ['model_generation', {limit: 5, window: 60000}],
        ['service_recovery', {limit: 3, window: 300000}]
    ]);

    static getInstance(): EventController {
        if (!EventController.instance) {
            EventController.instance = new EventController();
        }
        return EventController.instance;
    }

    emit(event: string, ...args: any[]): boolean {
        if (!this.canEmit(event)) {
            return false;
        }
        return super.emit(event, ...args);
    }

    private canEmit(eventType: string): boolean {
        const limit = this.maxEvents.get(eventType);
        if (!limit) return true;

        const now = Date.now();
        const state = this.limits.get(eventType) || {count: 0, timestamp: now};
        
        if (now - state.timestamp > limit.window) {
            state.count = 1;
            state.timestamp = now;
        } else if (state.count >= limit.limit) {
            return false;
        } else {
            state.count++;
        }
        
        this.limits.set(eventType, state);
        return true;
    }
} 