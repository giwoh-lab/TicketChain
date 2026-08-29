// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConcertTicket} from "../src/ConcertTicket.sol";

contract ConcertTicketTest is Test {
    ConcertTicket ticket;

    address admin = makeAddr("admin");
    address buyer = makeAddr("buyer");
    address buyer2 = makeAddr("buyer2");
    address verifier = makeAddr("verifier");
    address attacker = makeAddr("attacker");

    uint256 constant PRICE = 0.1 ether;

    bytes32 constant COMMITMENT_1 =
        keccak256(abi.encodePacked("secret-key-1"));

    bytes32 constant COMMITMENT_2 =
        keccak256(abi.encodePacked("secret-key-2"));

    function setUp() public {
        vm.startPrank(admin);
        ticket = new ConcertTicket();
        vm.stopPrank();
    }

    // =============================================================
    //                      DEPLOYMENT
    // =============================================================

    function test_InitialState() public view {
        assertEq(ticket.owner(), admin);
        assertEq(ticket.checkInOperator(), admin);

        assertEq(ticket.ticketPrice(), PRICE);
        assertEq(ticket.nextTicketId(), 1);

        assertEq(ticket.getMyTicketId(), 0);
        assertFalse(ticket.hasTicket(buyer));
        assertFalse(ticket.getRTB(buyer));
    }

    // =============================================================
    //                      ADMIN TESTS
    // =============================================================

    function test_TransferOwnership() public {
        vm.prank(admin);
        ticket.transferOwnership(buyer);

        assertEq(ticket.owner(), buyer);
    }

    function test_RevertWhen_NonOwnerTransfersOwnership() public {
        vm.prank(attacker);

        vm.expectRevert("Only owner");
        ticket.transferOwnership(attacker);
    }

    function test_SetCheckInOperator() public {
        vm.prank(admin);
        ticket.setCheckInOperator(verifier);

        assertEq(ticket.checkInOperator(), verifier);
    }

    function test_RevertWhen_NonOwnerChangesCheckInOperator() public {
        vm.prank(attacker);

        vm.expectRevert("Only owner");
        ticket.setCheckInOperator(attacker);
    }

    function test_SetTicketPrice() public {
        uint256 newPrice = 0.2 ether;

        vm.prank(admin);
        ticket.setTicketPrice(newPrice);

        assertEq(ticket.ticketPrice(), newPrice);
    }

    function test_SetMaxTickets() public {
        vm.prank(admin);
        ticket.setMaxTickets(10);

        assertEq(ticket.maxTickets(), 10);
    }

    function test_RevertWhen_MaxTicketsBelowExistingTickets() public {
        // Configure sale.
        vm.warp(block.timestamp + 2 days);

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);

        assertEq(ticket.nextTicketId(), 2);

        vm.prank(admin);

        vm.expectRevert("new max below existing tickets");
        ticket.setMaxTickets(0);
    }

    // =============================================================
    //                      SALE WINDOW
    // =============================================================

    function test_SaleIsInitiallyClosed() public {
        assertFalse(ticket.isSaleOpen());
    }

    function test_SaleOpensAtOpeningTime() public {
        vm.warp(ticket.openingTime());

        assertTrue(ticket.isSaleOpen());
    }

    function test_SaleClosesAtClosingTime() public {
        vm.warp(ticket.closingTime());

        assertFalse(ticket.isSaleOpen());
    }

    function test_RevertWhen_BuyBeforeOfficialSale() public {
        vm.warp(ticket.openingTime() - 1);

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);

        vm.expectRevert("Official sale closed");
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);
    }

    function test_RevertWhen_BuyAfterOfficialSale() public {
        vm.warp(ticket.closingTime());

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);

        vm.expectRevert("Official sale closed");
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);
    }

    // =============================================================
    //                      OFFICIAL PURCHASE
    // =============================================================

    function test_BuyOfficialTicket() public {
        vm.warp(ticket.openingTime());

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);

        assertEq(ticket.getTicketIdByOwner(buyer), 1);
        assertTrue(ticket.hasTicket(buyer));

        ConcertTicket.Ticket memory t = ticket.getTicket(1);

        assertEq(t.owner, buyer);
        assertEq(uint256(t.currStatus), uint256(ConcertTicket.Status.Valid));
        assertEq(t.commitment, COMMITMENT_1);

        assertEq(ticket.nextTicketId(), 2);
    }

    function test_RevertWhen_WrongPayment() public {
        vm.warp(ticket.openingTime());

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);

        vm.expectRevert("Incorrect ETH amount");
        ticket.buyTicketOfficial{value: 0.05 ether}(COMMITMENT_1);
    }

    function test_RevertWhen_SecondTicketIsPurchased() public {
        vm.warp(ticket.openingTime());

        vm.deal(buyer, 1 ether);

        vm.startPrank(buyer);

        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);

        vm.expectRevert("Already owns ticket");
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_2);

        vm.stopPrank();
    }

    function test_RevertWhen_SoldOut() public {
        vm.warp(ticket.openingTime());

        vm.prank(admin);
        ticket.setMaxTickets(1);

        vm.deal(buyer, 1 ether);
        vm.deal(buyer2, 1 ether);

        vm.prank(buyer);
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);

        vm.prank(buyer2);

        vm.expectRevert("Sold out");
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_2);
    }

    // =============================================================
    //                      RTB
    // =============================================================

    function test_AdminCanGrantRTB() public {
        vm.prank(admin);
        ticket.grantRTB(buyer);

        assertTrue(ticket.getRTB(buyer));
    }

    function test_AdminCanRevokeRTB() public {
        vm.prank(admin);
        ticket.grantRTB(buyer);

        assertTrue(ticket.getRTB(buyer));

        vm.prank(admin);
        ticket.revokeRTB(buyer);

        assertFalse(ticket.getRTB(buyer));
    }

    function test_RevertWhen_NonOwnerGrantsRTB() public {
        vm.prank(attacker);

        vm.expectRevert("Only owner");
        ticket.grantRTB(buyer);
    }

    function test_BuyRTBTicket() public {
        // Before official sale.
        vm.warp(ticket.openingTime() - 1);

        vm.prank(admin);
        ticket.grantRTB(buyer);

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);
        ticket.buyTicketRTB{value: PRICE}(COMMITMENT_1);

        assertTrue(ticket.hasTicket(buyer));
        assertEq(ticket.getTicketIdByOwner(buyer), 1);

        // RTB must be consumed.
        assertFalse(ticket.getRTB(buyer));
    }

    function test_RevertWhen_RTBBuyerHasNoPermission() public {
        vm.warp(ticket.openingTime() - 1);

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);

        vm.expectRevert("RTB not granted");
        ticket.buyTicketRTB{value: PRICE}(COMMITMENT_1);
    }

    function test_RevertWhen_RTBIsUsedAfterOpening() public {
        vm.warp(ticket.openingTime());

        vm.prank(admin);
        ticket.grantRTB(buyer);

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);

        vm.expectRevert("RTB only before opening time");
        ticket.buyTicketRTB{value: PRICE}(COMMITMENT_1);
    }

    function test_RevertWhen_RTBIsUsedTwice() public {
        vm.warp(ticket.openingTime() - 1);

        vm.prank(admin);
        ticket.grantRTB(buyer);

        vm.deal(buyer, 2 ether);

        vm.prank(buyer);
        ticket.buyTicketRTB{value: PRICE}(COMMITMENT_1);

        // RTB was consumed.
        assertFalse(ticket.getRTB(buyer));

        vm.prank(buyer);

        vm.expectRevert("RTB not granted");
        ticket.buyTicketRTB{value: PRICE}(COMMITMENT_2);
    }

    // =============================================================
    //                      TRANSFER
    // =============================================================

    function _buyTicketForBuyer() internal {
        vm.warp(ticket.openingTime());

        vm.deal(buyer, 1 ether);

        vm.prank(buyer);
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_1);
    }

    function test_TransferTicket() public {
        _buyTicketForBuyer();

        vm.prank(buyer);
        ticket.transferTicket(
            buyer2,
            1,
            COMMITMENT_2
        );

        assertEq(ticket.getTicketIdByOwner(buyer), 0);
        assertEq(ticket.getTicketIdByOwner(buyer2), 1);

        ConcertTicket.Ticket memory t = ticket.getTicket(1);

        assertEq(t.owner, buyer2);
        assertEq(t.commitment, COMMITMENT_2);
    }

    function test_RevertWhen_TransferToExistingTicketOwner() public {
        _buyTicketForBuyer();

        vm.deal(buyer2, 1 ether);

        vm.prank(buyer2);

        // Buy second ticket for buyer2.
        ticket.buyTicketOfficial{value: PRICE}(COMMITMENT_2);

        vm.prank(buyer);

        vm.expectRevert("Recipient already has ticket");

        ticket.transferTicket(
            buyer2,
            1,
            COMMITMENT_2
        );
    }

    function test_RevertWhen_NonOwnerTransfersTicket() public {
        _buyTicketForBuyer();

        vm.prank(attacker);

        vm.expectRevert("Not ticket owner");

        ticket.transferTicket(
            buyer2,
            1,
            COMMITMENT_2
        );
    }

    function test_RevertWhen_TransferInvalidTicket() public {
        _buyTicketForBuyer();

        vm.prank(admin);
        ticket.invalidateTicket(1);

        vm.prank(buyer);

        vm.expectRevert("Ticket not valid");

        ticket.transferTicket(
            buyer2,
            1,
            COMMITMENT_2
        );
    }

    // =============================================================
    //                      VERIFICATION
    // =============================================================

    function test_VerifyTicketWithCorrectSecret() public {
        _buyTicketForBuyer();

        (bool valid, bytes32 qrHash) =
            ticket.verifyTicket(1, "secret-key-1");

        assertTrue(valid);

        assertEq(
            qrHash,
            keccak256(
                abi.encodePacked(
                    uint256(1),
                    "secret-key-1"
                )
            )
        );
    }

    function test_VerifyTicketWithWrongSecret() public {
        _buyTicketForBuyer();

        (bool valid, bytes32 qrHash) =
            ticket.verifyTicket(1, "wrong-secret");

        assertFalse(valid);
        assertEq(qrHash, bytes32(0));
    }

    function test_InvalidTicketCannotBeVerified() public {
        _buyTicketForBuyer();

        vm.prank(admin);
        ticket.invalidateTicket(1);

        (bool valid, bytes32 qrHash) =
            ticket.verifyTicket(1, "secret-key-1");

        assertFalse(valid);
        assertEq(qrHash, bytes32(0));
    }

    // =============================================================
    //                      CHECK-IN / USED
    // =============================================================

    function test_UseTicket() public {
        _buyTicketForBuyer();

        vm.prank(admin);
        ticket.setCheckInOperator(verifier);

        vm.prank(verifier);
        ticket.useTicket(1);

        ConcertTicket.Ticket memory t = ticket.getTicket(1);

        assertEq(
            uint256(t.currStatus),
            uint256(ConcertTicket.Status.Used)
        );
    }

    function test_RevertWhen_UnauthorizedUserUsesTicket() public {
        _buyTicketForBuyer();

        vm.prank(attacker);

        vm.expectRevert("Only check-in operator");
        ticket.useTicket(1);
    }

    function test_RevertWhen_TicketIsUsedTwice() public {
        _buyTicketForBuyer();

        vm.prank(admin);
        ticket.setCheckInOperator(verifier);

        vm.prank(verifier);
        ticket.useTicket(1);

        vm.prank(verifier);

        vm.expectRevert("Ticket not valid");
        ticket.useTicket(1);
    }

    function test_RevertWhen_InvalidTicketIsUsed() public {
      _buyTicketForBuyer();

      vm.prank(admin);
      ticket.setCheckInOperator(verifier);

      vm.prank(admin);
      ticket.invalidateTicket(1);

      vm.prank(verifier);

      vm.expectRevert("Ticket not valid");
      ticket.useTicket(1);
  }

    // =============================================================
    //                      INVALIDATION
    // =============================================================

    function test_AdminCanInvalidateTicket() public {
        _buyTicketForBuyer();

        vm.prank(admin);
        ticket.invalidateTicket(1);

        ConcertTicket.Ticket memory t = ticket.getTicket(1);

        assertEq(
            uint256(t.currStatus),
            uint256(ConcertTicket.Status.Invalid)
        );
    }

    function test_RevertWhen_NonOwnerInvalidatesTicket() public {
        _buyTicketForBuyer();

        vm.prank(attacker);

        vm.expectRevert("Only owner");
        ticket.invalidateTicket(1);
    }

    function test_RevertWhen_UsedTicketIsInvalidated() public {
        _buyTicketForBuyer();

        vm.prank(admin);
        ticket.setCheckInOperator(verifier);

        vm.prank(verifier);
        ticket.useTicket(1);

        vm.prank(admin);

        vm.expectRevert("Used tickets cannot be invalidated");
        ticket.invalidateTicket(1);
    }

    // =============================================================
    //                      INVALID TICKET IDS
    // =============================================================

    function test_RevertWhen_TicketIdIsZero() public {
        vm.expectRevert("Ticket does not exist");
        ticket.getTicket(0);
    }

    function test_RevertWhen_TicketIdDoesNotExist() public {
        vm.expectRevert("Ticket does not exist");
        ticket.getTicket(999);
    }

    // =============================================================
    //                      PAYMENT / WITHDRAW
    // =============================================================

    function test_ContractReceivesPayment() public {
        _buyTicketForBuyer();

        assertEq(address(ticket).balance, PRICE);
    }

    function test_Withdraw() public {
        _buyTicketForBuyer();

        uint256 balanceBefore = admin.balance;

        vm.prank(admin);
        ticket.withdraw();

        assertEq(address(ticket).balance, 0);
        assertEq(admin.balance, balanceBefore + PRICE);
    }

    function test_RevertWhen_NonOwnerWithdraws() public {
        _buyTicketForBuyer();

        vm.prank(attacker);

        vm.expectRevert("Only owner");
        ticket.withdraw();
    }

    function test_RevertWhen_WithdrawWithNoBalance() public {
        vm.prank(admin);

        vm.expectRevert("Nothing to withdraw");
        ticket.withdraw();
    }

    // =============================================================
    //                      RECEIVE / FALLBACK
    // =============================================================

    function test_RevertWhen_SendingETHDirectly() public {
        vm.deal(buyer, 1 ether);

        vm.prank(buyer);

        (bool success, ) =
            address(ticket).call{value: 1 ether}("");

        assertFalse(success);
    }
}
