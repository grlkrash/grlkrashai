import { EventEmitter } from 'events';
import { TokenContract } from '../../types/contracts';
import { IPFSContentService } from '../content/IPFSContentService';
import { SpotifyService } from '../promotion/SpotifyService';
import { MusicPromotionService } from '../promotion/MusicPromotionService';
import { TokenAnalyticsService } from '../analytics/TokenAnalyticsService';
import { AutoEngagementService } from '../engagement/AutoEngagementService';
import { SpotifyAnalyticsService } from '../analytics/SpotifyAnalyticsService';

interface MilestoneConfig {
    marketCap?: number;
    streamingCount?: number;
    action: 'release' | 'tease' | 'promote';
    content: {
        ipfsHash?: string;
        type: 'song' | 'artwork' | 'video' | 'announcement';
        message?: string;
    };
    promotion?: {
        message: string;
        platforms: string[];
    };
    rewardAction?: 'enableCommunityRewards' | 'enableNFTMinting';
}

export class MilestoneReleaseService extends EventEmitter {
    private milestones: MilestoneConfig[] = [];
    private isMonitoring = false;

    constructor(
        private tokenContract: TokenContract,
        private ipfsContent: IPFSContentService,
        private spotifyService: SpotifyService,
        private promotionService: MusicPromotionService,
        private tokenAnalytics: TokenAnalyticsService,
        private autoEngagement: AutoEngagementService,
        private spotifyAnalytics: SpotifyAnalyticsService
    ) {
        super();
        this.setupMilestones();
    }

    private setupMilestones() {
        this.milestones = [
            {
                marketCap: 1_000_000, // $1M
                action: 'release',
                content: {
                    ipfsHash: 'QmcXG4L9nRQ31jKCViFV5CYXrzDnuWQ4zUrJyeTaF4FKqG', // MORE.mp3
                    type: 'song'
                },
                promotion: {
                    message: '🚀 $MORE has hit $1M market cap! As promised, the track is now live on Spotify! 🎵',
                    platforms: ['twitter', 'discord', 'telegram']
                }
            },
            {
                marketCap: 500_000, // $500K
                action: 'tease',
                content: {
                    ipfsHash: 'QmYnTNmPrG7d4Sh4PZuRZ1pbSkZ4VdMHZD91SZ3XubTKuT', // MORE_SNIPPET.mp3
                    type: 'song'
                },
                promotion: {
                    message: '👀 $MORE just hit $500K market cap! Here\'s a sneak peek of what\'s coming... 🎵',
                    platforms: ['twitter', 'discord']
                }
            },
            {
                streamingCount: 10_000,
                action: 'promote',
                content: {
                    type: 'announcement',
                    message: '🎉 10K streams on Spotify! Thank you for the support! More surprises coming... 🎵'
                },
                promotion: {
                    message: '10K streams and growing! Keep streaming to unlock more $MORE token utility! 🚀',
                    platforms: ['twitter', 'discord', 'telegram']
                }
            },
            {
                streamingCount: 50_000,
                action: 'promote',
                content: {
                    type: 'announcement',
                    message: '🔥 50K streams! Community rewards program activated!'
                },
                promotion: {
                    message: '50K streams! Community rewards now live - stake $MORE to earn streaming rewards! 🎵',
                    platforms: ['twitter', 'discord', 'telegram']
                },
                rewardAction: 'enableCommunityRewards'
            },
            {
                streamingCount: 100_000,
                action: 'promote',
                content: {
                    type: 'announcement',
                    message: '💫 100K streams! Exclusive NFT collection unlocked!'
                },
                promotion: {
                    message: '100K streams! Mint your exclusive GRLKRASH Supporter NFT now with $MORE tokens! 🎨',
                    platforms: ['twitter', 'discord', 'telegram']
                },
                rewardAction: 'enableNFTMinting'
            }
        ];
    }

    async startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        const checkMilestones = async () => {
            try {
                // Check market cap milestones
                const marketCap = await this.tokenAnalytics.getMarketCap();
                const marketCapMilestones = this.milestones.filter(m => 
                    !m.completed && m.marketCap && marketCap >= m.marketCap
                );

                // Check streaming milestones
                const streamingMetrics = await this.spotifyAnalytics.getTrackMetrics('MORE');
                const streamingMilestones = this.milestones.filter(m => 
                    !m.completed && m.streamingCount && streamingMetrics.totalStreams >= m.streamingCount
                );

                // Execute all pending milestones
                const pendingMilestones = [...marketCapMilestones, ...streamingMilestones];
                for (const milestone of pendingMilestones) {
                    await this.executeMilestone(milestone, {
                        marketCap,
                        streamingMetrics
                    });
                    milestone.completed = true;
                }
            } catch (error) {
                console.error('Error checking milestones:', error);
            }
        };

