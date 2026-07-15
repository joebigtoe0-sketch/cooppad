// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetupV2} from "./BaseSetupV2.sol";
import {CoopLaunchpadV2} from "../src/CoopLaunchpadV2.sol";
import {CoopLaunchTokenV2} from "../src/tokens/CoopLaunchTokenV2.sol";

contract V2LockerTest is BaseSetupV2 {
    function test_Standard_CollectSplitsFeesFiftyFifty() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);
        _buy(token, 2 ether, alice);
        _sell(token, CoopLaunchTokenV2(token).balanceOf(alice) / 2, alice);

        uint256 creatorWethBefore = weth.balanceOf(creator);
        uint256 platformWethBefore = weth.balanceOf(platform);
        uint128 liqBefore = _positionLiquidity(token);

        locker.collect(token);

        uint256 creatorGain = weth.balanceOf(creator) - creatorWethBefore;
        uint256 platformGain = weth.balanceOf(platform) - platformWethBefore;
        assertGt(creatorGain, 0, "creator earns WETH fees");
        assertApproxEqAbs(creatorGain, platformGain, 2, "50/50 split");
        assertEq(_positionLiquidity(token), liqBefore, "Standard never reinvests");
    }

    function test_LPGrow_CollectReinvestsSeventyPercent() public {
        address token = _launch(CoopLaunchpadV2.Flavor.LPGrow);
        _buy(token, 2 ether, alice);
        _sell(token, CoopLaunchTokenV2(token).balanceOf(alice) / 2, alice);

        uint128 liqBefore = _positionLiquidity(token);
        uint256 creatorWethBefore = weth.balanceOf(creator);

        locker.collect(token);

        assertGt(_positionLiquidity(token), liqBefore, "liquidity deepened");
        assertGt(weth.balanceOf(creator), creatorWethBefore, "creator still paid the payout share");
    }

    function test_SuperLP_BuyTaxLandsOnLockerAndCompounds() public {
        address token = _launch(CoopLaunchpadV2.Flavor.SuperLP);

        uint256 out = _buy(token, 2 ether, alice);
        uint256 taxHeld = CoopLaunchTokenV2(token).balanceOf(address(locker));
        // Tax is 5% of the gross pool output; alice got the other 95%.
        assertApproxEqRel(taxHeld, out * 500 / 9500, 1e15, "5% buy tax skimmed to locker");

        // collect() swap-and-liquifies the tax: half sold for WETH, paired,
        // minted into the locked position — no sells or fees required.
        uint128 liqBefore = _positionLiquidity(token);
        locker.collect(token);
        assertGt(_positionLiquidity(token), liqBefore, "tax compounds into locked LP");
        assertLt(
            CoopLaunchTokenV2(token).balanceOf(address(locker)),
            taxHeld,
            "tax balance consumed by compounding"
        );
    }

    function test_SuperLP_PoolFeesStillSplitFiftyFifty() public {
        address token = _launch(CoopLaunchpadV2.Flavor.SuperLP);
        _buy(token, 2 ether, alice);
        _sell(token, CoopLaunchTokenV2(token).balanceOf(alice) / 2, alice);

        uint256 creatorWethBefore = weth.balanceOf(creator);
        uint256 platformWethBefore = weth.balanceOf(platform);

        locker.collect(token);

        uint256 creatorGain = weth.balanceOf(creator) - creatorWethBefore;
        uint256 platformGain = weth.balanceOf(platform) - platformWethBefore;
        assertGt(creatorGain, 0, "creator earns WETH fees");
        assertApproxEqAbs(creatorGain, platformGain, 2, "fees split 50/50, tax handled separately");
    }

    function test_SuperLP_SellsAreNeverTaxed() public {
        address token = _launch(CoopLaunchpadV2.Flavor.SuperLP);
        uint256 out = _buy(token, 1 ether, alice);

        uint256 lockerBefore = CoopLaunchTokenV2(token).balanceOf(address(locker));
        _sell(token, out / 2, alice);
        assertEq(
            CoopLaunchTokenV2(token).balanceOf(address(locker)),
            lockerBefore,
            "sell moved no tax to the locker"
        );
    }

    function test_Collect_PermissionlessAndIdempotent() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);
        _buy(token, 1 ether, alice);

        vm.prank(bob); // anyone can crank
        locker.collect(token);

        // Nothing accrued since — second collect is a harmless no-op.
        uint256 creatorWeth = weth.balanceOf(creator);
        locker.collect(token);
        assertEq(weth.balanceOf(creator), creatorWeth, "no double payout");
    }

    function test_Locker_HasNoWithdrawPath() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);
        uint128 liq = _positionLiquidity(token);
        assertGt(liq, 0);
        // The locker exposes register/collect/positionKey/locks only — nothing
        // can decrease liquidity. Compile-time guarantee; assert the position
        // persists after a full trading + collect cycle.
        _buy(token, 1 ether, alice);
        _sell(token, CoopLaunchTokenV2(token).balanceOf(alice), alice);
        locker.collect(token);
        assertGe(_positionLiquidity(token), liq, "locked liquidity never decreases");
    }

    function test_Register_OnlyLaunchpad() public {
        vm.expectRevert(bytes("Locker: not launchpad"));
        vm.prank(attacker);
        locker.register(makeAddr("fakeToken"), makeAddr("fakePool"), attacker, 0, -100, 100);
    }
}
