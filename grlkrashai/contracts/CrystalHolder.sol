// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./interfaces/IERC6551Account.sol";
import "./interfaces/IERC6551Registry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IMemoryCrystal.sol";

contract CrystalHolder is ERC721, Ownable {
    // Registry contract for ERC-6551
    IERC6551Registry public immutable registry;
    
    // Implementation contract address for token bound accounts
    address public immutable implementation;
    
    // Memory Crystal contract address
    address public immutable memoryCrystalContract;
    
    // Mapping from holder ID to array of crystal IDs
    mapping(uint256 => uint256[]) public boundCrystals;
    
    // Mapping from user address to holder ID
    mapping(address => uint256) public userHolders;
    
    // Counter for holder IDs
    uint256 private _nextHolderId;
    
    // Events
    event CrystalBound(uint256 indexed holderId, uint256 indexed crystalId);
    event CrystalUnbound(uint256 indexed holderId, uint256 indexed crystalId);
    event MediaPlayed(uint256 indexed holderId, uint256 indexed crystalId, string mediaURI);
    
    constructor(
        address registryAddress,
        address implementationAddress,
        address memoryCrystalAddress
    ) ERC721("Crystal Holder", "HOLD") {
        registry = IERC6551Registry(registryAddress);
        implementation = implementationAddress;
        memoryCrystalContract = memoryCrystalAddress;
        _transferOwnership(msg.sender);
    }
    
    // Get or create holder for user
    function getOrCreateHolder() public returns (uint256) {
        uint256 holderId = userHolders[msg.sender];
        
        // If user doesn't have a holder, create one
        if (holderId == 0) {
            holderId = _nextHolderId++;
            _mint(msg.sender, holderId);
            
            // Create token bound account
            registry.createAccount(
                implementation,
                block.chainid,
                address(this),
                holderId,
                0,
                ""
            );
            
            userHolders[msg.sender] = holderId;
        }
        
        return holderId;
    }
    
    // Bind crystal to holder
    function bindCrystal(uint256 crystalId) external {
        require(
            IERC721(memoryCrystalContract).ownerOf(crystalId) == msg.sender,
            "Must own crystal"
        );
        
        uint256 holderId = getOrCreateHolder();
        boundCrystals[holderId].push(crystalId);
        emit CrystalBound(holderId, crystalId);
    }
    
    // Unbind crystal from holder
    function unbindCrystal(uint256 crystalId) external {
        uint256 holderId = userHolders[msg.sender];
        require(holderId != 0, "No holder found");
        
        uint256[] storage crystals = boundCrystals[holderId];
        for (uint i = 0; i < crystals.length; i++) {
            if (crystals[i] == crystalId) {
                // Move last element to current position and pop
                crystals[i] = crystals[crystals.length - 1];
                crystals.pop();
                emit CrystalUnbound(holderId, crystalId);
                return;
            }
        }
        revert("Crystal not found in holder");
    }
    
    // Play media from bound crystal
    function playMedia(uint256 holderId, uint256 crystalId) external view returns (string memory) {
        require(_exists(holderId), "Holder does not exist");
        require(ownerOf(holderId) == msg.sender, "Not holder owner");
        
        bool crystalFound = false;
        uint256[] memory crystals = boundCrystals[holderId];
        for (uint i = 0; i < crystals.length; i++) {
            if (crystals[i] == crystalId) {
                crystalFound = true;
                break;
            }
        }
        require(crystalFound, "Crystal not found in holder");
        
        // Get media URI from Memory Crystal contract
        string memory mediaURI = IMemoryCrystal(memoryCrystalContract).getMediaURI(crystalId);
        return mediaURI;
    }
    
    // Get all bound crystals for a holder
    function getBoundCrystals(uint256 holderId) external view returns (uint256[] memory) {
        require(_exists(holderId), "Holder does not exist");
        return boundCrystals[holderId];
    }
    
    // Get holder ID for user
    function getHolderId(address user) external view returns (uint256) {
        return userHolders[user];
    }
    
    // Get token bound account address for a holder
    function getAccount(uint256 holderId) public view returns (address) {
        require(_exists(holderId), "Holder does not exist");
        return registry.account(
            implementation,
            block.chainid,
            address(this),
            holderId,
            0
        );
    }
    
    // Execute a call through the token bound account
    function executeCall(
        uint256 holderId,
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory) {
        require(ownerOf(holderId) == msg.sender, "Not holder owner");
        
        address account = getAccount(holderId);
        return IERC6551Account(account).execute(to, value, data, 0);
    }
} 