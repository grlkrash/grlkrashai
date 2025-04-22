// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AutoDistributionWallet
 * @dev Handles autonomous distribution of tokens based on milestones
 */
contract AutoDistributionWallet is Ownable, ReentrancyGuard {
    IERC20 public moreToken;
    
    event Distribution(address[] recipients, uint256[] amounts);
    event EmergencyWithdraw(address token, uint256 amount);
    
    constructor() {
        _transferOwnership(msg.sender);
    }
    
    /**
     * @dev Initializes the wallet with the MORE token address
     */
    function initialize(address _moreToken) external onlyOwner {
        require(_moreToken != address(0), "Invalid token address");
        moreToken = IERC20(_moreToken);
    }
    
    /**
     * @dev Distributes tokens to multiple recipients
     */
    function distributeTokens(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty distribution");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(moreToken.balanceOf(address(this)) >= totalAmount, "Insufficient balance");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(moreToken.transfer(recipients[i], amounts[i]), "Transfer failed");
        }
        
        emit Distribution(recipients, amounts);
    }
    
    /**
     * @dev Emergency withdrawal in case of issues
     */
    function emergencyWithdraw(address token) external onlyOwner nonReentrant {
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        require(tokenContract.transfer(owner(), balance), "Withdrawal failed");
        
        emit EmergencyWithdraw(token, balance);
    }
} 