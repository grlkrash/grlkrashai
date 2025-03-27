// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GRLKRASHSupporterNFT.sol";

contract GRLKRASHContentNFT is ERC721Enumerable, Ownable {
    enum ContentType { MusicTrack, Artwork, Experience }
    
    struct ContentMetadata {
        ContentType contentType;
        uint8 accessLevel;
        string title;
        string description;
        string contentURI;
        string previewURI;
        bool isAIGenerated;
        uint256 createdAt;
        string[] tags;
    }

    // Pre-defined content storage
    mapping(uint256 => ContentMetadata) private _contentMetadata;
    uint256 private _nextTokenId = 1;
    
    // Reference to Supporter NFT for access control
    GRLKRASHSupporterNFT public supporterNFT;
    
    // Events
    event ContentCreated(uint256 indexed tokenId, ContentType contentType, bool isAIGenerated);
    event ContentUpdated(uint256 indexed tokenId, string newContentURI);
    
    constructor(address supporterNFTAddress) ERC721("GRLKRASH Memory", "MEMORY") {
        supporterNFT = GRLKRASHSupporterNFT(supporterNFTAddress);
        
        // Initialize with some pre-defined content
        _initializePreDefinedContent();
    }
    
    function _createTagArray(string[] memory commonTags, string[] memory additionalTags) private pure returns (string[] memory) {
        string[] memory result = new string[](commonTags.length + additionalTags.length);
        
        for(uint i = 0; i < commonTags.length; i++) {
            result[i] = commonTags[i];
        }
        
        for(uint i = 0; i < additionalTags.length; i++) {
            result[commonTags.length + i] = additionalTags[i];
        }
        
        return result;
    }
    
    function _initializePreDefinedContent() private {
        // Common tags for all content
        string[] memory commonTags = new string[](3);
        commonTags[0] = "KRASH WORLD";
        commonTags[1] = "GRLKRASH";
        commonTags[2] = "GRLKRASHai";

        // Additional tags for different content types
        string[] memory rideOrDieMusicTags = new string[](3);
        rideOrDieMusicTags[0] = "RIDE OR DIE";
        rideOrDieMusicTags[1] = "BASIC";
        rideOrDieMusicTags[2] = "MUSIC";

        string[] memory rideOrDieAnimTags = new string[](3);
        rideOrDieAnimTags[0] = "RIDE OR DIE";
        rideOrDieAnimTags[1] = "BASIC";
        rideOrDieAnimTags[2] = "ANIMATION";

        string[] memory psilocybinTags = new string[](2);
        psilocybinTags[0] = "PSILOCYBIN";
        psilocybinTags[1] = "BASIC";

        string[] memory psilocybinPremiumTags = new string[](3);
        psilocybinPremiumTags[0] = "PSILOCYBIN";
        psilocybinPremiumTags[1] = "PREMIUM";
        psilocybinPremiumTags[2] = "ANIMATION";

        string[] memory moreTags = new string[](3);
        moreTags[0] = "MORE";
        moreTags[1] = "ELITE";
        moreTags[2] = "ANIMATION";

        string[] memory coverArtTags = new string[](4);
        coverArtTags[0] = "RIDE OR DIE";
        coverArtTags[1] = "PREMIUM";
        coverArtTags[2] = "ANIMATION";
        coverArtTags[3] = "COVER ART";

        // RIDE OR DIE Collection - Basic Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.MusicTrack,
            accessLevel: 1,
            title: "RIDE OR DIE",
            description: "Originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram.",
            contentURI: "ipfs://QmRideOrDie",
            previewURI: "ipfs://QmRideOrDiePreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, rideOrDieMusicTags)
        });

        // RIDE OR DIE Animation Stills - Basic Access
        for (uint i = 1; i <= 5; i++) {
            _contentMetadata[_nextTokenId++] = ContentMetadata({
                contentType: ContentType.Artwork,
                accessLevel: 1,
                title: string.concat("RIDE OR DIE ANIMATION (STILL ", Strings.toString(i), ")"),
                description: "The record was originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram",
                contentURI: string.concat("ipfs://QmRideOrDieStill", Strings.toString(i)),
                previewURI: string.concat("ipfs://QmRideOrDieStillPreview", Strings.toString(i)),
                isAIGenerated: false,
                createdAt: block.timestamp,
                tags: _createTagArray(commonTags, rideOrDieAnimTags)
            });
        }

        // PSILOCYBIN - Basic Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.MusicTrack,
            accessLevel: 1,
            title: "PSILOCYBIN",
            description: "Originally released in May 2023, distortion, & high-pitched vocals create a surreal atmosphere, perfect for a glittery rave in this track by GRLKRASH. Pure hyperpop.",
            contentURI: "ipfs://QmPsilocybin",
            previewURI: "ipfs://QmPsilocybinPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, psilocybinTags)
        });

        // PSILOCYBIN REMIX - Basic Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.MusicTrack,
            accessLevel: 1,
            title: "PSILOCYBIN (REMIX)",
            description: "Set for release in Feb 2025, GRLKRASH brings natural sounding vocals and brand new production by Divus P for this track. Enjoy this refreshing, energetic remix.",
            contentURI: "ipfs://QmPsilocybinRemix",
            previewURI: "ipfs://QmPsilocybinRemixPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // Premium Content
        // PSILOCYBIN Animation Series - Premium Access
        for (uint i = 1; i <= 3; i++) {
            _contentMetadata[_nextTokenId++] = ContentMetadata({
                contentType: ContentType.Experience,
                accessLevel: 2,
                title: string.concat("PSILOCYBIN ANIMATION PART ", Strings.toString(i)),
                description: "Originally released in May 2023, distortion, & high-pitched vocals create a surreal atmosphere, perfect for a glittery rave in this track by GRLKRASH. Pure hyperpop. The single premiered with this animation.",
                contentURI: string.concat("ipfs://QmPsilocybinAnim", Strings.toString(i)),
                previewURI: string.concat("ipfs://QmPsilocybinAnimPreview", Strings.toString(i)),
                isAIGenerated: false,
                createdAt: block.timestamp,
                tags: _createTagArray(commonTags, psilocybinPremiumTags)
            });
        }

        // PSILOCYBIN Bonus Content - Premium Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Experience,
            accessLevel: 2,
            title: "PSILOCYBIN ANIMATION BONUS SCENE",
            description: "Originally released in May 2023, distortion, & high-pitched vocals create a surreal atmosphere, perfect for a glittery rave in this track by GRLKRASH. Pure hyperpop. Enjoy this bonus scene from the original animation by Young Platinum.",
            contentURI: "ipfs://QmPsilocybinBonus",
            previewURI: "ipfs://QmPsilocybinBonusPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // MORE Snippet - Elite Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.MusicTrack,
            accessLevel: 3,
            title: "MORE (SNIPPET)",
            description: "Set for release in 2025, this single is an anthem. THE anthem. If you put more in, you will get more out. This one's so crucial its at the center of the KRASH WORLD ecosystem. Put more in, get more out. A symbol of reaping what you sow.",
            contentURI: "ipfs://QmMoreSnippet",
            previewURI: "ipfs://QmMoreSnippetPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, moreTags)
        });

        // Elite Content
        // RIDE OR DIE FULL ANIMATION - Elite Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Experience,
            accessLevel: 3,
            title: "RIDE OR DIE ANIMATION (FULL)",
            description: "Originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram. The animation went on to be seen by hundreds of thousands of people.",
            contentURI: "ipfs://QmRideOrDieFullAnim",
            previewURI: "ipfs://QmRideOrDieFullAnimPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // MORE Full Animation Series - Elite Access
        for (uint i = 1; i <= 8; i++) {
            _contentMetadata[_nextTokenId++] = ContentMetadata({
                contentType: ContentType.Experience,
                accessLevel: 3,
                title: string.concat("MORE ANIMATION PART ", Strings.toString(i)),
                description: "Set for release in 2025, this single is an anthem. THE anthem. If you put more in, you will get more out. This one's so crucial its at the center of the KRASH WORLD ecosystem. Put more in, get more out. A symbol of reaping what you sow. This one also happens to be our longest original animation that we've ever produced to date.",
                contentURI: string.concat("ipfs://QmMoreAnim", Strings.toString(i)),
                previewURI: string.concat("ipfs://QmMoreAnimPreview", Strings.toString(i)),
                isAIGenerated: false,
                createdAt: block.timestamp,
                tags: _createTagArray(commonTags, new string[](0))
            });
        }

        // Instrumentals - Elite Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.MusicTrack,
            accessLevel: 3,
            title: "PSILOCYBIN (INSTRUMENTAL)",
            description: "Originally released in May 2023, distortion, & high-pitched vocals create a surreal atmosphere, perfect for a glittery rave in this track by GRLKRASH. Pure hyperpop. This is the instrumental from the single produced by GRLKRASH.",
            contentURI: "ipfs://QmPsilocybinInst",
            previewURI: "ipfs://QmPsilocybinInstPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.MusicTrack,
            accessLevel: 3,
            title: "MORE (INSTRUMENTAL)",
            description: "Set for release in 2025, this single is an anthem. THE anthem. If you put more in, you will get more out. This one's so crucial its at the center of the KRASH WORLD ecosystem. Put more in, get more out. A symbol of reaping what you sow. This is the instrumental from the single produced by GRLKRASH.",
            contentURI: "ipfs://QmMoreInst",
            previewURI: "ipfs://QmMoreInstPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // RIDE OR DIE Storyboards & Modeling - Elite Access
        string[2] memory storyboardTitles = ["RIDE OR DIE ANIMATION (STORYBOARD 1)", "RIDE OR DIE ANIMATION (STORYBOARD 2)"];
        for (uint i = 0; i < 2; i++) {
            _contentMetadata[_nextTokenId++] = ContentMetadata({
                contentType: ContentType.Artwork,
                accessLevel: 3,
                title: storyboardTitles[i],
                description: "The record was originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram. The animation went on to be seen by hundreds of thousands of people. This is the original storyboard for the animation that was created months prior to the song release.",
                contentURI: string.concat("ipfs://QmRideOrDieStoryboard", Strings.toString(i + 1)),
                previewURI: string.concat("ipfs://QmRideOrDieStoryboardPreview", Strings.toString(i + 1)),
                isAIGenerated: false,
                createdAt: block.timestamp,
                tags: _createTagArray(commonTags, new string[](0))
            });
        }

        // RIDE OR DIE Modeling - Elite Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Artwork,
            accessLevel: 3,
            title: "RIDE OR DIE (MODELING)",
            description: "The record was originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram. The animation went on to be seen by hundreds of thousands of people. This is a screen grab of a new GRLKRASH model based on previous models. This model of GRLKRASH would go on to be used in hundreds of future animations and social content reaching millions of people.",
            contentURI: "ipfs://QmRideOrDieModeling",
            previewURI: "ipfs://QmRideOrDieModelingPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // Cover Art - Premium & Elite Access
        // RIDE OR DIE Cover Art - Premium Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Artwork,
            accessLevel: 2,
            title: "RIDE OR DIE (COVER ART)",
            description: "The record was originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram. This version of the cover art is an edit by Leo Pastel.",
            contentURI: "ipfs://QmRideOrDieCover",
            previewURI: "ipfs://QmRideOrDieCoverPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, coverArtTags)
        });

        // RIDE OR DIE Alt Cover Art - Elite Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Artwork,
            accessLevel: 3,
            title: "RIDE OR DIE (ALT-COVER ART)",
            description: "The record was originally released in February 2023, GRLKRASH broke a personal record with this...record. After its release single quickly crossed 10K streams and marked the first launch of KRASH WORLD. It premiered with an original animation created by Young Platinum and its original rollout featured an interactive, gamified choose your own adventure experience on Instagram. This version if the cover art is an edit by Leo Pastel.",
            contentURI: "ipfs://QmRideOrDieAltCover",
            previewURI: "ipfs://QmRideOrDieAltCoverPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // PSILOCYBIN Cover Art - Premium Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Artwork,
            accessLevel: 2,
            title: "PSILOCYBIN (COVER ART)",
            description: "Originally released in May 2023, distortion, & high-pitched vocals create a surreal atmosphere, perfect for a glittery rave in this track by GRLKRASH. Pure hyperpop. The cover art features a still from the original animation that premiered with the single.",
            contentURI: "ipfs://QmPsilocybinCover",
            previewURI: "ipfs://QmPsilocybinCoverPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // PSILOCYBIN Alt Cover Art - Premium Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Artwork,
            accessLevel: 2,
            title: "PSILOCYBIN (ALT-COVER ART)",
            description: "Originally released in May 2023, distortion, & high-pitched vocals create a surreal atmosphere, perfect for a glittery rave in this track by GRLKRASH. Pure hyperpop. The cover art features a still from the original animation that premiered with the single.",
            contentURI: "ipfs://QmPsilocybinAltCover",
            previewURI: "ipfs://QmPsilocybinAltCoverPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });

        // KRASH WORLD BIRD - Elite Access
        _contentMetadata[_nextTokenId++] = ContentMetadata({
            contentType: ContentType.Artwork,
            accessLevel: 3,
            title: "KRASH WORLD BIRD (STILL)",
            description: "A bird hanging out.",
            contentURI: "ipfs://QmKrashWorldBird",
            previewURI: "ipfs://QmKrashWorldBirdPreview",
            isAIGenerated: false,
            createdAt: block.timestamp,
            tags: _createTagArray(commonTags, new string[](0))
        });
    }
    
    function createAIContent(
        string memory title,
        string memory description,
        ContentType contentType,
        uint8 accessLevel,
        string memory contentURI,
        string memory previewURI,
        string[] memory tags
    ) external onlyOwner returns (uint256) {
        uint256 newTokenId = _nextTokenId++;
        
        _contentMetadata[newTokenId] = ContentMetadata({
            contentType: contentType,
            accessLevel: accessLevel,
            title: title,
            description: description,
            contentURI: contentURI,
            previewURI: previewURI,
            isAIGenerated: true,
            createdAt: block.timestamp,
            tags: tags
        });
        
        _mint(msg.sender, newTokenId);
        emit ContentCreated(newTokenId, contentType, true);
        return newTokenId;
    }
    
    function getContentMetadata(uint256 tokenId) public view returns (
        ContentType contentType,
        uint8 accessLevel,
        string memory title,
        string memory description,
        string memory contentURI,
        string memory previewURI,
        bool isAIGenerated,
        uint256 createdAt,
        string[] memory tags
    ) {
        require(_exists(tokenId), "Content does not exist");
        ContentMetadata storage metadata = _contentMetadata[tokenId];
        return (
            metadata.contentType,
            metadata.accessLevel,
            metadata.title,
            metadata.description,
            metadata.contentURI,
            metadata.previewURI,
            metadata.isAIGenerated,
            metadata.createdAt,
            metadata.tags
        );
    }
    
    function updateContentURI(uint256 tokenId, string memory newContentURI) external onlyOwner {
        require(_exists(tokenId), "Content does not exist");
        _contentMetadata[tokenId].contentURI = newContentURI;
        emit ContentUpdated(tokenId, newContentURI);
    }
    
    function getContentURI(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Content does not exist");
        
        // Check if user has required access level
        address user = msg.sender;
        uint8 userLevel = uint8(supporterNFT.accessLevels(supporterNFT.tokenOfOwnerByIndex(user, 0)));
        require(userLevel >= _contentMetadata[tokenId].accessLevel, "Insufficient access level");
        
        return _contentMetadata[tokenId].contentURI;
    }
    
    function getPreviewURI(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Content does not exist");
        return _contentMetadata[tokenId].previewURI;
    }
} 