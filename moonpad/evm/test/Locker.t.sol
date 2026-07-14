// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";
import {CoopLaunchToken} from "../src/tokens/CoopLaunchToken.sol";
import {IERC20Min} from "../src/interfaces/IExternal.sol";
import {TestSwapRouter} from "./utils/TestSwapRouter.sol";

contract LockerTest is BaseSetup {
    TestSwapRouter internal router;

    function setUp() public override {
        super.setUp();
        router = new TestSwapRouter();
    }

    /// @dev Graduate a token and run some Uniswap volume through the pool so the
    /// position accrues fees.
    function _graduateWithVolume(CoopLaunchpad.Flavor flavor)
        internal
        returns (address token, address pool)
    {
        token = _create(flavor);
        pool = _fillCurve(token);

        // bob round-trips: buy 1 WETH worth, sell everything back.
        vm.startPrank(bob);
        weth.deposit{value: 1 ether}();
        weth.transfer(address(router), 1 ether);
        vm.stopPrank();
        router.swapExactInput(pool, address(weth) < token, 1 ether, bob);

        uint256 got = CoopLaunchToken(token).balanceOf(bob);
        vm.prank(bob);
        CoopLaunchToken(token).transfer(address(router), got);
        router.swapExactInput(pool, token < address(weth), got, bob);
    }

    function test_Collect_StandardPaysCreatorAndPlatform() public {
        (address token, address pool) = _graduateWithVolume(CoopLaunchpad.Flavor.Standard);

        uint128 liqBefore = _positionLiquidity(pool);
        uint256 creatorWethBefore = weth.balanceOf(creator);
        uint256 platformWethBefore = weth.balanceOf(platform);

        locker.collect(token);

        // Fees paid out 50/50 in kind; position liquidity untouched (no reinvest).
        uint256 creatorGain = weth.balanceOf(creator) - creatorWethBefore;
        uint256 platformGain = weth.balanceOf(platform) - platformWethBefore;
        assertGt(creatorGain, 0);
        assertApproxEqAbs(creatorGain, platformGain, 2);
        assertEq(_positionLiquidity(pool), liqBefore);

        // Token-side fees split too.
        assertGt(CoopLaunchToken(token).balanceOf(creator), 0);
    }

    function test_Collect_LPGrowReinvestsIntoLockedPosition() public {
        (address token, address pool) = _graduateWithVolume(CoopLaunchpad.Flavor.LPGrow);

        uint128 liqBefore = _positionLiquidity(pool);
        uint256 creatorWethBefore = weth.balanceOf(creator);

        locker.collect(token);

        // Liquidity permanently deepened…
        assertGt(_positionLiquidity(pool), liqBefore);
        // …and the payout share still flows.
        assertGt(weth.balanceOf(creator), creatorWethBefore);
    }

    function test_Collect_AnyoneCanTrigger_AndIsIdempotent() public {
        (address token,) = _graduateWithVolume(CoopLaunchpad.Flavor.Standard);

        vm.prank(attacker);
        locker.collect(token);

        // Second collect with no new volume pays nothing and doesn't revert.
        uint256 creatorWeth = weth.balanceOf(creator);
        locker.collect(token);
        assertEq(weth.balanceOf(creator), creatorWeth);
    }

    function test_Collect_UnknownTokenReverts() public {
        vm.expectRevert(bytes("Locker: unknown token"));
        locker.collect(makeAddr("nothing"));
    }

    function test_Register_OnlyLaunchpad() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Locker: not launchpad"));
        locker.register(makeAddr("t"), makeAddr("p"), attacker, 0);
    }

    function test_LiquidityIsLockedForever() public {
        (address token, address pool) = _graduateWithVolume(CoopLaunchpad.Flavor.Standard);
        // No code path on the locker can decrease liquidity — the strongest check we
        // can make on-chain: liquidity stays put across collects and time.
        uint128 liq = _positionLiquidity(pool);
        locker.collect(token);
        vm.warp(block.timestamp + 365 days);
        locker.collect(token);
        assertEq(_positionLiquidity(pool), liq);
        assertGt(liq, 0);
    }
}
