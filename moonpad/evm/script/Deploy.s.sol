// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";

/// @notice Deploys the launchpad (and its locker) against the canonical Uniswap v3
/// factory and WETH on the target chain.
///
/// Usage:
///   UNIV3_FACTORY=0x... WETH=0x... FEE_RECIPIENT=0x... \
///   forge script script/Deploy.s.sol --rpc-url robinhood --broadcast \
///     --private-key $DEPLOYER_KEY
contract DeployLaunchpad is Script {
    function run() external returns (CoopLaunchpad launchpad) {
        address uniV3Factory = vm.envAddress("UNIV3_FACTORY");
        address weth = vm.envAddress("WETH");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();
        launchpad = new CoopLaunchpad(uniV3Factory, weth, feeRecipient);
        vm.stopBroadcast();

        console.log("CoopLaunchpad deployed:", address(launchpad));
        console.log("CoopLocker:            ", address(launchpad.locker()));
    }
}
