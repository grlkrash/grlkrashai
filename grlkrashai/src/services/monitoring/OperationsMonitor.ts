import { EventEmitter } from 'events';

interface OperationMetrics {
    operationType: string;
    status: 'success' | 'failure' | 'in_progress';
    startTime: Date;
    endTime?: Date;
    error?: string;
    metadata: Record<string, any>;
}

export class OperationsMonitor extends EventEmitter {
    private static instance: OperationsMonitor;
    private operations = new Map<string, OperationMetrics>();
    private readonly ALERT_THRESHOLDS = {
        errorRate: 0.2,  // 20% error rate triggers alert
        responseTime: 5000,  // 5s response time triggers alert
        concurrentOps: 10  // More than 10 concurrent ops triggers alert
    };

    static getInstance(): OperationsMonitor {
        if (!OperationsMonitor.instance) {
            OperationsMonitor.instance = new OperationsMonitor();
        }
        return OperationsMonitor.instance;
    }

    startOperation(opId: string, type: string, metadata: Record<string, any> = {}): void {
        this.operations.set(opId, {
            operationType: type,
            status: 'in_progress',
            startTime: new Date(),
            metadata
        });

        this.checkConcurrentOperations();
    }

    completeOperation(opId: string, status: 'success' | 'failure', error?: string): void {
        const op = this.operations.get(opId);
        if (!op) return;

        op.status = status;
        op.endTime = new Date();
        if (error) op.error = error;

        this.operations.set(opId, op);
        this.analyzeMetrics();
    }

    private checkConcurrentOperations(): void {
        const inProgressOps = Array.from(this.operations.values())
            .filter(op => op.status === 'in_progress');

        if (inProgressOps.length > this.ALERT_THRESHOLDS.concurrentOps) {
            this.emit('alert', {
                type: 'high_concurrency',
                message: `High number of concurrent operations: ${inProgressOps.length}`,
                operations: inProgressOps.map(op => op.operationType)
            });
        }
    }

    private analyzeMetrics(): void {
        const recentOps = Array.from(this.operations.values())
            .filter(op => op.endTime && 
                (new Date().getTime() - op.endTime.getTime() < 300000)); // Last 5 minutes

        if (recentOps.length === 0) return;

        // Calculate error rate
        const errorRate = recentOps.filter(op => op.status === 'failure').length / recentOps.length;
        if (errorRate > this.ALERT_THRESHOLDS.errorRate) {
            this.emit('alert', {
                type: 'high_error_rate',
                message: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
                failedOperations: recentOps.filter(op => op.status === 'failure')
            });
        }

        // Check response times
        const slowOps = recentOps.filter(op => {
            const duration = op.endTime!.getTime() - op.startTime.getTime();
            return duration > this.ALERT_THRESHOLDS.responseTime;
        });

        if (slowOps.length > 0) {
            this.emit('alert', {
                type: 'slow_operations',
                message: `${slowOps.length} operations exceeded response time threshold`,
                operations: slowOps
            });
        }
    }

    getMetrics(): Record<string, any> {
        const recentOps = Array.from(this.operations.values())
            .filter(op => op.endTime && 
                (new Date().getTime() - op.endTime.getTime() < 300000));

        return {
            totalOperations: recentOps.length,
            successRate: recentOps.length ? 
                (recentOps.filter(op => op.status === 'success').length / recentOps.length) : 1,
            averageResponseTime: recentOps.length ?
                recentOps.reduce((acc, op) => 
                    acc + (op.endTime!.getTime() - op.startTime.getTime()), 0) / recentOps.length : 0,
            activeOperations: Array.from(this.operations.values())
                .filter(op => op.status === 'in_progress').length
        };
    }
} 