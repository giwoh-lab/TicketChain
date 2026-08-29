// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ConcertTicket} from "../src/ConcertTicket.sol";

contract DemoConcertTicket is Script {
    // Deployed contract on Sepolia
    ConcertTicket constant ticket =
        ConcertTicket(payable(0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4));

    // Demo user private key.
    //
    // IMPORTANT:
    // Put this in .env.
    // Never commit the private key to Git.
    uint256 userPrivateKey = vm.envUint("USER_PRIVATE_KEY");

    function run() external {
        address admin = vm.addr(vm.envUint("PRIVATE_KEY"));
        address user = vm.addr(userPrivateKey);

        console2.log("========================================");
        console2.log("Concert Ticket E2E Demo");
        console2.log("========================================");

        console2.log("Contract:");
        console2.logAddress(address(ticket));

        console2.log("Admin:");
        console2.logAddress(admin);

        console2.log("User:");
        console2.logAddress(user);

        // ---------------------------------------------------------------
        // 1. ADMIN GRANTS RTB TO USER
        // ---------------------------------------------------------------

        console2.log("");
        console2.log("1. Granting RTB to user...");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        ticket.grantRTB(user);

        vm.stopBroadcast();

        console2.log("RTB granted.");

        // Read state after transaction
        bool rtb = ticket.getRTB(user);

        console2.log("User has RTB:");
        console2.logBool(rtb);

        require(rtb, "RTB was not granted");

        // ---------------------------------------------------------------
        // 2. USER BUYS TICKET USING RTB
        // ---------------------------------------------------------------

        console2.log("");
        console2.log("2. User buying ticket with RTB...");

        bytes32 commitment = keccak256(
            abi.encodePacked("demo-secret-key-2026")
        );

        vm.startBroadcast(userPrivateKey);

        ticket.buyTicketRTB{value: ticket.ticketPrice()}(commitment);

        vm.stopBroadcast();

        console2.log("Ticket purchased.");

        // ---------------------------------------------------------------
        // 3. READ USER TICKET
        // ---------------------------------------------------------------

        console2.log("");
        console2.log("3. Reading user's ticket...");

        uint256 ticketId = ticket.getTicketIdByOwner(user);

        console2.log("Ticket ID:");
        console2.logUint(ticketId);

        require(ticketId != 0, "Ticket was not created");

        ConcertTicket.Ticket memory userTicket =
            ticket.getTicket(ticketId);

        console2.log("Ticket owner:");
        console2.logAddress(userTicket.owner);

        console2.log("Ticket status:");
        console2.logUint(uint256(userTicket.currStatus));

        console2.log("Commitment:");
        console2.logBytes32(userTicket.commitment);

        require(
            userTicket.owner == user,
            "Ticket owner is incorrect"
        );

        require(
            userTicket.currStatus == ConcertTicket.Status.Valid,
            "Ticket is not Valid"
        );

        // ---------------------------------------------------------------
        // 4. VERIFY TICKET
        // ---------------------------------------------------------------

        console2.log("");
        console2.log("4. Verifying ticket...");

        (
            bool valid,
            bytes32 qrHash
        ) = ticket.verifyTicket(
            ticketId,
            "demo-secret-key-2026"
        );

        console2.log("Ticket valid:");
        console2.logBool(valid);

        console2.log("QR hash:");
        console2.logBytes32(qrHash);

        require(valid, "Ticket verification failed");

        // ---------------------------------------------------------------
        // 5. CHECK-IN
        // ---------------------------------------------------------------

        console2.log("");
        console2.log("5. Check-in operator using ticket...");

        address operator = ticket.checkInOperator();

        console2.log("Contract check-in operator:");
        console2.logAddress(operator);

        console2.log("Broadcast account:");
        console2.logAddress(vm.addr(vm.envUint("PRIVATE_KEY")));

        require(
            operator == vm.addr(vm.envUint("PRIVATE_KEY")),
            "Private key is not check-in operator"
        );

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        ticket.useTicket(ticketId);

        vm.stopBroadcast();

        console2.log("Ticket successfully used.");

        // ---------------------------------------------------------------
        // 6. VERIFY FINAL STATE
        // ---------------------------------------------------------------

        console2.log("");
        console2.log("6. Reading final ticket state...");

        ConcertTicket.Ticket memory finalTicket =
            ticket.getTicket(ticketId);

        console2.log("Final owner:");
        console2.logAddress(finalTicket.owner);

        console2.log("Final status:");
        console2.logUint(uint256(finalTicket.currStatus));

        require(
            finalTicket.currStatus == ConcertTicket.Status.Used,
            "Ticket is not Used"
        );

        console2.log("");
        console2.log("========================================");
        console2.log("E2E DEMO COMPLETED SUCCESSFULLY");
        console2.log("========================================");
    }
}