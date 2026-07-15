// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {IERC20Min, IUniswapV3PoolMin} from "./interfaces/IExternal.sol";
import {LiquidityAmounts} from "./libs/LiquidityAmounts.sol";
import {TickMath} from "./libs/TickMath.sol";

interface ICoopLaunchpadV2Fees {
    function feeRecipient() external view returns (address);
}

/// @notice Holds every Coop v2 token's single-sided Uniswap v3 launch position
/// forever. There is deliberately NO function that can decrease liquidity —
/// the position is locked by construction. What the locker can do is collect
/// the pool's 1% swap fees (permissionlessly, by anyone) and route them:
///
///   Standard:   all collected fees split 50/50 creator / platform.
///   LP-Growing: `reinvestBps` (70%) of collected fees is re-added to the
///               locked position; the remainder is split 50/50.
///   Super LP:   the token's permanent 5% buy tax lands on this contract and
///               is paired with `reinvestBps` (50%) of collected fees to mint
///               more locked liquidity; the remaining fees split 50/50.
contract CoopLockerV2 is ReentrancyGuard {
    uint256 public constant BPS = 10_000;
    uint256 public constant CREATOR_SHARE_BPS = 5_000; // of the payout portion

    struct Lock {
        address pool;
        address creator;
        uint16 reinvestBps;
        int24 tickLower;
        int24 tickUpper;
    }

    address public immutable launchpad;

    mapping(address => Lock) public locks;

    // Set for the duration of a mint so the callback can verify the caller.
    address private _pendingPool;

    event PositionLocked(
        address indexed token, address indexed pool, uint16 reinvestBps, int24 tickLower, int24 tickUpper
    );
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

    function register(
        address token,
        address pool,
        address creator,
        uint16 reinvestBps,
        int24 tickLower,
        int24 tickUpper
    ) external {
        require(msg.sender == launchpad, "Locker: not launchpad");
        require(locks[token].pool == address(0), "Locker: already locked");
        require(reinvestBps < BPS, "Locker: bad reinvest bps");
        locks[token] =
            Lock({pool: pool, creator: creator, reinvestBps: reinvestBps, tickLower: tickLower, tickUpper: tickUpper});
        emit PositionLocked(token, pool, reinvestBps, tickLower, tickUpper);
    }

    /// @notice Collect the locked position's accrued swap fees for `token` and
    /// route them per the token's policy. Callable by anyone. For Super LP
    /// tokens the buy-tax balance sitting on this contract joins the reinvest
    /// budget, so calling collect also compounds the tax into liquidity.
    ///
    /// Budget accounting: the launch-token side may persist on this contract
    /// between collects (the balance is unique to that token, so tax and
    /// unspent reinvest budget safely accumulate). The paired side (WETH) is
    /// shared across every lock, so it is always flushed within the same call:
    /// whatever the reinvest doesn't spend is paid out immediately.
    function collect(address token) external nonReentrant {
        Lock memory lock = locks[token];
        require(lock.pool != address(0), "Locker: unknown token");
        IUniswapV3PoolMin pool = IUniswapV3PoolMin(lock.pool);

        // Poke the position so fees owed are up to date, then pull them here.
        pool.burn(lock.tickLower, lock.tickUpper, 0);
        (uint128 collected0, uint128 collected1) =
            pool.collect(address(this), lock.tickLower, lock.tickUpper, type(uint128).max, type(uint128).max);

        bool tokenIs0 = token == pool.token0();

        uint256 payoutTok;
        uint256 spent0;
        uint256 spent1;
        uint128 liquidityAdded;
        {
            // Launch-token side: everything on the contract except this
            // collect's payout share is reinvest budget (tax + leftovers).
            payoutTok = (tokenIs0 ? uint256(collected0) : uint256(collected1)) * (BPS - lock.reinvestBps) / BPS;
            uint256 budgetTok = IERC20Min(token).balanceOf(address(this)) - payoutTok;
            // Paired side: only this collect's reinvest share, never the balance.
            uint256 budgetPair = (tokenIs0 ? uint256(collected1) : uint256(collected0)) * lock.reinvestBps / BPS;
            if (lock.reinvestBps > 0 && (budgetTok > 0 || budgetPair > 0)) {
                (spent0, spent1, liquidityAdded) = _reinvest(
                    pool, lock, tokenIs0 ? budgetTok : budgetPair, tokenIs0 ? budgetPair : budgetTok
                );
            }
        }

        // Flush the paired side completely: payout share + unspent reinvest share.
        uint256 payoutPair =
            (tokenIs0 ? uint256(collected1) : uint256(collected0)) - (tokenIs0 ? spent1 : spent0);

        if (payoutTok == 0 && payoutPair == 0 && liquidityAdded == 0) return;

        _payout(token, payoutTok, lock.creator);
        _payout(tokenIs0 ? pool.token1() : pool.token0(), payoutPair, lock.creator);

        emit FeesCollected(token, collected0, collected1, spent0, spent1, liquidityAdded);
    }

    function _reinvest(IUniswapV3PoolMin pool, Lock memory lock, uint256 budget0, uint256 budget1)
        private
        returns (uint256 spent0, uint256 spent1, uint128 liquidityAdded)
    {
        {
            (uint160 sqrtP,,,,,,) = pool.slot0();
            liquidityAdded = LiquidityAmounts.getLiquidityForAmounts(
                sqrtP,
                TickMath.getSqrtRatioAtTick(lock.tickLower),
                TickMath.getSqrtRatioAtTick(lock.tickUpper),
                budget0,
                budget1
            );
        }
        if (liquidityAdded == 0) return (0, 0, 0);

        address token0 = pool.token0();
        address token1 = pool.token1();

        // Reuse the return slots as before-balances to stay within stack depth.
        spent0 = IERC20Min(token0).balanceOf(address(this));
        spent1 = IERC20Min(token1).balanceOf(address(this));

        _pendingPool = address(pool);
        pool.mint(address(this), lock.tickLower, lock.tickUpper, liquidityAdded, abi.encode(token0, token1));
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
            IERC20Min(asset).transfer(ICoopLaunchpadV2Fees(launchpad).feeRecipient(), platformShare);
        }
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
    function positionKey(address token) external view returns (bytes32) {
        Lock memory lock = locks[token];
        return keccak256(abi.encodePacked(address(this), lock.tickLower, lock.tickUpper));
    }
}
