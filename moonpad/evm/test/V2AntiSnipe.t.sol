// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetupV2} from "./BaseSetupV2.sol";
import {CoopLaunchpadV2} from "../src/CoopLaunchpadV2.sol";
import {CoopLaunchTokenV2} from "../src/tokens/CoopLaunchTokenV2.sol";

contract V2AntiSnipeTest is BaseSetupV2 {
    function test_LaunchBlockBuyBlocked() public {
        address token = _launchNoWarp(CoopLaunchpadV2.Flavor.Standard, 0);
        address pool = _pool(token);
        bool wethIsToken0 = address(weth) < token;

        weth.deposit{value: 0.01 ether}();
        weth.transfer(address(router), 0.01 ether);
        vm.expectRevert(); // LaunchBlockBuyBlocked bubbles through the pool
        router.swapExactInput(pool, wethIsToken0, 0.01 ether, attacker);
    }

    function test_WindowCapsCumulativeBuysPerWallet() public {
        address token = _launchNoWarp(CoopLaunchpadV2.Flavor.Standard, 0);
        vm.roll(block.number + 1); // past the launch block, still in the window

        // ~0.02 ETH buys ~17M tokens (under the 20M cap) — fine.
        uint256 got = _buy(token, 0.02 ether, attacker);
        assertGt(got, 0);

        // The next buy pushes the wallet's cumulative window total past 2%.
        address pool = _pool(token);
        bool wethIsToken0 = address(weth) < token;
        weth.deposit{value: 0.01 ether}();
        weth.transfer(address(router), 0.01 ether);
        vm.expectRevert(); // LaunchWindowMaxBuy bubbles through the pool
        router.swapExactInput(pool, wethIsToken0, 0.01 ether, attacker);

        // A different wallet still has its own allowance.
        uint256 gotBob = _buy(token, 0.02 ether, bob);
        assertGt(gotBob, 0);
    }

    function test_WindowLiftsAfterExpiry() public {
        address token = _launchNoWarp(CoopLaunchpadV2.Flavor.Standard, 0);
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 121);

        uint256 got = _buy(token, 2 ether, attacker); // way past 2% — allowed now
        uint256 cap = CoopLaunchTokenV2(token).SNIPE_MAX_TOKENS();
        assertGt(got, cap, "window over: cap no longer applies");
    }

    function test_DevBuyExemptFromLaunchBlockAndCap() public {
        // 0.1 ETH dev buy is > the 2% window cap and happens in the launch block.
        address token = _launchNoWarp(CoopLaunchpadV2.Flavor.Standard, 0.1 ether);
        uint256 got = CoopLaunchTokenV2(token).balanceOf(creator);
        assertGt(got, CoopLaunchTokenV2(token).SNIPE_MAX_TOKENS(), "dev buy exceeds cap by design");
    }

    function test_SellsUnrestrictedDuringWindow() public {
        address token = _launchNoWarp(CoopLaunchpadV2.Flavor.Standard, 0.05 ether);
        vm.roll(block.number + 1); // sells only need to be off the launch block for the pool math

        uint256 creatorTokens = CoopLaunchTokenV2(token).balanceOf(creator);
        uint256 ethOut = _sell(token, creatorTokens / 2, creator);
        assertGt(ethOut, 0, "selling during the window is never restricted");
    }
}
