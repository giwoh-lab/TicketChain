// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TicketNFT
 * @dev ERC-721 token representing a concert ticket.
 *      Each tokenId corresponds to a unique ticket.
 */
import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TicketNFT is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;

    constructor() ERC721("ConcertTicket", "CTIX") Ownable(msg.sender) {}

    /**
     * @dev Mint a new ticket to `to` with a token URI that points to metadata.
     */
    function mint(address to, string memory tokenURI) external onlyOwner returns (uint256) {
        uint256 tokenId = ++nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return tokenId;
    }
}
