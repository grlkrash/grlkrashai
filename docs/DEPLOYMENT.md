# MOREToken Deployment Procedures

## Prerequisites

### Environment Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   PRIVATE_KEY=your_deployer_private_key
   BASE_SEPOLIA_RPC_URL=your_base_sepolia_rpc_url
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

### Pre-deployment Checklist
- [ ] Verify authorized deployer address in contract
- [ ] Confirm seed wallet address
- [ ] Validate token allocations
- [ ] Test all functions on local network
- [ ] Audit contract security features
- [ ] Prepare liquidity pool contract

## Deployment Steps

### 1. Local Testing
```bash
# Compile contracts
npx hardhat compile

# Run test suite
npx hardhat test

# Run emergency scenario tests
npx hardhat test test/Emergency.test.ts
```

### 2. Base Sepolia Testnet Deployment
```bash
# Deploy contract
npx hardhat run scripts/deploy.ts --network base-sepolia

# Verify contract on Base Sepolia Explorer
npx hardhat verify --network base-sepolia DEPLOYED_CONTRACT_ADDRESS
```

### 3. Initialize Contract
1. Call `initialize()` function:
   ```bash
   npx hardhat run scripts/initialize.ts --network base-sepolia
   ```
   This will:
   - Set initial state variables
   - Distribute team allocation (3%)
   - Distribute hiring/incentives allocation (5%)
   - Lock circulation supply (62%)

### 4. Enable Circulation
1. Deploy liquidity pool contract
2. Call `enableCirculation()` with liquidity pool address:
   ```bash
   npx hardhat run scripts/enable-circulation.ts --network base-sepolia
   ```

### 5. Start Monitoring
1. Launch monitoring dashboard:
   ```bash
   npx hardhat run scripts/dashboard.ts --network base-sepolia
   ```

## Post-deployment Verification

### 1. Contract Verification
- [ ] Verify contract code on Base Explorer
- [ ] Check contract initialization status
- [ ] Confirm token allocations
- [ ] Validate owner permissions

### 2. Token Distribution Verification
- [ ] Team allocation (3%)
- [ ] Hiring/Incentives allocation (5%)
- [ ] Locked circulation supply (62%)
- [ ] Seed allocation ready for vesting (30%)

### 3. Security Checks
- [ ] Test pause functionality
- [ ] Verify vesting schedule
- [ ] Check transfer restrictions
- [ ] Test emergency procedures

## Vesting Schedule Setup

### 1. Seed Round Vesting (30%)
- Total Period: 6 months
- Distribution: Linear vesting
- Claim Frequency: Daily available
- Start Time: Set at initialization

### 2. Monitor Vesting
```bash
# Check vesting status
npx hardhat run scripts/check-vesting.ts --network base-sepolia

# Monitor distributions
npx hardhat run scripts/monitor-vesting.ts --network base-sepolia
```

## Emergency Procedures

### 1. Emergency Contacts
Keep these contacts readily available:
- Technical Lead: [TBD]
- Security Team: [TBD]
- Liquidity Pool Manager: [TBD]

### 2. Emergency Scripts
Prepare these scripts for quick access:
```bash
# Emergency pause
npx hardhat run scripts/emergency-pause.ts --network base-sepolia

# Emergency unpause
npx hardhat run scripts/emergency-unpause.ts --network base-sepolia
```

## Maintenance Procedures

### 1. Regular Monitoring
- Monitor vesting distributions
- Track liquidity pool status
- Check transfer patterns
- Review emergency events

### 2. Update Procedures
For contract upgrades or parameter changes:
1. Deploy new contract version
2. Audit changes
3. Coordinate with stakeholders
4. Execute upgrade

## Documentation Updates

### 1. Required Updates
- [ ] Update contract addresses
- [ ] Document deployment parameters
- [ ] Record initialization timestamp
- [ ] Note any deviations from plan

### 2. Stakeholder Communication
- [ ] Notify team of deployment
- [ ] Provide vesting schedule
- [ ] Share monitoring dashboard
- [ ] Distribute emergency contacts

## Troubleshooting

### Common Issues
1. Failed Initialization
   - Check authorized deployer address
   - Verify gas settings
   - Confirm network status

2. Vesting Issues
   - Verify timestamp calculations
   - Check distribution amounts
   - Confirm recipient addresses

3. Liquidity Pool Problems
   - Validate pool contract
   - Check allowances
   - Verify token balances

### Support Resources
- Technical Documentation: [Link]
- Support Channel: [Link]
- Emergency Hotline: [Number]

## Network Details

### Base Sepolia
- RPC URL: `https://sepolia.base.org`
- Chain ID: 84532
- Explorer: `https://sepolia.basescan.org`
- Gas Token: ETH

### Base Mainnet
- RPC URL: `https://mainnet.base.org`
- Chain ID: 8453
- Explorer: `https://basescan.org`
- Gas Token: ETH

## Deployment Timeline

### Phase 1: Preparation (Day 1)
- [ ] Environment setup
- [ ] Contract compilation
- [ ] Local testing

### Phase 2: Testnet (Day 2-3)
- [ ] Testnet deployment
- [ ] Initialization testing
- [ ] Vesting verification

### Phase 3: Mainnet (Day 4)
- [ ] Contract deployment
- [ ] Token initialization
- [ ] Circulation setup

### Phase 4: Monitoring (Day 5+)
- [ ] Dashboard setup
- [ ] Vesting tracking
- [ ] Emergency readiness 