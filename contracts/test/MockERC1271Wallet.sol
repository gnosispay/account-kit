// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title RealERC1271Wallet
 * @dev A real ERC1271 wallet that validates actual ECDSA signatures
 * This wallet validates signatures against its owner's address using ECDSA recovery
 */
contract RealERC1271Wallet {
    using ECDSA for bytes32;
    
    // ERC1271 magic value
    bytes4 constant internal MAGICVALUE = 0x1626ba7e;
    bytes4 constant internal INVALID_SIGNATURE = 0xffffffff;
    
    // Owner of this wallet
    address public owner;
    
    constructor(address _owner) {
        owner = _owner;
    }
    
    /**
     * @dev ERC1271 signature validation
     * @param _hash Hash of the data to be signed
     * @param _signature Signature byte array associated with _hash
     * @return magicValue 0x1626ba7e if valid, 0xffffffff if invalid
     */
    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) external view returns (bytes4 magicValue) {
        // Recover the signer address from the signature
        address recoveredSigner = _hash.recover(_signature);
        
        // Check if the recovered signer matches the owner
        if (recoveredSigner == owner) {
            return MAGICVALUE;
        }
        
        return INVALID_SIGNATURE;
    }
    
    /**
     * @dev Allow the owner to be changed for testing
     */
    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "Only owner can change owner");
        owner = newOwner;
    }
}
