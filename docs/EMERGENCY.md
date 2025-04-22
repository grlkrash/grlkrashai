# Emergency Procedures for MOREToken

## Overview
This document outlines the emergency procedures for the MOREToken contract, including when and how to use the emergency pause functionality.

## Prerequisites
1. Access to the authorized deployer wallet
2. Node.js and npm installed
3. Environment variables set up:
   ```
   TOKEN_ADDRESS=<deployed_contract_address>
   ```

## Emergency Scripts

### Monitor Mode
Monitor contract events in real-time:
```bash
npx hardhat run scripts/emergency.ts --network base-sepolia -- --monitor
```

### Full Emergency Scenario
Run through a complete emergency scenario:
```bash
npx hardhat run scripts/emergency.ts --network base-sepolia
```

## Emergency Scenarios

### 1. Suspicious Activity Detection
If suspicious activity is detected:
1. Run monitor mode to track events
2. Pause the contract immediately
3. Investigate transactions
4. Unpause only after thorough investigation

### 2. Smart Contract Vulnerability
If a vulnerability is discovered:
1. Pause the contract immediately
2. Prevent any new transactions
3. Audit the impact
4. Deploy fixes if needed
5. Unpause after resolution

### 3. Market Manipulation
If market manipulation is detected:
1. Monitor unusual trading patterns
2. Pause if necessary to prevent exploitation
3. Investigate trading activity
4. Implement additional safeguards if needed

## Emergency Response Steps

### Step 1: Initial Response
1. Monitor contract events:
   ```bash
   npx hardhat run scripts/emergency.ts --network base-sepolia -- --monitor
   ```
2. Validate current state
3. Document the incident

### Step 2: Contract Pause
1. Execute emergency pause:
   ```bash
   npx hardhat run scripts/emergency.ts --network base-sepolia
   ```
2. Verify pause status
3. Monitor blocked transactions

### Step 3: Investigation
1. Review event logs
2. Analyze transaction history
3. Identify root cause
4. Document findings

### Step 4: Resolution
1. Implement necessary fixes
2. Test solutions thoroughly
3. Prepare unpause procedure
4. Update security measures

### Step 5: Recovery
1. Unpause contract
2. Monitor post-unpause activity
3. Verify normal operations
4. Document resolution

## Monitoring Tools

### Event Types
1. `EmergencyPaused`: Contract pause events
2. `EmergencyUnpaused`: Contract unpause events
3. `VestingDistribution`: Vesting-related events
4. `Transfer`: Token transfer events

### State Validation
The script validates:
- Pause status
- Vesting status
- Circulation status
- Remaining vested amounts

## Security Checklist

### Before Pausing
- [ ] Confirm emergency situation
- [ ] Document reason for pause
- [ ] Notify key stakeholders
- [ ] Start event monitoring

### During Pause
- [ ] Monitor blocked transactions
- [ ] Document affected operations
- [ ] Investigate root cause
- [ ] Develop resolution plan

### Before Unpausing
- [ ] Verify issue resolution
- [ ] Test all critical functions
- [ ] Document changes made
- [ ] Notify stakeholders

### After Unpausing
- [ ] Monitor contract activity
- [ ] Verify normal operations
- [ ] Document incident closure
- [ ] Update security measures

## Contact Information

### Emergency Contacts
- Technical Lead: [TBD]
- Security Team: [TBD]
- Community Manager: [TBD]

### Communication Channels
- Emergency Hotline: [TBD]
- Secure Email: [TBD]
- Emergency Chat: [TBD]

## Incident Reporting Template

```markdown
## Incident Report

### Incident Details
- Date/Time: 
- Detected By:
- Type of Emergency:

### Initial Assessment
- Severity Level:
- Affected Components:
- Initial Impact:

### Actions Taken
1. Detection:
2. Response:
3. Resolution:

### Resolution
- Time to Resolution:
- Root Cause:
- Preventive Measures:

### Lessons Learned
- What Worked:
- What Needs Improvement:
- New Procedures Required:
``` 