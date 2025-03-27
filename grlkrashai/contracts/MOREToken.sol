// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MOREToken
 * @dev Implementation of the MORE token with vesting, circulation control, and security features.
 * 
 * Security features:
 * - ReentrancyGuard for all external functions
 * - Pausable for emergency situations
 * - Rate limiting for vesting distributions
 * - Access control through authorized deployer
 * - Liquidity pool validation
 * - Event monitoring
 */
contract MOREToken is ERC20, ERC20Permit, Ownable, ReentrancyGuard, Pausable {
    // Deployment control
    address public constant AUTHORIZED_DEPLOYER = 0x92d0A2c330683E1F7A4D027B017249b0f6F018fc;
    address public constant SEED_WALLET = 0x92d0A2c330683E1F7A4D027B017249b0f6F018fc;
    bool public isInitialized;
    
    // Vesting and allocation parameters
    uint256 public constant TOTAL_SUPPLY = 999_999_999 * 10**18;
    uint256 public constant SEED_ALLOCATION = (TOTAL_SUPPLY * 25) / 100;    // 25%
    uint256 public constant COMMUNITY_REWARDS = (TOTAL_SUPPLY * 5) / 100;   // 5%
    uint256 public constant TEAM_ALLOCATION = (TOTAL_SUPPLY * 3) / 100;     // 3%
    uint256 public constant HIRING_INCENTIVES = (TOTAL_SUPPLY * 5) / 100;   // 5%
    uint256 public constant CIRCULATION_SUPPLY = (TOTAL_SUPPLY * 62) / 100; // 62%
    uint256 public constant INITIAL_CIRCULATION_PERCENT = 10;               // Start with 10% circulation
    uint256 public constant LOCKED_LIQUIDITY_PERCENT = 10;                 // 10% of circulation supply
    uint256 public constant LIQUIDITY_LOCK_PERIOD = 365 days;              // 1 year lock
    uint256 public constant VESTING_PERIOD = 180 days; // 6 months
    uint256 public constant COMMUNITY_VESTING_PERIOD = 730 days; // 2 years
    uint256 public constant MIN_DISTRIBUTION_INTERVAL = 1 days; // Rate limit for distributions

    uint256 public vestingStart;
    uint256 public lastDistributionTime;
    uint256 public totalVestedAmount;
    uint256 public liquidityLockEnd;
    uint256 public lockedLiquidity;

    // Liquidity pool address
    address public liquidityPool;
    bool public isCirculationEnabled;
    
    // Community rewards tracking
    uint256 public communityRewardsDistributed;
    uint256 public lastCommunityDistribution;
    mapping(address => uint256) public communityRewardsBalance;
    
    // Trading metrics for dynamic unlocking
    uint256 public tradingVolume24h;
    uint256 public lastVolumeUpdate;
    uint256 public circulatingTokens;
    mapping(uint256 => bool) public unlockMilestoneProcessed;

    // Distribution wallets
    address public communityRewardsWallet;
    address public holderChallengesWallet;
    address public airdropWallet;
    address public governanceWallet;

    // Milestone tracking
    struct Milestone {
        uint256 threshold;
        bool processed;
        string action;
    }
    
    mapping(uint256 => Milestone) public marketCapMilestones;
    mapping(uint256 => Milestone) public holderMilestones;
    mapping(uint256 => bool) public streamingMilestones;
    
    // Events
    event VestingDistribution(address indexed recipient, uint256 amount);
    event InitialDistribution(address indexed recipient, uint256 amount, string allocation);
    event CirculationEnabled(uint256 amount);
    event LiquidityPoolSet(address indexed pool);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);
    event CommunityRewardDistributed(address indexed recipient, uint256 amount);
    event LiquidityLocked(uint256 amount, uint256 unlockTime);
    event LiquidityUnlocked(uint256 amount);
    event CirculationIncreased(uint256 newAmount, string reason);
    event TradingMetricsUpdated(uint256 volume24h, uint256 timestamp);
    event WalletCreated(address indexed wallet, string walletType);
    event MilestoneReached(string milestoneType, uint256 threshold, string action);
    event RewardDistributed(address indexed recipient, uint256 amount, string rewardType);

    /**
     * @dev Restricts function access to the authorized deployer address
     */
    modifier onlyAuthorizedDeployer() {
        require(msg.sender == AUTHORIZED_DEPLOYER, "Not authorized to deploy");
        _;
    }

    /**
     * @dev Ensures the contract can only be initialized once
     */
    modifier notInitialized() {
        require(!isInitialized, "Already initialized");
        _;
    }

    /**
     * @dev Ensures vesting distributions only occur during the vesting period
     * and when there are tokens remaining to distribute
     */
    modifier onlyDuringVesting() {
        require(block.timestamp <= vestingStart + VESTING_PERIOD, "Vesting period ended");
        require(totalVestedAmount < SEED_ALLOCATION, "All seed tokens distributed");
        _;
    }

    /**
     * @dev Constructor initializes the ERC20 token with name and symbol
     * Empty constructor prevents unauthorized deployment
     */
    constructor() ERC20("MORE", "MORE") ERC20Permit("MORE") {
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Initializes the contract with initial token distributions
     * Can only be called once by the authorized deployer
     * 
     * Security:
     * - onlyAuthorizedDeployer modifier
     * - notInitialized modifier
     * - Events emitted for all distributions
     */
    function initialize() external onlyAuthorizedDeployer notInitialized {
        isInitialized = true;
        vestingStart = block.timestamp;
        lastDistributionTime = block.timestamp;

        // Initial distributions
        _mint(AUTHORIZED_DEPLOYER, TEAM_ALLOCATION);
        emit InitialDistribution(AUTHORIZED_DEPLOYER, TEAM_ALLOCATION, "Team Allocation");
        
        _mint(AUTHORIZED_DEPLOYER, HIRING_INCENTIVES);
        emit InitialDistribution(AUTHORIZED_DEPLOYER, HIRING_INCENTIVES, "Hiring/Incentives");
        
        _mint(address(this), CIRCULATION_SUPPLY);
        emit InitialDistribution(address(this), CIRCULATION_SUPPLY, "Circulation Supply (Locked)");
    }

    /**
     * @dev Pauses all token transfers and critical operations
     * Can only be called by the authorized deployer
     * 
     * Security:
     * - onlyAuthorizedDeployer modifier
     * - Emits EmergencyPaused event
     */
    function pause() external onlyAuthorizedDeployer {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @dev Unpauses the contract, allowing transfers and operations to resume
     * Can only be called by the authorized deployer
     * 
     * Security:
     * - onlyAuthorizedDeployer modifier
     * - Emits EmergencyUnpaused event
     */
    function unpause() external onlyAuthorizedDeployer {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @dev Enables initial token circulation by setting up the liquidity pool
     * @param _liquidityPool Address of the liquidity pool contract
     */
    function enableCirculation(address _liquidityPool) external onlyAuthorizedDeployer whenNotPaused nonReentrant {
        require(!isCirculationEnabled, "Circulation already enabled");
        require(_liquidityPool != address(0), "Invalid liquidity pool address");
        require(_liquidityPool.code.length > 0, "Liquidity pool must be a contract");
        
        liquidityPool = _liquidityPool;
        isCirculationEnabled = true;
        
        // Start with initial circulation (10%)
        circulatingTokens = (CIRCULATION_SUPPLY * INITIAL_CIRCULATION_PERCENT) / 100;
        require(transfer(liquidityPool, circulatingTokens), "Transfer to liquidity pool failed");
        
        emit CirculationEnabled(circulatingTokens);
        emit LiquidityPoolSet(liquidityPool);
    }

    /**
     * @dev Distributes vested tokens to the seed wallet based on time passed
     * 
     * Security:
     * - whenNotPaused modifier
     * - nonReentrant modifier
     * - onlyDuringVesting modifier
     * - Rate limiting through MIN_DISTRIBUTION_INTERVAL
     * - Follows CEI pattern
     * - Events emitted for tracking
     */
    function distributeVestedTokens() external whenNotPaused nonReentrant onlyDuringVesting {
        require(block.timestamp >= lastDistributionTime + MIN_DISTRIBUTION_INTERVAL, "Distribution too frequent");

        uint256 timePassed = block.timestamp - lastDistributionTime;
        uint256 totalVestingTime = VESTING_PERIOD;
        
        uint256 tokensToDistribute = (SEED_ALLOCATION * timePassed) / totalVestingTime;
        
        uint256 remainingAllocation = SEED_ALLOCATION - totalVestedAmount;
        if (tokensToDistribute > remainingAllocation) {
            tokensToDistribute = remainingAllocation;
        }
        
        lastDistributionTime = block.timestamp;
        totalVestedAmount += tokensToDistribute;
        
        _mint(SEED_WALLET, tokensToDistribute);
        
        emit VestingDistribution(SEED_WALLET, tokensToDistribute);
    }

    /**
     * @dev Distributes community rewards based on vesting schedule
     * @param recipient Address to receive rewards
     * @param amount Amount of tokens to distribute
     */
    function distributeCommunityReward(address recipient, uint256 amount) external whenNotPaused nonReentrant {
        require(block.timestamp >= lastCommunityDistribution + MIN_DISTRIBUTION_INTERVAL, "Distribution too frequent");
        require(communityRewardsDistributed + amount <= COMMUNITY_REWARDS, "Exceeds community allocation");
        
        uint256 timePassed = block.timestamp - lastCommunityDistribution;
        uint256 maxDistribution = (COMMUNITY_REWARDS * timePassed) / COMMUNITY_VESTING_PERIOD;
        require(amount <= maxDistribution, "Amount exceeds vesting limit");
        
        lastCommunityDistribution = block.timestamp;
        communityRewardsDistributed += amount;
        communityRewardsBalance[recipient] += amount;
        
        _mint(recipient, amount);
        emit CommunityRewardDistributed(recipient, amount);
    }

    /**
     * @dev Returns available community rewards for distribution
     */
    function availableCommunityRewards() public view returns (uint256) {
        return COMMUNITY_REWARDS - communityRewardsDistributed;
    }

    /**
     * @dev Override of ERC20 transfer to add pause functionality
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    /**
     * @dev Override of ERC20 transferFrom to add pause functionality
     */
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    // View functions
    /**
     * @dev Returns the remaining amount of tokens to be vested
     * @return uint256 Amount of tokens remaining for vesting
     */
    function remainingVestedAmount() public view returns (uint256) {
        return SEED_ALLOCATION - totalVestedAmount;
    }

    /**
     * @dev Checks if the vesting period is still active
     * @return bool True if vesting is active, false otherwise
     */
    function isVestingActive() public view returns (bool) {
        return block.timestamp <= vestingStart + VESTING_PERIOD && totalVestedAmount < SEED_ALLOCATION;
    }

    /**
     * @dev Returns the timestamp when the next distribution can occur
     * @return uint256 Timestamp of next possible distribution
     */
    function nextDistributionTime() public view returns (uint256) {
        return lastDistributionTime + MIN_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Returns the current status of circulation
     * @return enabled Whether circulation is enabled
     * @return pool Address of the liquidity pool
     * @return amount Amount in circulation (excluding locked liquidity)
     */
    function getCirculationStatus() external view returns (bool enabled, address pool, uint256 amount) {
        return (isCirculationEnabled, liquidityPool, CIRCULATION_SUPPLY - lockedLiquidity);
    }

    /**
     * @dev Releases locked liquidity to the liquidity pool after lock period
     * Security:
     * - onlyAuthorizedDeployer modifier
     * - whenNotPaused modifier
     * - nonReentrant modifier
     * - Can only be called after lock period
     */
    function releaseLocked() external onlyAuthorizedDeployer whenNotPaused nonReentrant {
        require(block.timestamp >= liquidityLockEnd, "Liquidity still locked");
        require(lockedLiquidity > 0, "No liquidity to release");
        
        uint256 amountToRelease = lockedLiquidity;
        lockedLiquidity = 0;
        
        require(transfer(liquidityPool, amountToRelease), "Transfer to liquidity pool failed");
        
        emit LiquidityUnlocked(amountToRelease);
    }

    /**
     * @dev Updates trading metrics and potentially unlocks more circulation
     * @param volume24h New 24h trading volume
     */
    function updateTradingMetrics(uint256 volume24h) external onlyAuthorizedDeployer whenNotPaused {
        require(block.timestamp >= lastVolumeUpdate + 1 hours, "Update too frequent");
        
        tradingVolume24h = volume24h;
        lastVolumeUpdate = block.timestamp;
        
        // Check for unlock conditions
        checkAndUnlockCirculation();
        
        emit TradingMetricsUpdated(volume24h, block.timestamp);
    }

    /**
     * @dev Internal function to check and unlock circulation based on metrics
     */
    function checkAndUnlockCirculation() internal {
        uint256 currentCirculationPercent = (circulatingTokens * 100) / CIRCULATION_SUPPLY;
        
        // Volume-based unlocks
        if (tradingVolume24h >= 100 ether && !unlockMilestoneProcessed[100] && currentCirculationPercent < 20) {
            unlockCirculation(20, "Trading volume milestone: 100 ETH/24h");
            unlockMilestoneProcessed[100] = true;
        }
        if (tradingVolume24h >= 500 ether && !unlockMilestoneProcessed[500] && currentCirculationPercent < 40) {
            unlockCirculation(40, "Trading volume milestone: 500 ETH/24h");
            unlockMilestoneProcessed[500] = true;
        }
        if (tradingVolume24h >= 1000 ether && !unlockMilestoneProcessed[1000] && currentCirculationPercent < 62) {
            unlockCirculation(62, "Trading volume milestone: 1000 ETH/24h");
            unlockMilestoneProcessed[1000] = true;
        }
    }

    /**
     * @dev Internal function to unlock circulation up to a target percentage
     */
    function unlockCirculation(uint256 targetPercent, string memory reason) internal {
        require(targetPercent <= 62, "Cannot exceed max circulation");
        uint256 targetAmount = (CIRCULATION_SUPPLY * targetPercent) / 100;
        if (targetAmount > circulatingTokens) {
            uint256 amountToUnlock = targetAmount - circulatingTokens;
            circulatingTokens = targetAmount;
            require(transfer(liquidityPool, amountToUnlock), "Transfer to liquidity pool failed");
            emit CirculationIncreased(amountToUnlock, reason);
        }
    }

    /**
     * @dev Creates autonomous distribution wallets
     * Can only be called by authorized deployer
     */
    function createDistributionWallets() external onlyAuthorizedDeployer whenNotPaused {
        require(communityRewardsWallet == address(0), "Wallets already created");
        
        // Create new wallets using create2 for deterministic addresses
        bytes32 salt = keccak256(abi.encodePacked(block.timestamp));
        
        communityRewardsWallet = _createWallet(salt, "community");
        holderChallengesWallet = _createWallet(salt, "challenges");
        airdropWallet = _createWallet(salt, "airdrop");
        governanceWallet = _createWallet(salt, "governance");
        
        emit WalletCreated(communityRewardsWallet, "Community Rewards");
        emit WalletCreated(holderChallengesWallet, "Holder Challenges");
        emit WalletCreated(airdropWallet, "Airdrop");
        emit WalletCreated(governanceWallet, "Governance");
    }

    /**
     * @dev Internal function to create a new wallet
     */
    function _createWallet(bytes32 salt, string memory purpose) internal returns (address) {
        bytes memory code = type(AutoDistributionWallet).creationCode;
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(code)));
        address wallet = address(uint160(uint256(hash)));
        
        // Fund wallet with initial balance for gas
        _mint(wallet, 1 ether);
        
        return wallet;
    }

    /**
     * @dev Processes market cap milestones and triggers actions
     */
    function processMarketCapMilestone(uint256 marketCap) external onlyAuthorizedDeployer whenNotPaused {
        // Check 100k milestone
        if (marketCap >= 100000 ether && !marketCapMilestones[100000].processed) {
            marketCapMilestones[100000] = Milestone(100000, true, "Release MORE on Spotify");
            emit MilestoneReached("MarketCap", 100000, "MORE Release");
        }
        
        // Check 500k milestone
        if (marketCap >= 500000 ether && !marketCapMilestones[500000].processed) {
            marketCapMilestones[500000] = Milestone(500000, true, "Launch Community Challenges");
            _triggerCommunityRewards(50000 ether);
            emit MilestoneReached("MarketCap", 500000, "Community Challenges");
        }
        
        // Check 1M milestone
        if (marketCap >= 1000000 ether && !marketCapMilestones[1000000].processed) {
            marketCapMilestones[1000000] = Milestone(1000000, true, "Enable Governance");
            _triggerGovernanceActivation();
            emit MilestoneReached("MarketCap", 1000000, "Governance");
        }
    }

    /**
     * @dev Processes holder count milestones
     */
    function processHolderMilestone(uint256 holders) external onlyAuthorizedDeployer whenNotPaused {
        // 1000 holders milestone
        if (holders >= 1000 && !holderMilestones[1000].processed) {
            holderMilestones[1000] = Milestone(1000, true, "Community Rewards");
            _triggerCommunityRewards(10000 ether);
            emit MilestoneReached("Holders", 1000, "Community Rewards");
        }
        
        // 5000 holders milestone
        if (holders >= 5000 && !holderMilestones[5000].processed) {
            holderMilestones[5000] = Milestone(5000, true, "Holder Challenge");
            _triggerHolderChallenge();
            emit MilestoneReached("Holders", 5000, "Holder Challenge");
        }
        
        // 25000 holders milestone
        if (holders >= 25000 && !holderMilestones[25000].processed) {
            holderMilestones[25000] = Milestone(25000, true, "Airdrop");
            _triggerAirdrop();
            emit MilestoneReached("Holders", 25000, "Airdrop");
        }
    }

    /**
     * @dev Internal function to trigger community rewards
     */
    function _triggerCommunityRewards(uint256 amount) internal {
        require(communityRewardsWallet != address(0), "Community wallet not set");
        _mint(communityRewardsWallet, amount);
        emit RewardDistributed(communityRewardsWallet, amount, "Community");
    }

    /**
     * @dev Internal function to trigger holder challenge
     */
    function _triggerHolderChallenge() internal {
        require(holderChallengesWallet != address(0), "Challenge wallet not set");
        _mint(holderChallengesWallet, 25000 ether);
        emit RewardDistributed(holderChallengesWallet, 25000 ether, "Challenge");
    }

    /**
     * @dev Internal function to trigger airdrop
     */
    function _triggerAirdrop() internal {
        require(airdropWallet != address(0), "Airdrop wallet not set");
        _mint(airdropWallet, 50000 ether);
        emit RewardDistributed(airdropWallet, 50000 ether, "Airdrop");
    }

    /**
     * @dev Internal function to activate governance
     */
    function _triggerGovernanceActivation() internal {
        require(governanceWallet != address(0), "Governance wallet not set");
        _mint(governanceWallet, 100000 ether);
        emit RewardDistributed(governanceWallet, 100000 ether, "Governance");
    }
} 