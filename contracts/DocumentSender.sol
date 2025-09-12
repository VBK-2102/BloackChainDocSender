// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Document Sender & Verifier
/// @notice Stores a tamper-proof reference (hash) of a document with sender/recipient metadata.
contract DocumentSender {
    event DocumentSent(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        bytes32 hash,
        string uri,
        uint256 timestamp
    );

    struct Doc {
        address sender;
        address recipient;
        bytes32 hash;    // SHA-256 of the original file (computed off-chain)
        string uri;      // Optional: IPFS CID or HTTPS URL to the file
        uint256 timestamp;
    }

    Doc[] private docs;

    /// @notice Send a document reference (hash) to a specific recipient.
    /// @param recipient Address that this document is intended for.
    /// @param hash SHA-256 hash of the file (32 bytes). Compute in frontend and pass as bytes32.
    /// @param uri Optional link (e.g., IPFS CID) to the off-chain file.
    function sendDocument(address recipient, bytes32 hash, string calldata uri) external {
        require(recipient != address(0), "recipient required");
        require(hash != bytes32(0), "hash required");
        docs.push(Doc({
            sender: msg.sender,
            recipient: recipient,
            hash: hash,
            uri: uri,
            timestamp: block.timestamp
        }));
        uint256 id = docs.length - 1;
        emit DocumentSent(id, msg.sender, recipient, hash, uri, block.timestamp);
    }

    /// @notice Get metadata for a given document id.
    function getDoc(uint256 id) external view returns (Doc memory) {
        require(id < docs.length, "invalid id");
        return docs[id];
    }

    /// @notice Number of documents recorded (for indexing if you want).
    function totalDocs() external view returns (uint256) {
        return docs.length;
    }
}
