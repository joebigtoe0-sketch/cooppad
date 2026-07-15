// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetupV2} from "./BaseSetupV2.sol";
import {CoopLaunchpadV2} from "../src/CoopLaunchpadV2.sol";
import {CoopRouter} from "../src/CoopRouter.sol";
import {CoopLaunchTokenV2} from "../src/tokens/CoopLaunchTokenV2.sol";

contract V2RouterTest is BaseSetupV2 {
    CoopRouter internal coopRouter;

    function setUp() public override {
        super.setUp();
        coopRouter = new CoopRouter(address(uniFactory), address(weth));
    }

    function test_Router_BuyAndSellRoundTripInEth() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);

        vm.prank(alice);
        uint256 got = coopRouter.buyExactEth{value: 1 ether}(token, 10_000, 0, alice);
        assertGt(got, 0, "buy delivered");
        assertEq(CoopLaunchTokenV2(token).balanceOf(alice), got, "return matches delivery");

        vm.startPrank(alice);
        CoopLaunchTokenV2(token).approve(address(coopRouter), got);
        uint256 balBefore = alice.balance;
        uint256 ethOut = coopRouter.sellExactTokens(token, 10_000, got, 0, alice);
        vm.stopPrank();

        assertEq(alice.balance - balBefore, ethOut, "ETH delivered unwrapped");
        assertGt(ethOut, 0.9 ether, "round trip keeps most value");
    }

    function test_Router_SuperLPBuyReturnsNetOfTax() public {
        address token = _launch(CoopLaunchpadV2.Flavor.SuperLP);

        vm.prank(alice);
        uint256 got = coopRouter.buyExactEth{value: 1 ether}(token, 10_000, 0, alice);
        assertEq(CoopLaunchTokenV2(token).balanceOf(alice), got, "returned amount is net of 5% tax");
        assertGt(CoopLaunchTokenV2(token).balanceOf(address(locker)), 0, "tax skimmed");
    }

    function test_Router_SlippageGuards() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);
        vm.prank(alice);
        vm.expectRevert(bytes("Router: slippage"));
        coopRouter.buyExactEth{value: 0.1 ether}(token, 10_000, type(uint256).max, alice);
    }

    function test_Router_NoPoolReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Router: no pool"));
        coopRouter.buyExactEth{value: 0.1 ether}(makeAddr("noToken"), 10_000, 0, alice);
    }
}
