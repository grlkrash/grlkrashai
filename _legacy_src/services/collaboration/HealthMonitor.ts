import { EventEmitter } from 'events';
import { CollaborationService } from './CollaborationService';

interface HealthMetrics {
    uptime: number;
    lastError?: {
        timestamp: number;
        context: string;
        message: string;
    };
    successfulOperations: number;
    failedOperations: number;
    recoveryAttempts: number;
    successfulRecoveries: number;
    modelLoadStatus: {
        total: number;
        loaded: number;
    };
    lyricLoadStatus: {
        total: number;
        loaded: number;
    };
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
    };
}

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: HealthMetrics;
    recommendations: string[];
}

export class HealthMonitor extends EventEmitter {
    private service: CollaborationService;
    private startTime: number;
    private metrics: HealthMetrics;
    private checkInterval: NodeJS.Timeout;
    private readonly CHECK_INTERVAL_MS = 60000; // Check every minute
    private readonly MEMORY_THRESHOLD = 0.85; // 85% memory usage threshold

    constructor(service: CollaborationService) {
        super();
        this.service = service;
        this.startTime = Date.now();
        this.metrics = this.initializeMetrics();
        this.attachServiceListeners();
        this.startMonitoring();
    }

    private initializeMetrics(): HealthMetrics {
        return {
            uptime: 0,
            successfulOperations: 0,
            failedOperations: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0,
            modelLoadStatus: {
                total: 0,
                loaded: 0
            },
            lyricLoadStatus: {
                total: 0,
                loaded: 0
            },
            memoryUsage: {
                heapUsed: 0,
                heapTotal: 0
            }
        };
    }

    private attachServiceListeners(): void {
        this.service.on('error', (error, context) => {
            this.metrics.failedOperations++;
            this.metrics.lastError = {
                timestamp: Date.now(),
                context,
                message: error.message
            };
            this.checkHealth();
        });

        this.service.on('recoveryStarted', () => {
            this.metrics.recoveryAttempts++;
        });

        this.service.on('recoveryCompleted', () => {
            this.metrics.successfulRecoveries++;
        });

        ['3dGenerationCompleted', 'lyricGenerationCompleted', 'trainingCompleted'].forEach(event => {
            this.service.on(event, () => {
                this.metrics.successfulOperations++;
            });
        });
    }

    private startMonitoring(): void {
        this.checkInterval = setInterval(() => this.checkHealth(), this.CHECK_INTERVAL_MS);
    }

    private async checkHealth(): Promise<void> {
        const status = await this.getHealthStatus();
        this.emit('healthUpdate', status);

        if (status.status === 'unhealthy') {
            this.emit('healthAlert', status);
            
            // Attempt auto-recovery if needed
            if (status.recommendations.includes('RECOVERY_NEEDED')) {
                try {
                    await this.service.getServiceState();
                } catch (error) {
                    this.emit('recoveryFailed', error);
                }
            }
        }
    }

    private updateMetrics(): void {
        this.metrics.uptime = Date.now() - this.startTime;
        
        const memory = process.memoryUsage();
        this.metrics.memoryUsage = {
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal
        };
    }

    public async getHealthStatus(): Promise<HealthStatus> {
        this.updateMetrics();
        
        const serviceState = await this.service.getServiceState();
        const recommendations: string[] = [];
        let status: HealthStatus['status'] = 'healthy';

        // Check memory usage
        const memoryUsageRatio = this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal;
        if (memoryUsageRatio > this.MEMORY_THRESHOLD) {
            status = 'degraded';
            recommendations.push('MEMORY_CLEANUP_NEEDED');
        }

        // Check error rate
        const totalOperations = this.metrics.successfulOperations + this.metrics.failedOperations;
        const errorRate = totalOperations > 0 ? this.metrics.failedOperations / totalOperations : 0;
        if (errorRate > 0.1) { // More than 10% error rate
            status = 'degraded';
            recommendations.push('HIGH_ERROR_RATE');
        }

        // Check service state
        if (serviceState.state === 'ERROR') {
            status = 'unhealthy';
            recommendations.push('RECOVERY_NEEDED');
        }

        // Check recovery success rate
        if (this.metrics.recoveryAttempts > 0) {
            const recoveryRate = this.metrics.successfulRecoveries / this.metrics.recoveryAttempts;
            if (recoveryRate < 0.5) { // Less than 50% recovery success
                status = 'unhealthy';
                recommendations.push('MANUAL_INTERVENTION_NEEDED');
            }
        }

        return {
            status,
            metrics: this.metrics,
            recommendations
        };
    }

    public stop(): void {
        clearInterval(this.checkInterval);
    }
} 