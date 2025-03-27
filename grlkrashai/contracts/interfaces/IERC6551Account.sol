// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC6551Account {
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 operation
    ) external payable returns (bytes memory);

    function token()
        external
        view
        returns (
            uint256 chainId,
            address tokenContract,
            uint256 tokenId
        );

    function owner() external view returns (address);
    
    function nonce() external view returns (uint256);
} 