import { create, IPFSHTTPClient } from 'ipfs-http-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withRecovery } from '../utils/retry';

// IPFS client configuration with increased timeout
const ipfs = create({
    host: 'localhost',
    port: 5001,
    protocol: 'http',
    timeout: 300000 // 5 minutes timeout
});

// Content directory
const CONTENT_DIR = path.join(process.cwd(), 'content');
const RESULTS_DIR = path.join(process.cwd(), 'ipfs_results');
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const LOCK_FILE = '.ipfs.lock';

// Function to recursively get all files in a directory
function* walkSync(dir: string): Generator<string> {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            yield* walkSync(filePath);
        } else {
            yield filePath;
        }
    }
}

interface IPFSUploadResult {
    path: string;
    ipfsHash: string;
    size: number;
    type: string;
    relativePath: string;
}

async function createIPFSClient(retries = 3): Promise<IPFSHTTPClient> {
    const configs = [
        { host: 'localhost', port: 5001 },
        { host: 'ipfs.infura.io', port: 5001 },
        { host: 'ipfs.io', port: 5001 }
    ];
    
    for (let i = 0; i < retries; i++) {
        try {
            const ipfs = create(configs[i % configs.length]);
            await ipfs.version();
            return ipfs;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw new Error('Failed to connect to IPFS');
}

async function uploadFile(ipfs: IPFSHTTPClient, filePath: string): Promise<string> {
    const stats = await fs.promises.stat(filePath);
    
    if (stats.size > CHUNK_SIZE) {
        return await uploadLargeFile(ipfs, filePath, stats.size);
    }
    
    const content = await fs.promises.readFile(filePath);
    const result = await withRecovery(
        async () => ipfs.add({ content }),
        async () => {},
        3
    );
    
    return result.cid.toString();
}

async function uploadLargeFile(
    ipfs: IPFSHTTPClient,
    filePath: string,
    fileSize: number
): Promise<string> {
    const chunks: Buffer[] = [];
    const numChunks = Math.ceil(fileSize / CHUNK_SIZE);
    
    for (let i = 0; i < numChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        
        const chunk = await withRecovery(
            async () => {
                const stream = fs.createReadStream(filePath, { start, end: end - 1 });
                return await streamToBuffer(stream);
            },
            async () => {},
            3
        );
        
        chunks.push(chunk);
        console.log(`Chunk ${i + 1}/${numChunks} uploaded`);
    }
    
    const result = await withRecovery(
        async () => ipfs.add({ content: Buffer.concat(chunks) }),
        async () => {},
        3
    );
    
    return result.cid.toString();
}

async function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

async function processDirectory(ipfs: IPFSHTTPClient, dir: string): Promise<IPFSUploadResult[]> {
    const results: IPFSUploadResult[] = [];
    const errors: { path: string; error: string }[] = [];
    
    for (const file of walkSync(dir)) {
        try {
            const relativePath = path.relative(CONTENT_DIR, file);
            const type = path.dirname(relativePath).split(path.sep)[0];
            const stats = await fs.promises.stat(file);
            
            const ipfsHash = await uploadFile(ipfs, file);
            results.push({
                path: file,
                ipfsHash,
                size: stats.size,
                type,
                relativePath
            });
            
            console.log(`✅ Uploaded ${relativePath}: ${ipfsHash}`);
        } catch (error: any) {
            console.error(`❌ Failed to upload ${file}:`, error.message);
            errors.push({ path: file, error: error.message });
        }
    }
    
    await saveResults(results, errors);
    return results;
}

function acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
        const lockTime = fs.statSync(LOCK_FILE).mtime;
        if (Date.now() - lockTime.getTime() < 3600000) {
            throw new Error('Upload in progress');
        }
    }
    fs.writeFileSync(LOCK_FILE, Date.now().toString());
}

function releaseLock() {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
}

async function main() {
    try {
        acquireLock();
        console.log('🚀 Starting IPFS upload...');
        
        const ipfs = await createIPFSClient();
        await processDirectory(ipfs, CONTENT_DIR);
        
        console.log('✅ Upload complete!');
        releaseLock();
    } catch (error) {
        console.error('❌ Upload failed:', error);
        releaseLock();
        process.exit(1);
    }
}

main(); 