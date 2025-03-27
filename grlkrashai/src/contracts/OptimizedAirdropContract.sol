// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract OptimizedAirdropContract is Ownable, ReentrancyGuard, Pausable {
    IERC20 public token;
    bytes32 public merkleRoot;
    uint256 public expiryTime;
    
    mapping(address => bool) public claimed;
    mapping(address => uint256) public claimAmounts;
    
    event AirdropClaimed(address indexed recipient, uint256 amount);
    event MerkleRootUpdated(bytes32 newRoot, uint256 expiryTime);
    event BatchAirdropProcessed(uint256 recipientCount, uint256 totalAmount);
    
    constructor(address _token) {
        token = IERC20(_token);
    }
    
    function updateMerkleRoot(bytes32 _merkleRoot, uint256 _expiryTime) 
        external 
        onlyOwner 
    {
        require(_expiryTime > block.timestamp, "Invalid expiry time");
        merkleRoot = _merkleRoot;
        expiryTime = _expiryTime;
        emit MerkleRootUpdated(_merkleRoot, _expiryTime);
    }
    
    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) 
        external
        nonReentrant
        whenNotPaused 
    {
        require(!claimed[msg.sender], "Already claimed");
        require(block.timestamp <= expiryTime, "Airdrop expired");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, leaf),
            "Invalid proof"
        );
        
        claimed[msg.sender] = true;
        claimAmounts[msg.sender] = amount;
        
        require(
            token.transfer(msg.sender, amount),
            "Transfer failed"
        );
        
        emit AirdropClaimed(msg.sender, amount);
    }
    
    function processBatchAirdrop(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(
            recipients.length == amounts.length,
            "Length mismatch"
        );
        
        uint256 totalAmount = 0;
        
        for(uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");
            
            claimed[recipients[i]] = true;
            claimAmounts[recipients[i]] = amounts[i];
            totalAmount += amounts[i];
            
            require(
                token.transfer(recipients[i], amounts[i]),
                "Transfer failed"
            );
        }
        
        emit BatchAirdropProcessed(recipients.length, totalAmount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawUnclaimedTokens() 
        external 
        onlyOwner 
    {
        require(
            block.timestamp > expiryTime,
            "Airdrop not expired"
        );
        
        uint256 balance = token.balanceOf(address(this));
        require(
            token.transfer(owner(), balance),
            "Transfer failed"
        );
    }
    
    function getAirdropStatus(address recipient) 
        external 
        view 
        returns (
            bool hasClaimed,
            uint256 amount
        ) 
    {
        return (
            claimed[recipient],
            claimAmounts[recipient]
        );
    }
} 