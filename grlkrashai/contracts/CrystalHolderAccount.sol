// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "./interfaces/IERC6551Account.sol";
import "./interfaces/IERC6551Executable.sol";

contract CrystalHolderAccount is IERC165, IERC1271, IERC6551Account, IERC6551Executable {
    uint256 public nonce;

    receive() external payable {}

    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 operation
    ) external payable virtual override(IERC6551Account, IERC6551Executable) returns (bytes memory) {
        require(msg.sender == owner(), "Not token owner");
        require(operation == 0, "Only call operations are supported");
        
        bool success;
        bytes memory result;
        (success, result) = to.call{value: value}(data);
        
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        
        return result;
    }

    function token()
        external
        view
        returns (
            uint256 chainId,
            address tokenContract,
            uint256 tokenId
        )
    {
        uint256 length = address(this).code.length;
        if (length == 0) {
            return (0, address(0), 0);
        }

        return _token();
    }

    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = _token();
        if (chainId != block.chainid) {
            return address(0);
        }

        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function state() external view returns (uint256) {
        return nonce;
    }

    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        return signer == owner() ? type(IERC6551Account).interfaceId : bytes4(0);
    }

    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return (interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC6551Executable).interfaceId);
    }

    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4 magicValue)
    {
        bool isValid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);
        if (isValid) {
            return IERC1271.isValidSignature.selector;
        }

        return "";
    }

    function _token()
        internal
        view
        returns (
            uint256 chainId,
            address tokenContract,
            uint256 tokenId
        )
    {
        assembly {
            chainId := shr(96, shl(96, shr(96, address())))
            tokenContract := shr(96, shl(160, address()))
            tokenId := shr(160, shl(0, address()))
        }
    }
} 