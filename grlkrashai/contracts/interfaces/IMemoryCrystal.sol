// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMemoryCrystal {
    function getMediaURI(uint256 tokenId) external view returns (string memory);
} 