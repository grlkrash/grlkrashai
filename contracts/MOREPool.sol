// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUniswapV2Callee {
    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external;
}

contract MOREPool is ReentrancyGuard, Ownable, IUniswapV2Callee {
    using SafeERC20 for IERC20;

    IERC20 public immutable moreToken;
    IERC20 public immutable weth;
    address public constant FEE_RECIPIENT = 0xfDC66caea47B17933561619a2DD326632Eda7884;
    
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public constant TRADING_FEE = 3; // 0.3%
    uint256 public constant FEE_SHARE = 500; // 50% of trading fees go to FEE_RECIPIENT
    
    uint256 public moreReserve;
    uint256 public wethReserve;
    uint256 public totalLiquidity;
    uint256 public lockedLiquidity;
    
    mapping(address => uint256) public liquidityBalances;
    
    event LiquidityAdded(address indexed provider, uint256 moreAmount, uint256 wethAmount, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 moreAmount, uint256 wethAmount, uint256 liquidity);
    event Swap(address indexed user, uint256 moreIn, uint256 wethIn, uint256 moreOut, uint256 wethOut);
    event FeesDistributed(uint256 moreAmount, uint256 wethAmount);
    event LiquidityLocked(uint256 amount);
    event LiquidityUnlocked(uint256 amount);
    
    constructor(address _moreToken, address _weth) {
        require(_moreToken != address(0), "Invalid MORE token address");
        require(_weth != address(0), "Invalid WETH address");
        moreToken = IERC20(_moreToken);
        weth = IERC20(_weth);
    }
    
    /**
     * @dev Locks liquidity in the pool
     * @param amount Amount of liquidity to lock
     * Security:
     * - onlyOwner modifier
     * - nonReentrant modifier
     * - Validates amount
     */
    function lockLiquidity(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Invalid lock amount");
        require(totalLiquidity >= lockedLiquidity + amount, "Insufficient liquidity");
        
        lockedLiquidity += amount;
        emit LiquidityLocked(amount);
    }

    /**
     * @dev Unlocks liquidity in the pool
     * @param amount Amount of liquidity to unlock
     * Security:
     * - onlyOwner modifier
     * - nonReentrant modifier
     * - Validates amount
     */
    function unlockLiquidity(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Invalid unlock amount");
        require(lockedLiquidity >= amount, "Insufficient locked liquidity");
        
        lockedLiquidity -= amount;
        emit LiquidityUnlocked(amount);
    }

    /**
     * @dev Returns the current liquidity status
     * @return total Total liquidity in the pool
     * @return locked Amount of locked liquidity
     * @return available Available liquidity for removal
     */
    function getLiquidityStatus() external view returns (uint256 total, uint256 locked, uint256 available) {
        return (totalLiquidity, lockedLiquidity, totalLiquidity - lockedLiquidity);
    }

    /**
     * @dev Removes liquidity from the pool
     * @param liquidity Amount of liquidity to remove
     * Security:
     * - nonReentrant modifier
     * - Validates liquidity amount
     * - Checks available liquidity
     */
    function removeLiquidity(uint256 liquidity) external nonReentrant {
        require(liquidity > 0, "Invalid liquidity amount");
        require(liquidityBalances[msg.sender] >= liquidity, "Insufficient balance");
        require(totalLiquidity - lockedLiquidity >= liquidity, "Insufficient available liquidity");

        uint256 moreAmount = (liquidity * moreReserve) / totalLiquidity;
        uint256 wethAmount = (liquidity * wethReserve) / totalLiquidity;

        liquidityBalances[msg.sender] -= liquidity;
        totalLiquidity -= liquidity;
        moreReserve -= moreAmount;
        wethReserve -= wethAmount;

        moreToken.safeTransfer(msg.sender, moreAmount);
        weth.safeTransfer(msg.sender, wethAmount);

        emit LiquidityRemoved(msg.sender, moreAmount, wethAmount, liquidity);
    }

    function addLiquidity() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH");
        
        uint256 moreBalance = moreToken.balanceOf(address(this));
        uint256 ethBalance = address(this).balance - msg.value;
        
        uint256 moreAmount;
        if (totalLiquidity == 0) {
            moreAmount = 1000000 * 10**18; // Initial liquidity of 1M MORE tokens
            require(
                moreToken.transferFrom(msg.sender, address(this), moreAmount),
                "Transfer failed"
            );
            totalLiquidity = MINIMUM_LIQUIDITY;
            liquidityBalances[msg.sender] = MINIMUM_LIQUIDITY;
        } else {
            moreAmount = (msg.value * moreBalance) / ethBalance;
            require(
                moreToken.transferFrom(msg.sender, address(this), moreAmount),
                "Transfer failed"
            );
            uint256 liquidity = (msg.value * totalLiquidity) / ethBalance;
            totalLiquidity += liquidity;
            liquidityBalances[msg.sender] += liquidity;
        }
        
        emit LiquidityAdded(msg.sender, moreAmount, msg.value, liquidity);
    }
    
    function swap(uint256 moreAmountIn, uint256 ethAmountIn, uint256 moreAmountOut, uint256 ethAmountOut) external payable nonReentrant {
        require(moreAmountIn > 0 || ethAmountIn > 0, "Invalid input amount");
        require(moreAmountOut > 0 || ethAmountOut > 0, "Invalid output amount");
        
        // Transfer input tokens
        if (moreAmountIn > 0) {
            require(moreToken.transferFrom(msg.sender, address(this), moreAmountIn), "MORE transfer failed");
        }
        require(msg.value == ethAmountIn, "Invalid ETH amount");
        
        // Calculate and collect fees
        uint256 totalFee = ((moreAmountIn + ethAmountIn) * TRADING_FEE) / FEE_DENOMINATOR;
        uint256 feeShare = (totalFee * FEE_SHARE) / FEE_DENOMINATOR;
        
        // Transfer output tokens
        if (moreAmountOut > 0) {
            require(moreToken.transfer(msg.sender, moreAmountOut - feeShare), "MORE transfer failed");
        }
        if (ethAmountOut > 0) {
            (bool success, ) = msg.sender.call{value: ethAmountOut - feeShare}("");
            require(success, "ETH transfer failed");
        }
        
        emit Swap(msg.sender, moreAmountIn, ethAmountIn, moreAmountOut, ethAmountOut);
    }

    function distributeFees() external nonReentrant {
        uint256 feesToDistribute = (moreReserve * TRADING_FEE) / FEE_DENOMINATOR;
        require(feesToDistribute > 0, "No fees to distribute");
        
        moreReserve -= feesToDistribute;
        
        // Transfer fees to the recipient
        (bool success, ) = FEE_RECIPIENT.call{value: feesToDistribute}("");
        require(success, "Fee distribution failed");
        
        emit FeesDistributed(feesToDistribute, 0);
    }

    // DEX compatibility functions
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) {
        return (
            uint112(moreToken.balanceOf(address(this))),
            uint112(address(this).balance),
            uint32(block.timestamp)
        );
    }

    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external override {
        // Handle flash swaps if needed
        // This function makes the pool compatible with DEX aggregators
    }
    
    // Allow receiving ETH
    receive() external payable {}
} 