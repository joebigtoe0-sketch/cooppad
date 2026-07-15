// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CoopLaunchpadV2} from "../src/CoopLaunchpadV2.sol";
import {CoopLockerV2} from "../src/CoopLockerV2.sol";
import {CoopLaunchTokenV2} from "../src/tokens/CoopLaunchTokenV2.sol";
import {IUniswapV3FactoryMin, IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";
import {WETH9Mock} from "./mocks/WETH9Mock.sol";
import {TestSwapRouter} from "./utils/TestSwapRouter.sol";

abstract contract BaseSetupV2 is Test {
    CoopLaunchpadV2 internal launchpad;
    CoopLockerV2 internal locker;
    WETH9Mock internal weth;
    IUniswapV3FactoryMin internal uniFactory;
    TestSwapRouter internal router;

    address internal platform = makeAddr("platform");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal attacker = makeAddr("attacker");

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal saltNonce;

    function setUp() public virtual {
        weth = new WETH9Mock();
        uniFactory = IUniswapV3FactoryMin(deployCode("UniswapV3Factory.sol:UniswapV3Factory"));
        launchpad = new CoopLaunchpadV2(address(uniFactory), address(weth), platform);
        locker = launchpad.locker();
        router = new TestSwapRouter();

        vm.deal(creator, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(attacker, 100 ether);
        vm.deal(address(this), 500 ether);
    }

    /// @dev Launches a token and warps past the anti-snipe window so ordinary
    /// tests can trade freely.
    function _launch(CoopLaunchpadV2.Flavor flavor) internal returns (address token) {
        token = _launchNoWarp(flavor, 0);
        vm.warp(block.timestamp + 121);
        vm.roll(block.number + 1);
    }

    function _launchNoWarp(CoopLaunchpadV2.Flavor flavor, uint256 devBuyEth)
        internal
        returns (address token)
    {
        vm.prank(creator);
        token = launchpad.launchToken{value: devBuyEth}(
            "Hen Coin", "HEN", "ipfs://hen-metadata", flavor, bytes32(++saltNonce), 0
        );
    }

    function _pool(address token) internal view returns (address) {
        return uniFactory.getPool(token, address(weth), launchpad.POOL_FEE());
    }

    /// @dev Buys `ethIn` worth of `token` for `recipient` through the test router.
    function _buy(address token, uint256 ethIn, address recipient) internal returns (uint256 out) {
        weth.deposit{value: ethIn}();
        weth.transfer(address(router), ethIn);
        bool wethIsToken0 = address(weth) < token;
        uint256 before = CoopLaunchTokenV2(token).balanceOf(recipient);
        router.swapExactInput(_pool(token), wethIsToken0, ethIn, recipient);
        out = CoopLaunchTokenV2(token).balanceOf(recipient) - before;
    }

    /// @dev Sells `amount` of `seller`'s tokens for WETH through the test router.
    function _sell(address token, uint256 amount, address seller) internal returns (uint256 out) {
        vm.prank(seller);
        CoopLaunchTokenV2(token).transfer(address(router), amount);
        bool tokenIs0 = token < address(weth);
        uint256 before = weth.balanceOf(seller);
        router.swapExactInput(_pool(token), tokenIs0, amount, seller);
        out = weth.balanceOf(seller) - before;
    }

    function _positionLiquidity(address token) internal view returns (uint128 liq) {
        (liq,,,,) = IUniswapV3PoolMin(_pool(token)).positions(locker.positionKey(token));
    }
}
