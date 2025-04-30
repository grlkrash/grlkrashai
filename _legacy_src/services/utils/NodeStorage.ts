/**
 * NodeStorage class that mimics the localStorage API for Node.js environment
 */
export class NodeStorage {
    private data: Map<string, string>;
    public length: number;

    constructor() {
        this.data = new Map<string, string>();
        this.length = 0;
    }

    clear(): void {
        this.data.clear();
        this.length = 0;
    }

    getItem(key: string): string | null {
        return this.data.get(key) || null;
    }

    key(index: number): string | null {
        const keys = Array.from(this.data.keys());
        return keys[index] || null;
    }

    removeItem(key: string): void {
        this.data.delete(key);
        this.length = this.data.size;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
        this.length = this.data.size;
    }
} 