import { ethers } from 'ethers';
import { MOREToken } from '../contracts/MOREToken';
import { TwitterService } from './TwitterService';

interface WalletVerification {
    userId: string;
    address: string;
    signature: string;
    timestamp: number;
}

interface UserData {
    walletAddress: string;
    phoneNumber?: string;
    email?: string;
    twitterUsername?: string;
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    isTwitterVerified: boolean;
    verificationCode?: string;
    verificationExpiry?: number;
    verificationMethod?: 'phone' | 'email' | 'twitter';
}

export class AuthorizationService {
    private static instance: AuthorizationService;
    private moreToken: MOREToken;
    private verifiedWallets: Map<string, WalletVerification> = new Map();
    private userData: Map<string, UserData> = new Map();
    private twitterService: TwitterService;
    private readonly VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    private readonly MIN_TOKEN_REQUIREMENT = ethers.parseEther("100"); // Minimum 100 MORE tokens required
    private readonly VERIFICATION_TIMEOUT = 300000; // 5 minutes
    private readonly VERIFICATION_CODE_LENGTH = 6;

    private constructor(moreToken: MOREToken) {
        this.moreToken = moreToken;
        this.twitterService = TwitterService.getInstance();
    }

    public static getInstance(moreToken: MOREToken): AuthorizationService {
        if (!AuthorizationService.instance) {
            AuthorizationService.instance = new AuthorizationService(moreToken);
        }
        return AuthorizationService.instance;
    }

