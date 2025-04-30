import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import styled from 'styled-components';
import { LiquidityPoolDashboard } from '../components/LiquidityPoolDashboard';

const PageContainer = styled.div`
    padding: 2rem;
    min-height: 100vh;
    background: #121212;
`;

const ConnectButton = styled.button`
    background: #1DB954;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    margin: 2rem auto;
    display: block;

    &:hover {
        background: #1ed760;
    }
`;

const ErrorMessage = styled.div`
    color: #ff4444;
    text-align: center;
    margin: 2rem;
`;

export const Pool: React.FC = () => {
    const [provider, setProvider] = useState<ethers.Provider | null>(null);
    const [error, setError] = useState<string>('');

    // Contract addresses
    const MORE_TOKEN_ADDRESS = '0x7Be109D94A1f51c5adfc5537c542142C5876DC2d';
    const POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || '0x...'; // Will be set from environment

    const connectWallet = async () => {
        try {
            if (window.ethereum) {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);
                setError('');
            } else {
                setError('Please install MetaMask to use this feature');
            }
        } catch (err) {
            setError('Failed to connect wallet');
            console.error('Wallet connection error:', err);
        }
    };

    useEffect(() => {
        // Check if already connected
        if (window.ethereum) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
        }
    }, []);

    if (error) {
        return (
            <PageContainer>
                <ErrorMessage>{error}</ErrorMessage>
                <ConnectButton onClick={connectWallet}>Try Again</ConnectButton>
            </PageContainer>
        );
    }

    if (!provider) {
        return (
            <PageContainer>
                <ConnectButton onClick={connectWallet}>
                    Connect Wallet
                </ConnectButton>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <LiquidityPoolDashboard
                poolAddress={POOL_ADDRESS}
                moreTokenAddress={MORE_TOKEN_ADDRESS}
                provider={provider}
            />
        </PageContainer>
    );
}; 