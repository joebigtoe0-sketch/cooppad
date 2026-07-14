// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";
import {CoopLaunchToken} from "../src/tokens/CoopLaunchToken.sol";
import {IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";

contract CoopLaunchpadTest is BaseSetup {
    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return (a + b - 1) / b;
    }

    function test_CreateToken_InitializesCurveAndPool() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);

        (address creator_, CoopLaunchpad.Phase phase,, uint256 vEth, uint256 vToken) = _curve(token);
        assertEq(creator_, creator);
        assertEq(uint8(phase), uint8(CoopLaunchpad.Phase.Trading));
        assertEq(vEth, launchpad.VIRTUAL_ETH_RESERVE());
        assertEq(vToken, launchpad.VIRTUAL_TOKEN_RESERVE());

        CoopLaunchToken t = CoopLaunchToken(token);
        assertEq(t.balanceOf(address(launchpad)), t.TOTAL_SUPPLY());
        assertEq(t.metadataURI(), "ipfs://hen-metadata");

        // The v3 pool exists and is initialized from the moment of creation.
        address pool = uniFactory.getPool(token, address(weth), launchpad.POOL_FEE());
        assertTrue(pool != address(0));
        (uint160 sqrtP,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        assertGt(sqrtP, 0);

        assertEq(launchpad.allTokensLength(), 1);
        assertEq(launchpad.curveProgressBps(token), 0);
    }

    function test_CreateToken_VanityAddressIsPredictable() public {
        bytes32 salt = keccak256("feed-salt");
        address predicted =
            launchpad.predictTokenAddress("Hen Coin", "HEN", "ipfs://hen-metadata", salt);
        vm.prank(creator);
        address token =
            launchpad.createToken("Hen Coin", "HEN", "ipfs://hen-metadata", CoopLaunchpad.Flavor.Standard, 0, salt);
        assertEq(token, predicted);
    }

    function test_CreateToken_WithDevBuy() public {
        uint256 vEth = launchpad.VIRTUAL_ETH_RESERVE();
        uint256 vToken = launchpad.VIRTUAL_TOKEN_RESERVE();
        uint256 fee = uint256(1 ether) * launchpad.TOTAL_FEE_BPS() / launchpad.BPS();
        uint256 net = 1 ether - fee;
        uint256 expectedOut = vToken - _ceilDiv(vEth * vToken, vEth + net);

        // Dev buy is way above the 2% snipe cap — the creator is exempt.
        vm.prank(creator);
        address token = launchpad.createToken{value: 1 ether}(
            "Hen Coin", "HEN", "ipfs://x", CoopLaunchpad.Flavor.Standard, expectedOut, bytes32(++saltNonce)
        );

        assertEq(CoopLaunchToken(token).balanceOf(creator), expectedOut);
        assertEq(launchpad.feesOwed(platform), fee / 2);
        assertEq(launchpad.feesOwed(creator), fee - fee / 2);
    }

    function test_Buy_MatchesQuote() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        (,,, uint256 vEth0,) = _curve(token);

        (uint256 qTokens, uint256 qFee, uint256 qUsed, uint256 qRefund) = launchpad.quoteBuy(token, 2 ether);
        assertEq(qUsed, 2 ether);
        assertEq(qRefund, 0);

        vm.prank(alice);
        launchpad.buy{value: 2 ether}(token, qTokens);

        assertEq(CoopLaunchToken(token).balanceOf(alice), qTokens);
        (,,, uint256 vEth1,) = _curve(token);
        assertEq(vEth1, vEth0 + (2 ether - qFee));
        assertEq(address(launchpad).balance, 2 ether);
    }

    function test_Buy_SlippageReverts() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        (uint256 qTokens,,,) = launchpad.quoteBuy(token, 1 ether);

        vm.prank(alice);
        vm.expectRevert(bytes("Launchpad: slippage"));
        launchpad.buy{value: 1 ether}(token, qTokens + 1);
    }

    function test_Sell_RoundTrip() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        (,,,, uint256 vTokenStart) = _curve(token);

        vm.prank(alice);
        launchpad.buy{value: 1 ether}(token, 0);
        uint256 held = CoopLaunchToken(token).balanceOf(alice);

        (uint256 qEth,) = launchpad.quoteSell(token, held);
        assertGt(qEth, 0.97 ether);
        assertLt(qEth, 0.99 ether);

        uint256 balBefore = alice.balance;
        vm.startPrank(alice);
        CoopLaunchToken(token).approve(address(launchpad), held);
        launchpad.sell(token, held, qEth);
        vm.stopPrank();

        assertEq(alice.balance, balBefore + qEth);
        (,,,, uint256 vTokenEnd) = _curve(token);
        assertEq(vTokenEnd, vTokenStart);

        uint256 feesSum = launchpad.feesOwed(platform) + launchpad.feesOwed(creator);
        assertGe(address(launchpad).balance, feesSum);
        assertApproxEqAbs(address(launchpad).balance, feesSum, 10);
    }

    function test_TransferLockedBeforeGraduation() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        vm.prank(alice);
        launchpad.buy{value: 1 ether}(token, 0);

        vm.prank(alice);
        vm.expectRevert(bytes("CoopToken: locked until graduation"));
        CoopLaunchToken(token).transfer(bob, 1 ether);
    }

    function test_ClaimFees() public {
        address token = _create(CoopLaunchpad.Flavor.Standard);
        vm.prank(alice);
        launchpad.buy{value: 2 ether}(token, 0);

        uint256 owed = launchpad.feesOwed(creator);
        assertGt(owed, 0);

        uint256 balBefore = creator.balance;
        vm.prank(creator);
        launchpad.claimFees();
        assertEq(creator.balance, balBefore + owed);

        vm.prank(creator);
        vm.expectRevert(bytes("Launchpad: nothing to claim"));
        launchpad.claimFees();
    }

    function test_Setters_OnlyOwnerAndCaps() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Ownable: not owner"));
        launchpad.setFeeRecipient(alice);

        launchpad.setGraduationFee(0.2 ether);
        assertEq(launchpad.graduationFeeEth(), 0.2 ether);

        vm.expectRevert(bytes("Launchpad: fee too high"));
        launchpad.setGraduationFee(0.4 ether);
    }

    function testFuzz_BuySellSolvency(uint256 buy1, uint256 buy2, uint256 sellPct) public {
        buy1 = bound(buy1, 0.001 ether, 3 ether);
        buy2 = bound(buy2, 0.001 ether, 3 ether);
        sellPct = bound(sellPct, 10, 100);

        address token = _create(CoopLaunchpad.Flavor.Standard);
        vm.prank(alice);
        launchpad.buy{value: buy1}(token, 0);
        vm.prank(bob);
        launchpad.buy{value: buy2}(token, 0);

        (, CoopLaunchpad.Phase phase,, uint256 vEth,) = _curve(token);
        if (phase == CoopLaunchpad.Phase.Trading) {
            uint256 toSell = CoopLaunchToken(token).balanceOf(alice) * sellPct / 100;
            vm.startPrank(alice);
            CoopLaunchToken(token).approve(address(launchpad), toSell);
            launchpad.sell(token, toSell, 0);
            vm.stopPrank();
            (,,, vEth,) = _curve(token);
        }

        uint256 owed = launchpad.feesOwed(platform) + launchpad.feesOwed(creator);
        uint256 raisedOnCurve =
            phase == CoopLaunchpad.Phase.Trading ? vEth - launchpad.VIRTUAL_ETH_RESERVE() : 0;
        assertGe(address(launchpad).balance, raisedOnCurve + owed);
    }
}
