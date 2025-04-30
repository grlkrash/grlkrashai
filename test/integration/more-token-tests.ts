import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MockDataGenerator } from '../utils/mock-data-generator';
import { 
    ContractService,
    TokenDistributionService,
    TokenAnalyticsService,
    WalletService
} from '../../src/services';

describe('$MORE Token Integration Tests', () => {
    let contractService: ContractService;
    let tokenDistribution: TokenDistributionService;
    let tokenAnalytics: TokenAnalyticsService;
    let walletService: WalletService;
    
    // Test data
    let deployerWallet: any;
    let userWallets: any[];
    let moreTokenContract: any;
    
    before(async () => {
        // Initialize services
        contractService = new ContractService();
        tokenDistribution = new TokenDistributionService();
        tokenAnalytics = new TokenAnalyticsService();
        walletService = new WalletService();
        
        // Generate test wallets
        deployerWallet = await MockDataGenerator.generateWallet();
        userWallets = await Promise.all(
            Array(5).fill(null).map(() => MockDataGenerator.generateWallet())
        );
        
        // Deploy test contract if not already deployed
        moreTokenContract = await contractService.getMoreTokenContract();
        if (!moreTokenContract) {
            moreTokenContract = await contractService.deployMoreToken();
        }
    });

    describe('Token Deployment & Configuration', () => {
        it('should verify $MORE token deployment on Base Sepolia', async () => {
            const contract = await contractService.getMoreTokenContract();
            expect(contract.address).to.match(/0x[a-fA-F0-9]{40}/);
            
            const name = await contract.name();
            const symbol = await contract.symbol();
            const decimals = await contract.decimals();
            
            expect(name).to.equal('MORE Token');
            expect(symbol).to.equal('MORE');
            expect(decimals).to.equal(18);
        });

        it('should verify initial token supply and distribution', async () => {
            const totalSupply = await moreTokenContract.totalSupply();
            expect(totalSupply).to.be.gt(0);
            
            const ownerBalance = await moreTokenContract.balanceOf(deployerWallet.address);
            expect(ownerBalance).to.equal(totalSupply);
        });

        it('should verify token contract ownership and permissions', async () => {
            const owner = await moreTokenContract.owner();
            expect(owner.toLowerCase()).to.equal(deployerWallet.address.toLowerCase());
            
            // Verify admin roles
            const isAdmin = await moreTokenContract.hasRole(
                ethers.utils.id('ADMIN_ROLE'),
                deployerWallet.address
            );
            expect(isAdmin).to.be.true;
        });
    });

    describe('Milestone-Triggered Actions', () => {
        it('should trigger token distribution on community milestone achievement', async () => {
            const milestone = {
                type: 'community_growth',
                target: 1000,
                achieved: 1500,
                reward: ethers.utils.parseEther('100')
            };
            
            const distribution = await tokenDistribution.handleMilestoneAchievement(
                milestone,
                userWallets[0].address
            );
            
            expect(distribution.success).to.be.true;
            expect(distribution.amount).to.equal(milestone.reward);
        });

        it('should handle content creation milestones', async () => {
            const contentMilestone = {
                type: 'content_creation',
                contentId: '123',
                engagement: {
                    likes: 1000,
                    shares: 500,
                    comments: 200
                },
                reward: ethers.utils.parseEther('50')
            };
            
            const result = await tokenDistribution.handleContentMilestone(
                contentMilestone,
                userWallets[1].address
            );
            
            expect(result.success).to.be.true;
            expect(result.milestoneType).to.equal('content_creation');
        });

        it('should process platform integration milestones', async () => {
            const integrationMilestone = {
                type: 'platform_integration',
                platform: 'spotify',
                metric: 'monthly_listeners',
                target: 10000,
                achieved: 12000,
                reward: ethers.utils.parseEther('200')
            };
            
            const result = await tokenDistribution.handleIntegrationMilestone(
                integrationMilestone,
                userWallets[2].address
            );
            
            expect(result.success).to.be.true;
            expect(result.overachievement).to.be.gt(0);
        });
    });

    describe('Token Distribution Mechanics', () => {
        it('should handle batch token distribution', async () => {
            const recipients = userWallets.map(w => w.address);
            const amounts = recipients.map(() => ethers.utils.parseEther('10'));
            
            const result = await tokenDistribution.batchDistribute(recipients, amounts);
            expect(result.success).to.be.true;
            expect(result.transferCount).to.equal(recipients.length);
            
            // Verify balances
            for (const wallet of userWallets) {
                const balance = await moreTokenContract.balanceOf(wallet.address);
                expect(balance).to.be.gte(ethers.utils.parseEther('10'));
            }
        });

        it('should enforce distribution limits and cooldowns', async () => {
            const recipient = userWallets[0].address;
            const amount = ethers.utils.parseEther('1000000'); // Large amount
            
            await expect(
                tokenDistribution.distribute(recipient, amount)
            ).to.be.revertedWith('Distribution limit exceeded');
        });

        it('should track distribution history', async () => {
            const recipient = userWallets[1].address;
            const amount = ethers.utils.parseEther('5');
            
            await tokenDistribution.distribute(recipient, amount);
            const history = await tokenDistribution.getDistributionHistory(recipient);
            
            expect(history).to.have.length.gt(0);
            expect(history[history.length - 1].amount).to.equal(amount);
        });
    });

    describe('Analytics & Reporting', () => {
        it('should track token velocity and circulation', async () => {
            const metrics = await tokenAnalytics.getTokenMetrics();
            
            expect(metrics).to.have.property('velocity');
            expect(metrics).to.have.property('circulatingSupply');
            expect(metrics).to.have.property('holders');
        });

        it('should analyze distribution patterns', async () => {
            const analysis = await tokenAnalytics.analyzeDistributionPatterns();
            
            expect(analysis).to.have.property('topHolders');
            expect(analysis).to.have.property('distributionCurve');
            expect(analysis).to.have.property('giniCoefficient');
        });

        it('should generate milestone achievement reports', async () => {
            const report = await tokenAnalytics.generateMilestoneReport();
            
            expect(report).to.have.property('achievedMilestones');
            expect(report).to.have.property('totalDistributed');
            expect(report).to.have.property('participationRate');
        });
    });

    describe('Error Handling & Edge Cases', () => {
        it('should handle failed transactions gracefully', async () => {
            const invalidWallet = '0x1234567890123456789012345678901234567890';
            const amount = ethers.utils.parseEther('1');
            
            const result = await tokenDistribution.distribute(invalidWallet, amount);
            expect(result.success).to.be.false;
            expect(result.error).to.exist;
        });

        it('should prevent duplicate milestone claims', async () => {
            const milestone = {
                id: 'milestone_123',
                type: 'community_growth',
                reward: ethers.utils.parseEther('10')
            };
            
            // First claim should succeed
            await tokenDistribution.handleMilestoneAchievement(
                milestone,
                userWallets[0].address
            );
            
            // Second claim should fail
            await expect(
                tokenDistribution.handleMilestoneAchievement(
                    milestone,
                    userWallets[0].address
                )
            ).to.be.revertedWith('Milestone already claimed');
        });

        it('should handle contract upgrades and migrations', async () => {
            const migrationResult = await contractService.prepareContractUpgrade();
            expect(migrationResult.readyForUpgrade).to.be.true;
            expect(migrationResult.validationPassed).to.be.true;
        });
    });
}); 