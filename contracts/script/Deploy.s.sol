
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ConcertTicket} from "../src/ConcertTicket.sol";

contract DeployConcertTicket is Script {
    function run() external returns (ConcertTicket ticket) {
        uint256 deployerPrivateKey =
            vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        ticket = new ConcertTicket();

        vm.stopBroadcast();
    }
}

