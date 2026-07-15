// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CoopLaunchpadV2} from "../src/CoopLaunchpadV2.sol";

/// @notice Deploys CoopLaunchpadV2 (which deploys its own CoopLockerV2) against
/// an existing Uniswap v3 factory + WETH. Reads UNIV3_FACTORY, WETH and
/// FEE_RECIPIENT from the environment — see evm/.env.
contract DeployV2 is Script {
    function run() external returns (CoopLaunchpadV2 launchpad) {
        address factory = vm.envAddress("UNIV3_FACTORY");
        address weth = vm.envAddress("WETH");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();
        launchpad = new CoopLaunchpadV2(factory, weth, feeRecipient);
        vm.stopBroadcast();

        console2.log("CoopLaunchpadV2 deployed:", address(launchpad));
        console2.log("CoopLockerV2:            ", address(launchpad.locker()));
    }
}
