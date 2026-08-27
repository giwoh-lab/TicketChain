  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  /**
   * @title ConcertTicket
   * @dev A simple, educational ticket‑sale contract with:
   *      • Official sale window (opening/closing time)
   *      • Early‑purchase permission (RTB)
   *      • One ticket per wallet invariant
   *      • Secret‑key commitment / reveal for QR‑code generation
   *      • Basic admin and check‑in roles
   *      • Transfer, use, and lifecycle management
   *
   * The contract purposefully avoids ERC‑721, upgradeability, or any heavy framework.
   */
  contract ConcertTicket {
      /* --------------------------------------------------------------------- */
      /*                                   EVENTS                               */
      /* --------------------------------------------------------------------- */
      event TicketCreated(
          address indexed buyer,
          uint256 indexed ticketId,
          bytes32 commitment
      );
      event TicketTransferred(
          address indexed from,
          address indexed to,
          uint256 indexed ticketId
      );
      event TicketUsed(uint256 indexed ticketId);
      event RTBUpdated(address indexed account, bool available);
      event OpeningTimeChanged(uint256 newOpeningTime);
      event ClosingTimeChanged(uint256 newClosingTime);
      event CheckInOperatorChanged(address indexed newOperator);
      event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
  event TicketPriceChanged(uint256 newPrice);
  event MaxTicketsChanged(uint256 newMax);
  event TicketInvalidated(uint256 indexed ticketId);

      /* --------------------------------------------------------------------- */
      /*                                 ENUMS & STRUCTS                        */
      /* --------------------------------------------------------------------- */
      // Ticket lifecycle status. The most common state (Valid) is listed first.
      // The allowed transitions are:
      //   Valid -> Used   or   Valid -> Invalid
      // Used and Invalid are terminal states.
      enum Status {
          Valid,
          Invalid,
          Used
      }

      struct Ticket {
          address owner;          // current owner
          Status  currStatus;    // lifecycle state
          // No nonce is stored – the QR hash is deterministic without it for this MVP.
          // If a future version needs a per‑ticket counter, it can be added then.
          bytes32 commitment;    // keccak256(secretKey) – never the plaintext key
      }

      /* --------------------------------------------------------------------- */
      /*                              STATE VARIABLES                           */
      /* --------------------------------------------------------------------- */
      address public owner;                     // contract admin
      address public checkInOperator;           // authorized check‑in account

      uint256 public openingTime;                // official sale start (unix seconds)
      uint256 public closingTime;                // official sale end (unix seconds)

      uint256 public ticketPrice = 0.1 ether;    // default price – owner can change

      uint256 public nextTicketId = 1;           // starts at 1, 0 means “no ticket”
      // Maximum number of tickets that can ever be minted. Default is effectively unlimited.
      uint256 public maxTickets = type(uint256).max;

      // core mappings
      mapping(uint256 => Ticket) private tickets;        // ticketId => Ticket
      mapping(address => uint256) private ownerTicket;   // wallet => ticketId (0 = none)

      // RTB – simple binary flag per address
      mapping(address => bool) private hasRTB;

      /* --------------------------------------------------------------------- */
      /*                               MODIFIERS                                */
      /* --------------------------------------------------------------------- */
      modifier onlyOwner() {
          require(msg.sender == owner, "Only owner");
          _;
      }

      modifier onlyCheckIn() {
          require(msg.sender == checkInOperator, "Only check-in operator");
          _;
      }

      modifier saleOpen() {
          require(
              block.timestamp >= openingTime && block.timestamp < closingTime,
              "Official sale closed"
          );
          _;
      }

      modifier rtbAvailable() {
          require(hasRTB[msg.sender], "RTB not granted");
          _;
      }

      modifier noTicket() {
          require(ownerTicket[msg.sender] == 0, "Already owns ticket");
          _;
      }

      modifier ticketExists(uint256 ticketId) {
          require(ticketId != 0 && ticketId < nextTicketId, "Ticket does not exist");
          _;
      }

      modifier onlyTicketOwner(uint256 ticketId) {
          require(tickets[ticketId].owner == msg.sender, "Not ticket owner");
          _;
      }

      modifier onlyValidTicket(uint256 ticketId) {
          require(tickets[ticketId].currStatus == Status.Valid, "Ticket not valid");
          _;
      }

      /* --------------------------------------------------------------------- */
      /*                               CONSTRUCTOR                               */
      /* --------------------------------------------------------------------- */
      constructor() {
          owner = msg.sender;
          // By default the contract deployer is also the check‑in operator.
          // This prevents the contract from becoming unusable if the owner forgets
          // to call setCheckInOperator().
          checkInOperator = msg.sender;
          // default sale window – can be changed later
          openingTime = block.timestamp + 1 days;
          closingTime = openingTime + 7 days;
      }

      /* --------------------------------------------------------------------- */
      /*                          ADMINISTRATIVE FUNCTIONS                      */
      /* --------------------------------------------------------------------- */
      function transferOwnership(address newOwner) external onlyOwner {
          require(newOwner != address(0), "Zero address");
          emit OwnerTransferred(owner, newOwner);
          owner = newOwner;
      }

      function setCheckInOperator(address newOperator) external onlyOwner {
          require(newOperator != address(0), "Zero address");
          checkInOperator = newOperator;
          emit CheckInOperatorChanged(newOperator);
      }

      function setOpeningTime(uint256 newOpening) external onlyOwner {
          require(newOpening < closingTime, "Opening must be before closing");
          openingTime = newOpening;
          emit OpeningTimeChanged(newOpening);
      }

      function setClosingTime(uint256 newClosing) external onlyOwner {
          require(newClosing > openingTime, "Closing must be after opening");
          closingTime = newClosing;
          emit ClosingTimeChanged(newClosing);
      }

      function setTicketPrice(uint256 newPrice) external onlyOwner {
          ticketPrice = newPrice;
          emit TicketPriceChanged(newPrice);
      }

      /// @notice Owner can adjust the maximum number of tickets that may be minted.
      /// @dev The new limit cannot be lower than the number of tickets already issued.
      function setMaxTickets(uint256 newMax) external onlyOwner {
          require(newMax >= nextTicketId - 1, "new max below existing tickets");
          maxTickets = newMax;
          emit MaxTicketsChanged(newMax);
      }

      // ---- RTB management --------------------------------------------------
      function grantRTB(address account) external onlyOwner {
          require(account != address(0), "Zero address");
          hasRTB[account] = true;
          emit RTBUpdated(account, true);
      }

      function revokeRTB(address account) external onlyOwner {
          require(account != address(0), "Zero address");
          hasRTB[account] = false;
          emit RTBUpdated(account, false);
      }

      /* --------------------------------------------------------------------- */
      /*                             PURCHASE LOGIC                             */
      /* --------------------------------------------------------------------- */
      /**
       * @dev Internal purchase routine shared by official and RTB flows.
       * @param commitment keccak256(secretKey) supplied by the buyer.
       */
      function _purchaseTicket(bytes32 commitment) internal noTicket {
          require(msg.value == ticketPrice, "Incorrect ETH amount");
          // Enforce overall supply cap.
          require(nextTicketId <= maxTickets, "Sold out");

          uint256 ticketId = nextTicketId++;
          Ticket storage t = tickets[ticketId];
          t.owner = msg.sender;
          t.currStatus = Status.Valid;
          // No nonce is stored in this MVP version.
          t.commitment = commitment;

          ownerTicket[msg.sender] = ticketId;

          emit TicketCreated(msg.sender, ticketId, commitment);
      }

      /**
       * @dev Official‑sale purchase. Caller must send exact `ticketPrice`.
       *      `saleOpen` ensures the window is active.
       * @param commitment keccak256(secretKey) – never the plaintext.
       */
      function buyTicketOfficial(bytes32 commitment)
          external
          payable
          saleOpen
          noTicket
      {
          _purchaseTicket(commitment);
      }

      /**
       * @dev RTB purchase (early‑bird). Official sale must be closed,
       *      but the caller must have RTB granted.
       * @param commitment keccak256(secretKey)
       */
      function buyTicketRTB(bytes32 commitment)
          external
          payable
          rtbAvailable
          noTicket
      {
          // RTB purchases are only allowed BEFORE the official sale starts.
          require(block.timestamp < openingTime, "RTB only before opening time");
          _purchaseTicket(commitment);
          // Consume the RTB permission after a successful purchase.
          hasRTB[msg.sender] = false;
          emit RTBUpdated(msg.sender, false);
      }

      /* --------------------------------------------------------------------- */
      /*                              TRANSFER LOGIC                             */
      /* --------------------------------------------------------------------- */
      /**
       * @dev Transfer a **valid** ticket to another wallet that currently has none.
       * @param to Recipient address.
       * @param ticketId Ticket to move – must be owned by `msg.sender`.
       */
      /// @notice Transfer a VALID ticket to another wallet.
      /// @dev The sender must provide a new commitment for the recipient, because the original
      ///      secret key is unknown to the new owner. This prevents the previous owner from
      ///      re‑using the secret after the transfer.
      function transferTicket(address to, uint256 ticketId, bytes32 newCommitment)
          external
          ticketExists(ticketId)
          onlyTicketOwner(ticketId)
          onlyValidTicket(ticketId)
      {
          require(to != address(0), "Zero address");
          require(ownerTicket[to] == 0, "Recipient already has ticket");

          // Update mappings and ticket data.
          ownerTicket[msg.sender] = 0;
          ownerTicket[to] = ticketId;
          tickets[ticketId].owner = to;
          tickets[ticketId].commitment = newCommitment;

          emit TicketTransferred(msg.sender, to, ticketId);
      }

      /* --------------------------------------------------------------------- */
      /*                           TICKET USAGE / CHECK‑IN                      */
      /* --------------------------------------------------------------------- */
      /**
       * @dev Mark a ticket as used. Only the check‑in operator can call this.
       * @param ticketId Ticket that is being validated at the venue.
       */
      function useTicket(uint256 ticketId)
          external
          onlyCheckIn
          ticketExists(ticketId)
          onlyValidTicket(ticketId)
      {
          tickets[ticketId].currStatus = Status.Used;
          emit TicketUsed(ticketId);
      }

      /* --------------------------------------------------------------------- */
      /*                           VERIFICATION / QR LOGIC                     */
      /* --------------------------------------------------------------------- */
      /**
       * @dev Verify a ticket off‑chain (frontend) by providing the secret key.
       *      This is a **view** function – no gas cost for the caller.
       * @param ticketId Ticket to verify.
       * @param secretKey The original secret supplied by the buyer.
       * @return valid true if the commitment matches and the ticket is in a usable state.
      * @return qrHash keccak256(ticketId, secretKey) – can be turned into a QR.
       */
      function verifyTicket(uint256 ticketId, string calldata secretKey)
          external
          view
          ticketExists(ticketId)
          returns (bool valid, bytes32 qrHash)
      {
          Ticket storage t = tickets[ticketId];

          // 1️⃣ Verify the secret matches the stored commitment.
          bytes32 providedCommit = keccak256(abi.encodePacked(secretKey));
          if (providedCommit != t.commitment) {
              return (false, bytes32(0));
          }

          // 2️⃣ Ticket must not be Invalid. Valid and Used tickets are verifiable.
          if (t.currStatus == Status.Invalid) {
              return (false, bytes32(0));
          }

          // 3️⃣ Compute deterministic QR hash.
          // Owner address is deliberately excluded so the hash stays stable across transfers.
          qrHash = keccak256(abi.encodePacked(ticketId, secretKey));

          return (true, qrHash);
      }

      /* --------------------------------------------------------------------- */
      /*                              READ‑ONLY HELPERS                         */
      /* --------------------------------------------------------------------- */
      function getMyTicket() external view returns (Ticket memory) {
          uint256 id = ownerTicket[msg.sender];
          require(id != 0, "No ticket");
          return tickets[id];
      }

      function getTicket(uint256 ticketId)
          external
          view
          ticketExists(ticketId)
          returns (Ticket memory)
      {
          return tickets[ticketId];
      }

      function getMyTicketId() external view returns (uint256) {
          return ownerTicket[msg.sender];
      }

      function getTicketIdByOwner(address account) external view returns (uint256) {
          return ownerTicket[account];
      }

      function hasTicket(address account) external view returns (bool) {
          return ownerTicket[account] != 0;
      }

      function getRTB(address account) external view returns (bool) {
          return hasRTB[account];
      }

      function isSaleOpen() external view returns (bool) {
          return block.timestamp >= openingTime && block.timestamp < closingTime;
      }

      /* --------------------------------------------------------------------- */
      /*                         PAYMENT / RECEIVE FALLBACK                      */
      /* --------------------------------------------------------------------- */
      // Prevent accidental ETH sends – all purchases must go through the
      // explicit payable functions above.
      receive() external payable {
          revert("Send ETH via purchase functions");
      }

      fallback() external payable {
          revert("Invalid call");
      }

      /* --------------------------------------------------------------------- */
      /*                         WITHDRAWAL FOR OWNER                           */
      /* --------------------------------------------------------------------- */
      /**
       * @dev Owner can withdraw collected ETH.
       */
      function withdraw() external onlyOwner {
          uint256 balance = address(this).balance;
          require(balance > 0, "Nothing to withdraw");
          // Checks‑Effects‑Interactions: store amount, then interact.
          uint256 amount = balance;
          (bool ok, ) = owner.call{value: amount}("");
          require(ok, "Withdraw failed");
      }

      /// @notice Owner can manually invalidate a ticket (e.g., for refunds or fraud).
      /// @dev Only tickets that are not already Used can be invalidated.
      function invalidateTicket(uint256 ticketId) external onlyOwner ticketExists(ticketId) {
          require(tickets[ticketId].currStatus != Status.Used, "Used tickets cannot be invalidated");
          tickets[ticketId].currStatus = Status.Invalid;
          emit TicketInvalidated(ticketId);
      }
}
