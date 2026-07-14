// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";
import {CoopLocker} from "../src/CoopLocker.sol";
import {IUniswapV3FactoryMin, IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";
import {WETH9Mock} from "./mocks/WETH9Mock.sol";

abstract contract BaseSetup is Test {
    CoopLaunchpad internal launchpad;
    CoopLocker internal locker;
    WETH9Mock internal weth;
    IUniswapV3FactoryMin internal uniFactory;

    address internal platform = makeAddr("platform");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal attacker = makeAddr("attacker");

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal saltNonce;

    function setUp() public virtual {
        weth = new WETH9Mock();
        uniFactory = IUniswapV3FactoryMin(
            deployCode("UniswapV3Factory.sol:UniswapV3Factory")
        );
        launchpad = new CoopLaunchpad(address(uniFactory), address(weth), platform);
        locker = launchpad.locker();

        vm.deal(creator, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(attacker, 100 ether);
    }

    /// @dev Creates a token and (by default) warps past the anti-snipe window so
    /// ordinary tests can trade freely.
    function _create(CoopLaunchpad.Flavor flavor) internal returns (address token) {
        token = _createNoWarp(flavor);
        vm.warp(block.timestamp + launchpad.SNIPE_WINDOW() + 1);
    }

    function _createNoWarp(CoopLaunchpad.Flavor flavor) internal returns (address token) {
        vm.prank(creator);
        token = launchpad.createToken(
            "Hen Coin", "HEN", "ipfs://hen-metadata", flavor, 0, bytes32(++saltNonce)
        );
    }

    /// @dev One oversized buy from alice completes the curve and triggers graduation.
    function _fillCurve(address token) internal returns (address pool) {
        vm.prank(alice);
        launchpad.buy{value: 5 ether}(token, 0);
        pool = uniFactory.getPool(token, address(weth), launchpad.POOL_FEE());
    }

    function _curve(address token)
        internal
        view
        returns (
            address creator_,
            CoopLaunchpad.Phase phase,
            CoopLaunchpad.Flavor flavor,
            uint256 vEth,
            uint256 vToken
        )
    {
        (address c, CoopLaunchpad.Phase p, CoopLaunchpad.Flavor f,, uint128 e, uint128 t) =
            launchpad.curves(token);
        return (c, p, f, uint256(e), uint256(t));
    }

    function _positionLiquidity(address pool) internal view returns (uint128 liq) {
        bytes32 key = keccak256(
            abi.encodePacked(address(locker), launchpad.TICK_LOWER(), launchpad.TICK_UPPER())
        );
        (liq,,,,) = IUniswapV3PoolMin(pool).positions(key);
    }

    /// @dev Pool spot price as WETH-per-token, 1e18-scaled float-ish integer.
    function _poolPriceWethPerToken(address pool, address token) internal view returns (uint256) {
        (uint160 sqrtP,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        // price(token1 per token0) = (sqrtP/2^96)^2
        uint256 p18 = FullMathLocal.mulDiv(
            FullMathLocal.mulDiv(sqrtP, sqrtP, 1 << 96), 1e18, 1 << 96
        );
        // If token is token0, p18 already is WETH per token; else invert.
        if (token < address(weth)) return p18;
        return p18 == 0 ? 0 : 1e36 / p18;
    }
}

library FullMathLocal {
    function mulDiv(uint256 a, uint256 b, uint256 d) internal pure returns (uint256) {
        return (a * b) / d; // fine for test-scale magnitudes
    }
}
