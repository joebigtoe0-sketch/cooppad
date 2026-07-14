// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Min, IUniswapV3PoolMin} from "../../src/interfaces/IExternal.sol";

/// @notice Minimal v3 swap executor for tests: pre-fund it with the input token,
/// then call swapExactInput. Pays the pool from its own balance in the callback.
contract TestSwapRouter {
    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO =
        1461446703485210103287273052203988822378723970342;

    address private pendingPool;

    function swapExactInput(address pool, bool zeroForOne, uint256 amountIn, address recipient)
        external
        returns (int256 amount0, int256 amount1)
    {
        pendingPool = pool;
        (amount0, amount1) = IUniswapV3PoolMin(pool).swap(
            recipient,
            zeroForOne,
            int256(amountIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            ""
        );
        pendingPool = address(0);
    }

    /// @notice Walk an (empty) pool's price to a target without meaningful input —
    /// the griefing primitive our graduation must survive.
    function walkPrice(address pool, uint160 targetSqrtPriceX96) external {
        (uint160 current,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        if (current == targetSqrtPriceX96) return;
        pendingPool = pool;
        IUniswapV3PoolMin(pool).swap(
            address(this), current > targetSqrtPriceX96, int256(1), targetSqrtPriceX96, ""
        );
        pendingPool = address(0);
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata)
        external
    {
        require(msg.sender == pendingPool, "TestRouter: bad callback");
        if (amount0Delta > 0) {
            IERC20Min(IUniswapV3PoolMin(msg.sender).token0()).transfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            IERC20Min(IUniswapV3PoolMin(msg.sender).token1()).transfer(msg.sender, uint256(amount1Delta));
        }
    }
}
