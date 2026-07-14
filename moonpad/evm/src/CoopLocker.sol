// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {IERC20Min, IUniswapV3PoolMin} from "./interfaces/IExternal.sol";
import {FullMath} from "./libs/FullMath.sol";
import {TickMath} from "./libs/TickMath.sol";

interface ICoopLaunchpadFees {
    function feeRecipient() external view returns (address);
}

/// @notice Holds every graduated token's full-range Uniswap v3 position forever.
/// There is deliberately NO function that can decrease liquidity — the position is
/// locked by construction. What the locker can do is collect the pool's 1% swap
/// fees (permissionlessly, by anyone) and route them:
///
///   Standard tokens:    all collected fees split 50/50 creator / platform.
///   LP-Growing tokens:  `reinvestBps` (70%) of collected fees is re-added to the
///                       locked position — liquidity permanently deepens with
///                       volume — and the remainder is split 50/50.
contract CoopLocker is ReentrancyGuard {
    int24 public constant TICK_LOWER = -887200;
    int24 public constant TICK_UPPER = 887200;
    uint256 public constant BPS = 10_000;
    uint256 public constant CREATOR_SHARE_BPS = 5_000; // of the payout portion

    struct Lock {
        address pool;
        address creator;
        uint16 reinvestBps;
    }

    address public immutable launchpad;

    mapping(address => Lock) public locks;

    // Set for the duration of a mint so the callback can verify the caller.
    address private _pendingPool;

    event PositionLocked(address indexed token, address indexed pool, uint16 reinvestBps);
    event FeesCollected(
        address indexed token,
        uint256 collected0,
        uint256 collected1,
        uint256 reinvested0,
        uint256 reinvested1,
        uint128 liquidityAdded
    );

    constructor(address launchpad_) {
        launchpad = launchpad_;
    }

    function register(address token, address pool, address creator, uint16 reinvestBps) external {
        require(msg.sender == launchpad, "Locker: not launchpad");
        require(locks[token].pool == address(0), "Locker: already locked");
        require(reinvestBps < BPS, "Locker: bad reinvest bps");
        locks[token] = Lock({pool: pool, creator: creator, reinvestBps: reinvestBps});
        emit PositionLocked(token, pool, reinvestBps);
    }

    /// @notice Collect the locked position's accrued swap fees for `token` and route
    /// them per the token's policy. Callable by anyone.
    function collect(address token) external nonReentrant {
        Lock memory lock = locks[token];
        require(lock.pool != address(0), "Locker: unknown token");
        IUniswapV3PoolMin pool = IUniswapV3PoolMin(lock.pool);

        // Poke the position so fees owed are up to date, then pull them here.
        pool.burn(TICK_LOWER, TICK_UPPER, 0);
        (uint128 collected0, uint128 collected1) =
            pool.collect(address(this), TICK_LOWER, TICK_UPPER, type(uint128).max, type(uint128).max);
        if (collected0 == 0 && collected1 == 0) return;

        address token0 = pool.token0();
        address token1 = pool.token1();

        uint256 spent0;
        uint256 spent1;
        uint128 liquidityAdded;
        if (lock.reinvestBps > 0) {
            (spent0, spent1, liquidityAdded) = _reinvest(
                pool,
                token0,
                token1,
                uint256(collected0) * lock.reinvestBps / BPS,
                uint256(collected1) * lock.reinvestBps / BPS
            );
        }

        _payout(token0, uint256(collected0) - spent0, lock.creator);
        _payout(token1, uint256(collected1) - spent1, lock.creator);

        emit FeesCollected(token, collected0, collected1, spent0, spent1, liquidityAdded);
    }

    function _reinvest(
        IUniswapV3PoolMin pool,
        address token0,
        address token1,
        uint256 budget0,
        uint256 budget1
    ) private returns (uint256 spent0, uint256 spent1, uint128 liquidityAdded) {
        {
            (uint160 sqrtP,,,,,,) = pool.slot0();
            liquidityAdded = _liquidityForAmounts(sqrtP, budget0, budget1);
        }
        if (liquidityAdded == 0) return (0, 0, 0);

        // Reuse the return slots as before-balances to stay within stack depth.
        spent0 = IERC20Min(token0).balanceOf(address(this));
        spent1 = IERC20Min(token1).balanceOf(address(this));

        _pendingPool = address(pool);
        pool.mint(address(this), TICK_LOWER, TICK_UPPER, liquidityAdded, abi.encode(token0, token1));
        _pendingPool = address(0);

        spent0 = spent0 - IERC20Min(token0).balanceOf(address(this));
        spent1 = spent1 - IERC20Min(token1).balanceOf(address(this));
    }

    function _payout(address asset, uint256 amount, address creator) private {
        if (amount == 0) return;
        uint256 bal = IERC20Min(asset).balanceOf(address(this));
        if (amount > bal) amount = bal;
        uint256 creatorShare = amount * CREATOR_SHARE_BPS / BPS;
        if (creatorShare > 0) {
            IERC20Min(asset).transfer(creator, creatorShare);
        }
        uint256 platformShare = amount - creatorShare;
        if (platformShare > 0) {
            IERC20Min(asset).transfer(ICoopLaunchpadFees(launchpad).feeRecipient(), platformShare);
        }
    }

    /// @dev Full-range liquidity fundable by (amount0, amount1) at price sqrtP.
    function _liquidityForAmounts(uint160 sqrtP, uint256 amount0, uint256 amount1)
        private
        pure
        returns (uint128)
    {
        uint160 sqrtL = TickMath.getSqrtRatioAtTick(TICK_LOWER);
        uint160 sqrtU = TickMath.getSqrtRatioAtTick(TICK_UPPER);
        uint256 q96 = 1 << 96;

        uint256 l0 = amount0 == 0
            ? 0
            : FullMath.mulDiv(amount0, FullMath.mulDiv(sqrtP, sqrtU, q96), sqrtU - sqrtP);
        uint256 l1 = amount1 == 0 ? 0 : FullMath.mulDiv(amount1, q96, sqrtP - sqrtL);

        uint256 liq = l0 < l1 ? l0 : l1;
        return liq > type(uint128).max ? 0 : uint128(liq);
    }

    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Locker: bad callback");
        (address token0, address token1) = abi.decode(data, (address, address));
        if (amount0Owed > 0) IERC20Min(token0).transfer(msg.sender, amount0Owed);
        if (amount1Owed > 0) IERC20Min(token1).transfer(msg.sender, amount1Owed);
    }

    /// @notice Position key of a locked token's position, for off-chain inspection.
    function positionKey() external view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), TICK_LOWER, TICK_UPPER));
    }
}
