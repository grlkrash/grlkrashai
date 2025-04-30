// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MemoryCrystal is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    enum AccessLevel { BASIC, PREMIUM, ELITE }

    struct Crystal {
        AccessLevel accessLevel;
        string contentURI;
        uint256 mintTimestamp;
        bool locked;
    }

    mapping(uint256 => Crystal) public crystals;
    
    // Minting costs for each access level (in wei)
    uint256 public basicMintCost = 0.01 ether;
    uint256 public premiumMintCost = 0.05 ether;
    uint256 public eliteMintCost = 0.1 ether;

    // Maximum supply for each access level
    uint256 public constant MAX_BASIC_SUPPLY = 1000;
    uint256 public constant MAX_PREMIUM_SUPPLY = 500;
    uint256 public constant MAX_ELITE_SUPPLY = 100;
    uint256 public constant MAX_MINTS_PER_ADDRESS = 50;

    // Track minted amounts for each access level
    uint256 public basicMinted;
    uint256 public premiumMinted;
    uint256 public eliteMinted;

    // Events
    event CrystalForged(uint256 indexed tokenId, address indexed owner, AccessLevel accessLevel);
    event ContentURIUpdated(uint256 indexed tokenId, string newContentURI);
    event Withdrawn(address indexed to, uint256 amount);
    event EmergencyShutdown(address indexed triggeredBy);

    uint256 private constant WITHDRAWAL_WAIT = 1 days;
    uint256 private lastWithdrawal;

    constructor() ERC721("Memory Crystal", "MCRYSTAL") {
        _transferOwnership(msg.sender);
        lastWithdrawal = block.timestamp;
    }

    function forgeCrystal(AccessLevel accessLevel) public payable nonReentrant whenNotPaused returns (uint256) {
        require(mintCounts[msg.sender] < MAX_MINTS_PER_ADDRESS, "Max mints reached");
        require(msg.value >= getMintCost(accessLevel), "Insufficient payment");
        require(canMintAccessLevel(accessLevel), "Supply exceeded");
        
        mintCounts[msg.sender]++;
        
        if (accessLevel == AccessLevel.BASIC) basicMinted++;
        else if (accessLevel == AccessLevel.PREMIUM) premiumMinted++;
        else eliteMinted++;
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _safeMint(msg.sender, newTokenId);
        
        crystals[newTokenId] = Crystal({
            accessLevel: accessLevel,
            contentURI: "",
            mintTimestamp: block.timestamp,
            locked: false
        });
        
        emit CrystalForged(newTokenId, msg.sender, accessLevel);
        return newTokenId;
    }

    function setContentURI(uint256 tokenId, string memory uri) public onlyOwner whenNotPaused {
        require(_exists(tokenId), "Token doesn't exist");
        require(!crystals[tokenId].locked, "Crystal locked");
        crystals[tokenId].contentURI = uri;
        crystals[tokenId].locked = true;
        emit ContentURIUpdated(tokenId, uri);
    }

    function getMintCost(AccessLevel accessLevel) public view returns (uint256) {
        if (accessLevel == AccessLevel.BASIC) return basicMintCost;
        if (accessLevel == AccessLevel.PREMIUM) return premiumMintCost;
        return eliteMintCost;
    }

    function canMintAccessLevel(AccessLevel accessLevel) public view returns (bool) {
        if (accessLevel == AccessLevel.BASIC) {
            return basicMinted < MAX_BASIC_SUPPLY;
        } else if (accessLevel == AccessLevel.PREMIUM) {
            return premiumMinted < MAX_PREMIUM_SUPPLY;
        } else {
            return eliteMinted < MAX_ELITE_SUPPLY;
        }
    }

    function updateMintCosts(
        uint256 newBasicCost,
        uint256 newPremiumCost,
        uint256 newEliteCost
    ) public onlyOwner {
        basicMintCost = newBasicCost;
        premiumMintCost = newPremiumCost;
        eliteMintCost = newEliteCost;
    }

    function withdraw() public onlyOwner nonReentrant {
        require(block.timestamp >= lastWithdrawal + WITHDRAWAL_WAIT, "Wait period not met");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        lastWithdrawal = block.timestamp;
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");
        emit Withdrawn(msg.sender, balance);
    }

    function pause() public onlyOwner {
        _pause();
        emit EmergencyShutdown(msg.sender);
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // Override required functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    // Allow contract to receive ETH
    receive() external payable {}
} 