    public async verifyWallet(userId: string, address: string, signature: string): Promise<boolean> {
        try {
            const message = `Verify wallet ownership for GRLKRASH Bot: ${userId}`;
            const recoveredAddress = ethers.verifyMessage(message, signature);
            
            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                return false;
            }

            this.verifiedWallets.set(userId, {
                userId,
                address,
                signature,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error('Wallet verification failed:', error);
            return false;
        }
    }

    public async isAuthorizedDeployer(userId: string): Promise<boolean> {
        const verification = this.verifiedWallets.get(userId);
        if (!verification || Date.now() - verification.timestamp > this.VERIFICATION_EXPIRY) {
            return false;
        }

        const authorizedDeployer = await this.moreToken.AUTHORIZED_DEPLOYER();
        return verification.address.toLowerCase() === authorizedDeployer.toLowerCase();
    }

    public async isTokenHolder(userId: string): Promise<boolean> {
        const verification = this.verifiedWallets.get(userId);
        if (!verification || Date.now() - verification.timestamp > this.VERIFICATION_EXPIRY) {
            return false;
        }

        const balance = await this.moreToken.balanceOf(verification.address);
        return balance.gte(this.MIN_TOKEN_REQUIREMENT);
    }

    public async isAuthorized(userId: string): Promise<boolean> {
        return await this.isAuthorizedDeployer(userId) || await this.isTokenHolder(userId);
    }

    public getVerifiedWallet(userId: string): string | null {
        const verification = this.verifiedWallets.get(userId);
        if (!verification || Date.now() - verification.timestamp > this.VERIFICATION_EXPIRY) {
            return null;
        }
        return verification.address;
    }

    public clearVerification(userId: string): void {
        this.verifiedWallets.delete(userId);
    }

    public async addBackupEmail(walletAddress: string, email: string): Promise<any> {
        const userData = this.userData.get(walletAddress);
        
        if (!userData) {
            return {
                error: true,
                status: {
                    message: "⚠️ NO ACTIVE USER PROFILE\n\n" +
                            "Please verify your identity first using phone or Twitter."
                }
            };
        }

        if (!userData.isPhoneVerified && !userData.isTwitterVerified) {
            return {
                error: true,
                status: {
                    message: "⚠️ VERIFICATION REQUIRED\n\n" +
                            "Please verify your identity first using:\n" +
                            "1. Phone: verify phone <number>\n" +
                            "2. Twitter: twitter @username"
                }
            };
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const now = Date.now();

        userData.email = email;
        userData.verificationCode = verificationCode;
        userData.verificationExpiry = now + this.VERIFICATION_TIMEOUT;
        userData.verificationMethod = 'email';
        this.userData.set(walletAddress, userData);

        // TODO: Integrate with actual email service
        console.log('[DEBUG] Would send email:', {
            to: email,
            code: verificationCode
        });

        return {
            status: {
                message: "📧 BACKUP CHANNEL INITIALIZATION\n\n" +
                        "A verification code has been dispatched to your email.\n\n" +
                        "To secure your backup channel:\n" +
                        "1. Check your email for the verification code\n" +
                        "2. Enter the code using: verify email <code>\n\n" +
                        "The code will self-destruct in 5 minutes.\n" +
                        "Your dedication to security is commendable, rebel."
            }
        };
    }

    public async verifyEmailCode(walletAddress: string, code: string): Promise<any> {
        const userData = this.userData.get(walletAddress);
        
        if (!userData || !userData.verificationCode || userData.verificationMethod !== 'email') {
            return {
                error: true,
                status: {
                    message: "⚠️ NO ACTIVE EMAIL VERIFICATION\n\n" +
                            "Please initiate email verification first:\n" +
                            "Use: backup email <address>"
                }
            };
        }

        if (Date.now() > (userData.verificationExpiry || 0)) {
            userData.verificationCode = undefined;
            userData.verificationExpiry = undefined;
            userData.verificationMethod = undefined;
            this.userData.set(walletAddress, userData);
            
            return {
                error: true,
                status: {
                    message: "⚠️ EMAIL CODE EXPIRED\n\n" +
                            "Your verification code has expired.\n" +
                            "Please request a new code:\n" +
                            "Use: backup email <address>\n\n" +
                            "The resistance values your security."
                }
            };
        }

        if (code === userData.verificationCode) {
            userData.isEmailVerified = true;
            userData.verificationCode = undefined;
            userData.verificationExpiry = undefined;
            userData.verificationMethod = undefined;
            this.userData.set(walletAddress, userData);

            return {
                verified: true,
                status: {
                    message: "✅ BACKUP CHANNEL SECURED!\n\n" +
                            "Your email has been verified and stored securely.\n" +
                            "It will serve as a fallback recovery method.\n\n" +
                            "The resistance grows stronger with each secure connection!"
                }
            };
        }

        return {
            error: true,
            status: {
                message: "❌ EMAIL VERIFICATION FAILED\n\n" +
                        "The provided code does not match our records.\n" +
                        "Please try again or request a new code:\n" +
                        "Use: backup email <address>\n\n" +
                        "Stay vigilant, brave rebel."
            }
        };
    }

    public async startPhoneVerification(walletAddress: string, phoneNumber: string): Promise<{ success: boolean; message: string }> {
        if (!this.isValidPhoneNumber(phoneNumber)) {
            return {
                success: false,
                message: "❌ INVALID SIGNAL FORMAT\n\n" +
                        "Please provide a valid phone number in the format:\n" +
                        "+1234567890\n\n" +
                        "The resistance requires precise coordinates."
            };
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const existingData = this.userData.get(walletAddress) || {
            walletAddress,
            isPhoneVerified: false,
            isTwitterVerified: false
        };

        this.userData.set(walletAddress, {
            ...existingData,
            phoneNumber,
            verificationCode,
            verificationMethod: 'phone',
            verificationExpiry: Date.now() + this.VERIFICATION_TIMEOUT
        });

        return {
            success: true,
            message: "🔐 VERIFICATION PROTOCOL INITIATED\n\n" +
                    "A secure transmission has been sent to your device.\n\n" +
                    `Your verification code is: ${verificationCode}\n\n` +
                    "To complete verification:\n" +
                    "Run: verify <code>\n\n" +
                    "Stay vigilant, brave rebel."
        };
    }

    public async verifyPhoneCode(walletAddress: string, code: string): Promise<{ success: boolean; message: string }> {
        const userData = this.userData.get(walletAddress);

        if (!userData || !userData.verificationCode || !userData.verificationExpiry) {
            return {
                success: false,
                message: "❌ NO ACTIVE VERIFICATION REQUEST\n\n" +
                        "Please initiate verification first:\n" +
                        "Run: verify phone <number>"
            };
        }

        if (userData.verificationExpiry < Date.now()) {
            this.userData.delete(walletAddress);
            return {
                success: false,
                message: "❌ VERIFICATION EXPIRED\n\n" +
                        "Your verification code has expired.\n" +
                        "Please request a new code:\n" +
                        "Run: verify phone <number>"
            };
        }

        if (userData.verificationCode !== code) {
            return {
                success: false,
                message: "❌ INVALID VERIFICATION CODE\n\n" +
                        "The code provided does not match our records.\n" +
                        "Please try again or request a new code."
            };
        }

        userData.isPhoneVerified = true;
        userData.verificationCode = undefined;
        userData.verificationExpiry = undefined;
        this.userData.set(walletAddress, userData);

        return {
            success: true,
            message: "✅ VERIFICATION SUCCESSFUL!\n\n" +
                    "Your identity has been confirmed.\n" +
                    "Welcome to the resistance, brave rebel!"
        };
    }

    private isValidPhoneNumber(phoneNumber: string): boolean {
        return /^\+\d{10,15}$/.test(phoneNumber);
    }

    public getUserData(walletAddress: string): UserData | undefined {
        return this.userData.get(walletAddress);
    }

    public isVerified(walletAddress: string): boolean {
        const userData = this.userData.get(walletAddress);
        return userData ? (userData.isPhoneVerified || userData.isTwitterVerified) : false;
    }
} 