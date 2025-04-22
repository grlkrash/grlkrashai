export interface IPFSContent {
    hash: string;
    contentType: 'audio' | 'video' | 'image' | 'animation';
    metadata: {
        name: string;
        description?: string;
        duration?: number;
        dimensions?: {
            width: number;
            height: number;
        };
    };
    url: string;
}

export interface StorageProvider {
    fetch(hash: string): Promise<IPFSContent>;
    store(content: Buffer, metadata: any): Promise<string>; // Returns IPFS hash
    update(hash: string, content: Buffer): Promise<string>;
    remove(hash: string): Promise<void>;
} 