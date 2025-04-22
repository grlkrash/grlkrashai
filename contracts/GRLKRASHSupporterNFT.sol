// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract GRLKRASHSupporterNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Constants
    uint256 public constant REQUIRED_MORE_TOKENS = 1000 * 10**18; // 1,000 MORE tokens
    uint256 public constant MAX_SUPPLY = 10000;

    // State variables
    address public immutable moreToken;
    string private _baseTokenURI;

    // Access level mapping (1: Basic, 2: Premium, 3: Elite)
    mapping(uint256 => uint8) public accessLevels;

    // Events
    event SupporterNFTMinted(uint256 indexed tokenId, address indexed owner, uint8 accessLevel);
    event AccessLevelUpdated(uint256 indexed tokenId, uint8 newLevel);

    constructor(address _moreToken, string memory baseURI) 
        ERC721("GRLKRASH Supporter", "GRLS") 
        Ownable()
    {
        require(_moreToken != address(0), "Invalid MORE token address");
        moreToken = _moreToken;
        _baseTokenURI = baseURI;
    }

    function mintSupporterNFT(uint8 accessLevel) external returns (uint256) {
        require(accessLevel >= 1 && accessLevel <= 3, "Invalid access level");
        require(_tokenIds.current() < MAX_SUPPLY, "Max supply reached");

        // Check MORE token balance
        uint256 moreBalance = IERC20(moreToken).balanceOf(msg.sender);
        require(moreBalance >= REQUIRED_MORE_TOKENS, "Insufficient MORE tokens");

        // Lock MORE tokens
        require(
            IERC20(moreToken).transferFrom(msg.sender, address(this), REQUIRED_MORE_TOKENS),
            "Token transfer failed"
        );

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);
        accessLevels[newTokenId] = accessLevel;

        emit SupporterNFTMinted(newTokenId, msg.sender, accessLevel);
        return newTokenId;
    }

    function updateAccessLevel(uint256 tokenId, uint8 newLevel) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        require(newLevel >= 1 && newLevel <= 3, "Invalid access level");

        accessLevels[tokenId] = newLevel;
        emit AccessLevelUpdated(tokenId, newLevel);
    }

    function getAccessLevel(address user) external view returns (uint8) {
        uint256 balance = balanceOf(user);
        if (balance == 0) return 0;

        uint8 highestLevel = 0;
        for (uint256 i = 1; i <= _tokenIds.current(); i++) {
            if (_exists(i) && ownerOf(i) == user) {
                uint8 level = accessLevels[i];
                if (level > highestLevel) {
                    highestLevel = level;
                }
            }
        }
        return highestLevel;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    // Required overrides
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 