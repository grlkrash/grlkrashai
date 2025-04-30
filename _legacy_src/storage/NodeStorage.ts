import fs from 'fs';
import path from 'path';

export class NodeStorage {
    private data: Map<string, string> = new Map();
    private filePath: string;
    public length: number = 0;

    constructor() {
        this.filePath = path.join(process.cwd(), 'storage.json');
        this.loadFromFile();
    }

    private loadFromFile(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const fileData = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                this.data = new Map(Object.entries(fileData));
                this.length = this.data.size;
            }
        } catch (error) {
            console.error('Error loading storage from file:', error);
        }
    }

    private saveToFile(): void {
        try {
            const fileData = Object.fromEntries(this.data);
            fs.writeFileSync(this.filePath, JSON.stringify(fileData, null, 2));
        } catch (error) {
            console.error('Error saving storage to file:', error);
        }
    }

    clear(): void {
        this.data.clear();
        this.length = 0;
        this.saveToFile();
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
        this.saveToFile();
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
        this.length = this.data.size;
        this.saveToFile();
    }
} 