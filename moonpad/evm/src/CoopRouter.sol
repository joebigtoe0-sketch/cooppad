// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {IERC20Min, IUniswapV3FactoryMin, IUniswapV3PoolMin, IWETHMin} from "./interfaces/IExternal.sol";

/**
 * @title CoopRouter
 * @notice Minimal ETH <-> token router for Coop v2 pools (Uniswap v3 core, no
 * periphery dependency). Buys wrap ETH and swap; sells swap and unwrap back to
 * ETH. Both return amountOut so the UI can quote via eth_call simulation.
 * Stateless between calls; never holds user funds beyond a transaction.
 */
contract CoopRouter is ReentrancyGuard {
    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    IUniswapV3FactoryMin public immutable uniswapFactory;
    IWETHMin public immutable weth;

    address private _pendingPool;

    constructor(address uniswapFactory_, address weth_) {
        require(uniswapFactory_ != address(0) && weth_ != address(0), "Router: zero address");
        uniswapFactory = IUniswapV3FactoryMin(uniswapFactory_);
        weth = IWETHMin(weth_);
    }

    receive() external payable {
        require(msg.sender == address(weth), "Router: no direct ETH");
    }

    /// @notice Swap exact ETH (msg.value) for `token`, delivered to `recipient`.
    function buyExactEth(address token, uint24 fee, uint256 minTokensOut, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        require(msg.value > 0, "Router: zero input");
        IUniswapV3PoolMin pool = _poolOf(token, fee);
        weth.deposit{value: msg.value}();

        // Measure what the recipient actually receives — for Super LP tokens
        // the 5% buy tax is skimmed between the pool and the buyer, so the
        // pool's swap delta overstates the delivered amount.
        uint256 before = IERC20Min(token).balanceOf(recipient);

        bool zeroForOne = address(weth) < token; // WETH in
        _pendingPool = address(pool);
        pool.swap(
            recipient,
            zeroForOne,
            int256(msg.value),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            ""
        );
        _pendingPool = address(0);

        tokensOut = IERC20Min(token).balanceOf(recipient) - before;
        require(tokensOut >= minTokensOut, "Router: slippage");
    }

    /// @notice Swap exact `amountIn` of `token` (caller must approve) for ETH.
    function sellExactTokens(
        address token,
        uint24 fee,
        uint256 amountIn,
        uint256 minEthOut,
        address recipient
    ) external nonReentrant returns (uint256 ethOut) {
        require(amountIn > 0, "Router: zero input");
        IUniswapV3PoolMin pool = _poolOf(token, fee);
        IERC20Min(token).transferFrom(msg.sender, address(this), amountIn);

        bool zeroForOne = token < address(weth); // token in
        _pendingPool = address(pool);
        (int256 amount0, int256 amount1) = pool.swap(
            address(this),
            zeroForOne,
            int256(amountIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            ""
        );
        _pendingPool = address(0);

        ethOut = uint256(-(zeroForOne ? amount1 : amount0));
        require(ethOut >= minEthOut, "Router: slippage");
        weth.withdraw(ethOut);
        (bool sent,) = payable(recipient).call{value: ethOut}("");
        require(sent, "Router: eth send failed");
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata)
        external
    {
        require(msg.sender == _pendingPool, "Router: bad callback");
        IUniswapV3PoolMin pool = IUniswapV3PoolMin(msg.sender);
        if (amount0Delta > 0) {
            IERC20Min(pool.token0()).transfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            IERC20Min(pool.token1()).transfer(msg.sender, uint256(amount1Delta));
        }
    }

    function _poolOf(address token, uint24 fee) private view returns (IUniswapV3PoolMin) {
        address pool = uniswapFactory.getPool(token, address(weth), fee);
        require(pool != address(0), "Router: no pool");
        return IUniswapV3PoolMin(pool);
    }
}
