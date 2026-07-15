// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetupV2} from "./BaseSetupV2.sol";
import {CoopLaunchpadV2} from "../src/CoopLaunchpadV2.sol";
import {CoopLaunchTokenV2} from "../src/tokens/CoopLaunchTokenV2.sol";
import {IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";

contract V2LaunchpadTest is BaseSetupV2 {
    function test_Launch_CreatesPoolWithFullSupplyLocked() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);
        address pool = _pool(token);

        assertTrue(pool != address(0), "pool created");
        (uint160 sqrtP, int24 tick,,,,,) = IUniswapV3PoolMin(pool).slot0();
        assertGt(sqrtP, 0, "pool initialized");
        tick; // orientation-dependent; presence of price is what matters

        // Entire supply is either in the pool or burned dust; launchpad keeps 0.
        CoopLaunchTokenV2 t = CoopLaunchTokenV2(token);
        assertEq(t.balanceOf(address(launchpad)), 0, "launchpad keeps nothing");
        assertEq(
            t.balanceOf(pool) + t.balanceOf(DEAD),
            t.TOTAL_SUPPLY(),
            "supply fully pooled or burned"
        );
        assertGt(_positionLiquidity(token), 0, "locker owns liquidity");

        (address creator_, address pool_,,,) = launchpad.launches(token);
        assertEq(creator_, creator);
        assertEq(pool_, pool);
    }

    function test_Launch_BuyThenSellRoundTrip() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);

        uint256 got = _buy(token, 1 ether, alice);
        assertGt(got, 0, "buy delivered tokens");

        uint256 ethBack = _sell(token, got, alice);
        assertGt(ethBack, 0.9 ether, "sell returns most of the ETH");
        assertLt(ethBack, 1 ether, "pool fee was charged");
    }

    function test_Launch_PriceRisesWithBuys() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);

        uint256 out1 = _buy(token, 1 ether, alice);
        uint256 out2 = _buy(token, 1 ether, bob);
        assertLt(out2, out1, "same ETH buys fewer tokens as price climbs");
    }

    function test_Launch_DevBuyAtomicInLaunchBlock() public {
        address token = _launchNoWarp(CoopLaunchpadV2.Flavor.Standard, 1 ether);
        assertGt(CoopLaunchTokenV2(token).balanceOf(creator), 0, "creator got dev buy tokens");
    }

    function test_Launch_VanityAddressIsPredictable() public {
        bytes32 salt = bytes32(uint256(0xC00));
        address predicted = launchpad.predictTokenAddress(
            "Hen Coin", "HEN", "ipfs://hen-metadata", CoopLaunchpadV2.Flavor.LPGrow, salt, creator
        );
        vm.prank(creator);
        address token = launchpad.launchToken(
            "Hen Coin", "HEN", "ipfs://hen-metadata", CoopLaunchpadV2.Flavor.LPGrow, salt, 0
        );
        assertEq(token, predicted, "CREATE2 address matches prediction");
    }

    function test_Launch_RevertsWhenPoolPreCreated() public {
        bytes32 salt = bytes32(uint256(0xBAD));
        address predicted = launchpad.predictTokenAddress(
            "Hen Coin", "HEN", "ipfs://hen-metadata", CoopLaunchpadV2.Flavor.Standard, salt, creator
        );
        vm.prank(attacker);
        uniFactory.createPool(predicted, address(weth), launchpad.POOL_FEE());

        vm.prank(creator);
        vm.expectRevert(bytes("Launchpad: pool exists"));
        launchpad.launchToken(
            "Hen Coin", "HEN", "ipfs://hen-metadata", CoopLaunchpadV2.Flavor.Standard, salt, 0
        );
    }

    function test_GraduationStatus_FlipsAtThreshold() public {
        address token = _launch(CoopLaunchpadV2.Flavor.Standard);

        (uint256 principal0,, bool graduated0) = launchpad.graduationStatus(token);
        assertEq(principal0, 0, "starts with zero WETH principal");
        assertFalse(graduated0);

        _buy(token, 1 ether, alice);
        (uint256 principal1,, bool graduated1) = launchpad.graduationStatus(token);
        assertGt(principal1, 0.9 ether, "principal tracks buys");
        assertFalse(graduated1, "1 ETH is below threshold");

        _buy(token, 3 ether, bob);
        (uint256 principal2, uint256 threshold, bool graduated2) = launchpad.graduationStatus(token);
        assertGe(principal2, threshold, "threshold crossed");
        assertTrue(graduated2, "graduated badge on");
    }

    function test_Launch_MetadataReadableFromToken() public {
        address token = _launch(CoopLaunchpadV2.Flavor.SuperLP);
        CoopLaunchTokenV2 t = CoopLaunchTokenV2(token);
        assertEq(t.name(), "Hen Coin");
        assertEq(t.symbol(), "HEN");
        assertEq(t.metadataURI(), "ipfs://hen-metadata");
        assertEq(t.creator(), creator);
        assertEq(t.buyTaxBps(), launchpad.SUPER_LP_BUY_TAX_BPS());
    }
}
