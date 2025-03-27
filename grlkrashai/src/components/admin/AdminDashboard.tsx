import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { LedgerService } from '../../services/LedgerService';
import { MetricsService } from '../../services/analytics/MetricsService';
import { TokenManagementService } from '../../services/TokenManagementService';
import { SecurityService } from '../../services/SecurityService';

interface AdminDashboardProps {
    ledgerService: LedgerService;
    metricsService: MetricsService;
    tokenManagement: TokenManagementService;
    securityService: SecurityService;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    ledgerService,
    metricsService,
    tokenManagement,
    securityService
}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [metrics, setMetrics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>('');

    useEffect(() => {
        initializeDashboard();
    }, []);

    const initializeDashboard = async () => {
        try {
            setIsLoading(true);
            const connected = await ledgerService.connect();
            setIsConnected(connected);
            
            if (connected) {
                await loadMetrics();
            }
        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMetrics = async () => {
        const [streaming, token, engagement] = await Promise.all([
            metricsService.getStreamingMetrics(),
            metricsService.getTokenMetrics(),
            metricsService.getEngagementMetrics()
        ]);

        setMetrics({ streaming, token, engagement });
    };

    const handleAction = async (action: string) => {
        try {
            setError(null);
            setSelectedAction(action);
            
            switch (action) {
                case 'enableCirculation':
                    await tokenManagement.enableCirculation();
                    break;
                case 'adjustLiquidity':
                    const amount = await promptAmount();
                    if (amount) {
                        await tokenManagement.adjustLiquidity(amount);
                    }
                    break;
                case 'pauseTrading':
                    if (await confirmAction('pause trading')) {
                        await tokenManagement.pauseTrading();
                    }
                    break;
                case 'resumeTrading':
                    if (await confirmAction('resume trading')) {
                        await tokenManagement.resumeTrading();
                    }
                    break;
                default:
                    setError('Unknown action');
                    return;
            }
            
            await loadMetrics();
        } catch (error: any) {
            setError(error.message);
        } finally {
            setSelectedAction('');
        }
    };

    const promptAmount = async (): Promise<string | null> => {
        const amount = prompt('Enter amount in ETH:');
        if (!amount) return null;
        
        try {
            return ethers.parseEther(amount).toString();
        } catch {
            setError('Invalid amount');
            return null;
        }
    };

    const confirmAction = async (action: string): Promise<boolean> => {
        return window.confirm(`Are you sure you want to ${action}?`);
    };

    if (isLoading) return <div>Loading...</div>;
    if (!isConnected) return <div>Please connect your Ledger device</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="admin-dashboard">
            <h1>Admin Dashboard</h1>
            
            <section className="metrics">
                <h2>Current Metrics</h2>
                {metrics && (
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <h3>Streaming</h3>
                            <p>Total: {metrics.streaming.total.toLocaleString()}</p>
                            <p>Daily: {metrics.streaming.daily.toLocaleString()}</p>
                            <p>Growth: {metrics.streaming.growth.toFixed(2)}%</p>
                        </div>
                        
                        <div className="metric-card">
                            <h3>Token</h3>
                            <p>Price: ${metrics.token.price.toFixed(4)}</p>
                            <p>Volume: ${metrics.token.volume.toLocaleString()}</p>
                            <p>Liquidity: ${metrics.token.liquidity.toLocaleString()}</p>
                        </div>
                        
                        <div className="metric-card">
                            <h3>Engagement</h3>
                            <p>Users: {metrics.engagement.users.toLocaleString()}</p>
                            <p>Interactions: {metrics.engagement.interactions.toLocaleString()}</p>
                            <p>Rewards: {metrics.engagement.rewards} MORE</p>
                        </div>
                    </div>
                )}
            </section>

            <section className="actions">
                <h2>Management Actions</h2>
                <div className="action-grid">
                    <button
                        onClick={() => handleAction('enableCirculation')}
                        disabled={selectedAction !== ''}
                    >
                        Enable Circulation
                    </button>
                    
                    <button
                        onClick={() => handleAction('adjustLiquidity')}
                        disabled={selectedAction !== ''}
                    >
                        Adjust Liquidity
                    </button>
                    
                    <button
                        onClick={() => handleAction('pauseTrading')}
                        disabled={selectedAction !== ''}
                        className="warning"
                    >
                        Pause Trading
                    </button>
                    
                    <button
                        onClick={() => handleAction('resumeTrading')}
                        disabled={selectedAction !== ''}
                    >
                        Resume Trading
                    </button>
                </div>
            </section>

            <style jsx>{`
                .admin-dashboard {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                    margin: 1rem 0;
                }

                .metric-card {
                    background: #f5f5f5;
                    padding: 1rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin: 1rem 0;
                }

                button {
                    padding: 1rem;
                    border: none;
                    border-radius: 4px;
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                button:hover {
                    background: #0056b3;
                }

                button:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }

                button.warning {
                    background: #dc3545;
                }

                button.warning:hover {
                    background: #c82333;
                }

                .error {
                    color: #dc3545;
                    padding: 1rem;
                    margin: 1rem 0;
                    background: #f8d7da;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}; 