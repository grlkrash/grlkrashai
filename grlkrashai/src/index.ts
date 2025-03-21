import { WalletService } from './services/WalletService';
import { walletConfig } from './config/wallet';

// Initialize wallet service
WalletService.getInstance(walletConfig);

// ... rest of your application initialization code ... 