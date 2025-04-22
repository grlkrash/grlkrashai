import { ethers } from 'ethers';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { KMS } from 'aws-sdk';
import { Logger } from '../utils/logger';

const router = Router();
const kms = new KMS();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

// Auth middleware
const authMiddleware = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No token provided');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded || typeof decoded !== 'object' || !decoded.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Decrypt private key from KMS
async function getWallet() {
  const { Plaintext } = await kms.decrypt({
    CiphertextBlob: Buffer.from(process.env.ENCRYPTED_PRIVATE_KEY!, 'base64')
  }).promise();
  
  return new ethers.Wallet(
    Plaintext!.toString(),
    new ethers.JsonRpcProvider(process.env.RPC_URL)
  );
}

// Endpoints
router.post('/deploy', limiter, authMiddleware, async (req, res) => {
  try {
    const wallet = await getWallet();
    const factory = new ethers.ContractFactory(
      require('../../contracts/MOREToken.json').abi,
      require('../../contracts/MOREToken.json').bytecode,
      wallet
    );
    
    const token = await factory.deploy();
    await token.waitForDeployment();
    
    Logger.info(`Token deployed to: ${await token.getAddress()}`);
    res.json({ address: await token.getAddress() });
  } catch (error) {
    Logger.error('Token deployment failed:', error);
    res.status(500).json({ error: 'Deployment failed' });
  }
});

router.post('/enable-circulation', limiter, authMiddleware, async (req, res) => {
  try {
    const { tokenAddress, poolAddress } = req.body;
    if (!tokenAddress || !poolAddress) throw new Error('Missing parameters');

    const wallet = await getWallet();
    const token = new ethers.Contract(
      tokenAddress,
      require('../../contracts/MOREToken.json').abi,
      wallet
    );

    const tx = await token.enableCirculation(poolAddress);
    await tx.wait();

    Logger.info('Circulation enabled for token:', tokenAddress);
    res.json({ success: true });
  } catch (error) {
    Logger.error('Enable circulation failed:', error);
    res.status(500).json({ error: 'Enable circulation failed' });
  }
});

router.post('/setup-liquidity', limiter, authMiddleware, async (req, res) => {
  try {
    const { tokenAddress, poolAddress, amount } = req.body;
    if (!tokenAddress || !poolAddress || !amount) throw new Error('Missing parameters');

    const wallet = await getWallet();
    const pool = new ethers.Contract(
      poolAddress,
      require('../../contracts/MOREPool.json').abi,
      wallet
    );

    const tx = await pool.addLiquidity({ value: ethers.parseEther(amount) });
    await tx.wait();

    Logger.info('Liquidity added for pool:', poolAddress);
    res.json({ success: true });
  } catch (error) {
    Logger.error('Setup liquidity failed:', error);
    res.status(500).json({ error: 'Setup liquidity failed' });
  }
});

export default router; 