import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import styled from 'styled-components';

const DashboardContainer = styled.div`
    background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
    border-radius: 20px;
    padding: 2rem;
    color: #fff;
    max-width: 1200px;
    margin: 0 auto;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
`;

const Title = styled.h2`
    color: #1DB954;
    margin: 0;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
`;

const StatCard = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 15px;
    padding: 1.5rem;
    text-align: center;
`;

const StatLabel = styled.div`
    color: #888;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
`;

const StatValue = styled.div`
    font-size: 1.5rem;
    font-weight: bold;
    color: #1DB954;
`;

const ActionButton = styled.button`
    background: #1DB954;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
        background: #1ed760;
    }

    &:disabled {
        background: #666;
        cursor: not-allowed;
    }
`;

interface Props {
    poolAddress: string;
    moreTokenAddress: string;
    provider: ethers.Provider;
}

export const LiquidityPoolDashboard: React.FC<Props> = ({
    poolAddress,
    moreTokenAddress,
    provider
}) => {
    const [poolStats, setPoolStats] = useState({
        totalLiquidity: '0',
        moreReserve: '0',
        ethReserve: '0',
        lockedLiquidity: '0',
        tradingFee: '0.3%',
        yourLiquidity: '0'
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPoolStats = async () => {
            try {
                const poolContract = new ethers.Contract(
                    poolAddress,
                    [
                        'function getReserves() view returns (uint112, uint112, uint32)',
                        'function totalLiquidity() view returns (uint256)',
                        'function lockedLiquidity() view returns (uint256)',
                        'function liquidityBalances(address) view returns (uint256)'
                    ],
                    provider
                );

                const [moreReserve, ethReserve] = await poolContract.getReserves();
                const totalLiquidity = await poolContract.totalLiquidity();
                const lockedLiquidity = await poolContract.lockedLiquidity();
                
                const signer = await provider.getSigner();
                const userAddress = await signer.getAddress();
                const userLiquidity = await poolContract.liquidityBalances(userAddress);

                setPoolStats({
                    totalLiquidity: ethers.formatEther(totalLiquidity),
                    moreReserve: ethers.formatEther(moreReserve),
                    ethReserve: ethers.formatEther(ethReserve),
                    lockedLiquidity: ethers.formatEther(lockedLiquidity),
                    tradingFee: '0.3%',
                    yourLiquidity: ethers.formatEther(userLiquidity)
                });
                setLoading(false);
            } catch (error) {
                console.error('Error fetching pool stats:', error);
                setLoading(false);
            }
        };

        fetchPoolStats();
        const interval = setInterval(fetchPoolStats, 15000); // Refresh every 15 seconds

        return () => clearInterval(interval);
    }, [poolAddress, provider]);

    const handleAddLiquidity = async () => {
        // Implementation for adding liquidity
    };

    const handleRemoveLiquidity = async () => {
        // Implementation for removing liquidity
    };

    if (loading) {
        return <DashboardContainer>Loading pool statistics...</DashboardContainer>;
    }

    return (
        <DashboardContainer>
            <Header>
                <Title>$MORE Liquidity Pool</Title>
                <div>
                    <ActionButton onClick={handleAddLiquidity} style={{ marginRight: '1rem' }}>
                        Add Liquidity
                    </ActionButton>
                    <ActionButton 
                        onClick={handleRemoveLiquidity}
                        disabled={Number(poolStats.yourLiquidity) === 0}
                    >
                        Remove Liquidity
                    </ActionButton>
                </div>
            </Header>

            <StatsGrid>
                <StatCard>
                    <StatLabel>Total Liquidity</StatLabel>
                    <StatValue>{Number(poolStats.totalLiquidity).toLocaleString()} LP</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>MORE Reserve</StatLabel>
                    <StatValue>{Number(poolStats.moreReserve).toLocaleString()} MORE</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>ETH Reserve</StatLabel>
                    <StatValue>{Number(poolStats.ethReserve).toLocaleString()} ETH</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Locked Liquidity</StatLabel>
                    <StatValue>{Number(poolStats.lockedLiquidity).toLocaleString()} LP</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Trading Fee</StatLabel>
                    <StatValue>{poolStats.tradingFee}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Your Liquidity</StatLabel>
                    <StatValue>{Number(poolStats.yourLiquidity).toLocaleString()} LP</StatValue>
                </StatCard>
            </StatsGrid>
        </DashboardContainer>
    );
}; 