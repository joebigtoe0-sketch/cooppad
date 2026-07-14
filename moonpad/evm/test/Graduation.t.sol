// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";
import {CoopLaunchToken} from "../src/tokens/CoopLaunchToken.sol";
import {IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";
import {TestSwapRouter} from "./utils/TestSwapRouter.sol";

contract GraduationTest is BaseSetup {
    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return (a + b - 1) / b;
    }

    function _grossToFill() private view returns (uint256) {
        return _ceilDiv(
            launchpad.CURVE_TARGET_ETH() * launchpad.BPS(), launchpad.BPS() - launchpad.TOTAL_FEE_BPS()
        );
    }

    function test_Graduation_PhaseRefundAndClose() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        uint256 aliceBefore = alice.balance;
        _fillCurve(token);

        {
            (, CoopLaunchpad.Phase phase,, uint256 vEth,) = _curve(token);
            assertEq(uint8(phase), uint8(CoopLaunchpad.Phase.Graduated));
            assertEq(vEth, launchpad.VIRTUAL_ETH_RESERVE() + launchpad.CURVE_TARGET_ETH());
            assertEq(launchpad.curveProgressBps(token), launchpad.BPS());
            assertTrue(CoopLaunchToken(token).graduated());
        }

        // Alice paid only what completing the curve cost; the surplus came back.
        assertEq(alice.balance, aliceBefore - _grossToFill());

        // Curve trading is closed.
        vm.prank(bob);
        vm.expectRevert(bytes("Launchpad: not trading"));
        launchpad.buy{value: 1 ether}(token, 0);
    }

    function test_Graduation_LocksFullRangeLiquidityAtCurvePrice() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        address pool = _fillCurve(token);

        // The locker owns a live full-range position.
        uint128 liq = _positionLiquidity(pool);
        assertGt(liq, 0);

        // Pool opens at the final curve price (WETH per token), within 0.1%.
        (,,, uint256 vEth, uint256 vToken) = _curve(token);
        uint256 curvePrice18 = vEth * 1e18 / vToken;
        assertApproxEqRel(_poolPriceWethPerToken(pool, token), curvePrice18, 1e15);

        // Launchpad keeps nothing: leftover tokens burned, no WETH stranded.
        assertEq(CoopLaunchToken(token).balanceOf(address(launchpad)), 0);
        assertEq(weth.balanceOf(address(launchpad)), 0);
        assertGt(CoopLaunchToken(token).balanceOf(DEAD), 0);

        // Every wei in the launchpad is claimable fees.
        assertEq(
            address(launchpad).balance,
            launchpad.feesOwed(platform) + launchpad.feesOwed(creator)
        );
    }

    function test_Graduation_FeesAccrued() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        _fillCurve(token);

        uint256 tradeFee = _grossToFill() - launchpad.CURVE_TARGET_ETH();
        // Platform gets half the trade fee + graduation fee (+ possible WETH dust).
        assertGe(launchpad.feesOwed(platform), tradeFee / 2 + launchpad.graduationFeeEth());
        assertEq(launchpad.feesOwed(creator), tradeFee - tradeFee / 2);
    }

    function test_Graduation_SurvivesPriceWalkGrief() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        address pool = uniFactory.getPool(token, address(weth), launchpad.POOL_FEE());

        // Attacker walks the empty pool's price far away before graduation.
        TestSwapRouter griefer = new TestSwapRouter();
        (uint160 sqrtBefore,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        griefer.walkPrice(pool, sqrtBefore * 4); // 16x the price
        (uint160 sqrtAfter,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        assertEq(sqrtAfter, sqrtBefore * 4);

        // Graduation re-aligns the price and still lands the position.
        _fillCurve(token);
        (,,, uint256 vEth, uint256 vToken) = _curve(token);
        assertApproxEqRel(
            _poolPriceWethPerToken(pool, token), vEth * 1e18 / vToken, 1e15
        );
        assertGt(_positionLiquidity(pool), 0);
    }

    function test_PostGraduation_SwapsWorkAndTokenIsClean() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        address pool = _fillCurve(token);

        TestSwapRouter router = new TestSwapRouter();
        // bob buys tokens with 0.1 WETH through the pool.
        vm.startPrank(bob);
        weth.deposit{value: 0.1 ether}();
        weth.transfer(address(router), 0.1 ether);
        vm.stopPrank();

        bool zeroForOne = address(weth) < token; // WETH in
        router.swapExactInput(pool, zeroForOne, 0.1 ether, bob);

        uint256 got = CoopLaunchToken(token).balanceOf(bob);
        assertGt(got, 0);

        // Clean token: transfers move the full amount, no tax anywhere.
        uint256 aliceBefore = CoopLaunchToken(token).balanceOf(alice);
        vm.prank(bob);
        CoopLaunchToken(token).transfer(alice, got);
        assertEq(CoopLaunchToken(token).balanceOf(alice), aliceBefore + got);
    }
}
