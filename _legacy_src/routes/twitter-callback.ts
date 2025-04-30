import { TwitterOAuthService } from '../services/TwitterOAuthService';
import { UserVerificationService } from '../services/UserVerificationService';

export async function handleTwitterCallback(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code || !state) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Missing required parameters'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const twitterOAuth = TwitterOAuthService.getInstance();
        const userVerification = UserVerificationService.getInstance();

        const result = await twitterOAuth.handleCallback(code, state);
        
        if (!result.success || !result.userAddress) {
            return new Response(JSON.stringify({
                success: false,
                message: result.message
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update user verification status
        await userVerification.setTwitterVerified(result.userAddress, true);

        // Redirect to success page
        return new Response(null, {
            status: 302,
            headers: {
                'Location': '/?verified=true'
            }
        });

    } catch (error) {
        console.error('Error handling Twitter callback:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 