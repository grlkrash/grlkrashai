import fs from 'fs';
import path from 'path';

interface ScriptStatus {
    name: string;
    status: 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    error?: string;
    pid: number;
}

const STATUS_DIR = path.join(process.cwd(), '.status');
if (!fs.existsSync(STATUS_DIR)) fs.mkdirSync(STATUS_DIR);

export class ScriptMonitor {
    private status: ScriptStatus;
    private statusFile: string;
    
    constructor(scriptName: string) {
        this.statusFile = path.join(STATUS_DIR, `${scriptName}.json`);
        this.status = {
            name: scriptName,
            status: 'running',
            startTime: Date.now(),
            pid: process.pid
        };
        this.save();
        
        // Handle process termination
        ['SIGINT', 'SIGTERM', 'uncaughtException'].forEach(signal => {
            process.on(signal, (error) => {
                this.fail(error);
                process.exit(1);
            });
        });
    }
    
    complete() {
        this.status.status = 'completed';
        this.status.endTime = Date.now();
        this.save();
    }
    
    fail(error: Error) {
        this.status.status = 'failed';
        this.status.endTime = Date.now();
        this.status.error = error.message;
        this.save();
    }
    
    private save() {
        fs.writeFileSync(this.statusFile, JSON.stringify(this.status, null, 2));
    }
    
    static getRunningScripts(): ScriptStatus[] {
        if (!fs.existsSync(STATUS_DIR)) return [];
        
        return fs.readdirSync(STATUS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                try {
                    const status: ScriptStatus = JSON.parse(
                        fs.readFileSync(path.join(STATUS_DIR, f), 'utf8')
                    );
                    
                    // Check if process is still running
                    try {
                        process.kill(status.pid, 0);
                        return status;
                    } catch {
                        status.status = 'failed';
                        status.error = 'Process died unexpectedly';
                        fs.writeFileSync(
                            path.join(STATUS_DIR, f),
                            JSON.stringify(status, null, 2)
                        );
                    }
                } catch {
                    return null;
                }
            })
            .filter(Boolean) as ScriptStatus[];
    }
    
    static cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        if (!fs.existsSync(STATUS_DIR)) return;
        
        const now = Date.now();
        fs.readdirSync(STATUS_DIR)
            .filter(f => f.endsWith('.json'))
            .forEach(f => {
                const filePath = path.join(STATUS_DIR, f);
                try {
                    const stat = fs.statSync(filePath);
                    if (now - stat.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                    }
                } catch {}
            });
    }
} 