        // Check every 5 minutes
        setInterval(checkMilestones, 5 * 60 * 1000);
        await checkMilestones(); // Initial check
    }

    private async executeMilestone(milestone: MilestoneConfig, context: any) {
        try {
            // Handle IPFS content if present
            let content = null;
            if (milestone.content.ipfsHash) {
                content = await this.ipfsContent.getContentMetrics(milestone.content.ipfsHash);
                if (!content) throw new Error('Content not found in IPFS');
            }

            switch (milestone.action) {
                case 'release':
                    await this.releaseTrack(content, milestone);
                    break;
                case 'tease':
                    await this.teaseContent(content, milestone);
                    break;
                case 'promote':
                    await this.promoteContent(milestone, context);
                    break;
            }

            // Handle reward actions
            if (milestone.rewardAction) {
                await this.executeRewardAction(milestone.rewardAction, context);
            }

            // Trigger cross-platform promotion
            if (milestone.promotion) {
                await this.autoEngagement.createCampaign({
                    message: milestone.promotion.message,
                    platforms: milestone.promotion.platforms,
                    content: milestone.content.type === 'announcement' 
                        ? { type: 'text', message: milestone.content.message }
                        : { type: milestone.content.type, url: content?.baseContent.url }
                });
            }

            this.emit('milestoneCompleted', {
                type: milestone.action,
                marketCap: context.marketCap,
                streamingCount: context.streamingMetrics?.totalStreams,
                content: milestone.content
            });
        } catch (error) {
            console.error('Error executing milestone:', error);
            this.emit('milestoneError', { milestone, error });
        }
    }

    private async executeRewardAction(action: string, context: any) {
        switch (action) {
            case 'enableCommunityRewards':
                await this.tokenContract.enableCommunityRewards({
                    streamingMultiplier: 0.1, // 10% rewards boost per 1000 streams
                    maxRewardRate: 0.2, // 20% APY max
                    minStakeAmount: 1000 * 10**18 // 1000 MORE tokens min stake
                });
                break;
            case 'enableNFTMinting':
                await this.tokenContract.enableNFTMinting({
                    maxSupply: 10000,
                    mintPrice: 1000 * 10**18, // 1000 MORE tokens
                    streamingBonus: context.streamingMetrics.totalStreams > 200000 ? 0.5 : 0.2 // 50% or 20% discount
                });
                break;
        }
    }

    private async releaseTrack(content: any, milestone: MilestoneConfig) {
        // Upload to Spotify
        const trackId = await this.spotifyService.uploadTrack(
            content.baseContent.url,
            {
                title: 'MORE',
                artist: 'GRLKRASH',
                genre: ['electronic', 'hyperpop'],
                releaseDate: new Date(),
                artwork: milestone.content.artwork,
                explicit: false,
                language: 'en',
                isrc: content.baseContent.metadata.isrc
            }
        );

        // Initialize promotion campaign
        await this.promotionService.createCampaign({
            title: 'MORE - Official Release',
            platforms: ['spotify', 'twitter', 'discord', 'telegram'],
            content: {
                spotify: trackId,
                ipfs: milestone.content.ipfsHash
            },
            budget: 1000,
            duration: 7 // 7 days
        });
    }

    private async teaseContent(content: any, milestone: MilestoneConfig) {
        await this.promotionService.createTeaser({
            content: content.baseContent.url,
            platforms: milestone.promotion?.platforms || ['twitter', 'discord'],
            duration: 30, // 30 seconds
            message: milestone.promotion?.message
        });
    }

    private async promoteContent(milestone: MilestoneConfig, context: any) {
        await this.autoEngagement.createEngagementCampaign({
            content: context.streamingMetrics.trackUrl,
            platforms: ['spotify'],
            metrics: {
                marketCap: context.marketCap,
                targetEngagement: 1000,
                duration: 24 // 24 hours
            }
        });
    }
} 