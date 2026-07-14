// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";
import {CoopLaunchToken} from "../src/tokens/CoopLaunchToken.sol";

contract AntiSnipeTest is BaseSetup {
    function test_SniperCappedAt2PercentDuringWindow() public {
        address token = _createNoWarp(CoopLaunchpad.Flavor.Standard);

        // A large buy right at launch would exceed 2% of supply — blocked.
        vm.prank(bob);
        vm.expectRevert(bytes("Launchpad: launch window max buy"));
        launchpad.buy{value: 1 ether}(token, 0);

        // A small buy under the cap is fine…
        vm.prank(bob);
        launchpad.buy{value: 0.02 ether}(token, 0);
        assertGt(CoopLaunchToken(token).balanceOf(bob), 0);

        // …but the cap is cumulative within the window.
        vm.prank(bob);
        vm.expectRevert(bytes("Launchpad: launch window max buy"));
        launchpad.buy{value: 0.02 ether}(token, 0);
    }

    function test_CreatorExemptDuringWindow() public {
        address token = _createNoWarp(CoopLaunchpad.Flavor.Standard);
        vm.prank(creator);
        launchpad.buy{value: 1 ether}(token, 0);
        assertGt(
            CoopLaunchToken(token).balanceOf(creator), launchpad.SNIPE_MAX_TOKENS()
        );
    }

    function test_CapLiftsAfterWindow() public {
        address token = _createNoWarp(CoopLaunchpad.Flavor.Standard);
        vm.warp(block.timestamp + launchpad.SNIPE_WINDOW() + 1);

        vm.prank(bob);
        launchpad.buy{value: 1 ether}(token, 0);
        assertGt(CoopLaunchToken(token).balanceOf(bob), launchpad.SNIPE_MAX_TOKENS());
    }
}
