import express from 'express';
import { YouTubeOAuthService } from '../services/YouTubeOAuthService';
import { YouTubeMusicPromotion } from '../services/YouTubeMusicPromotion';

const router = express.Router();

// OAuth routes
router.get('/auth/start', async (req, res) => {
    try {
        const { userAddress } = req.query;
        if (!userAddress) {
            return res.status(400).json({
                success: false,
                message: 'User address is required'
            });
        }

        const oauthService = YouTubeOAuthService.getInstance();
        const result = await oauthService.startOAuth(userAddress as string);
        res.json(result);
    } catch (error) {
        console.error('Failed to start YouTube OAuth:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start authorization process'
        });
    }
});

router.get('/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).json({
                success: false,
                message: 'Invalid callback parameters'
            });
        }

        const oauthService = YouTubeOAuthService.getInstance();
        const result = await oauthService.handleCallback(code as string, state as string);
        
        // Redirect to frontend with result
        const redirectUrl = new URL('http://localhost:5177/youtube/auth/complete');
        redirectUrl.searchParams.append('success', result.success.toString());
        redirectUrl.searchParams.append('message', result.message);
        if (result.userAddress) {
            redirectUrl.searchParams.append('userAddress', result.userAddress);
        }
        
        res.redirect(redirectUrl.toString());
    } catch (error) {
        console.error('Failed to handle YouTube OAuth callback:', error);
        res.redirect('http://localhost:5177/youtube/auth/error');
    }
});

// Video management routes
router.post('/videos/upload', async (req, res) => {
    try {
        const { content, metrics } = req.body;
        const youtubeService = new YouTubeMusicPromotion(req.app.locals.runtime);
        await youtubeService.initialize();
        
        const videoId = await youtubeService.executeStrategy(content, metrics);
        res.json({
            success: true,
            videoId
        });
    } catch (error) {
        console.error('Failed to upload video:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to upload video'
        });
    }
});

router.get('/videos/:videoId/analytics', async (req, res) => {
    try {
        const { videoId } = req.params;
        const youtubeService = new YouTubeMusicPromotion(req.app.locals.runtime);
        await youtubeService.initialize();
        
        const analytics = await youtubeService.getAnalytics(videoId);
        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        console.error('Failed to get video analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get video analytics'
        });
    }
});

export default router; 