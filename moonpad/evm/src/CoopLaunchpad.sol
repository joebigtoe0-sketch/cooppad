// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./base/Ownable.sol";
import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {CoopLocker} from "./CoopLocker.sol";
import {CoopLaunchToken} from "./tokens/CoopLaunchToken.sol";
import {ICoopLaunchToken} from "./interfaces/ICoopLaunchToken.sol";
import {
    IERC20Min,
    IWETHMin,
    IUniswapV3FactoryMin,
    IUniswapV3PoolMin
} from "./interfaces/IExternal.sol";
import {FullMath} from "./libs/FullMath.sol";
import {TickMath} from "./libs/TickMath.sol";

/// @notice Coop's bonding curve launchpad for Robinhood Chain.
///
/// Every launch deploys a fresh, fully clean 1B-supply ERC20 (CREATE2, so addresses
/// can be vanity-mined) held entirely by this contract and traded on a
/// constant-product curve with virtual reserves (x * y = k). Buys pay ETH in, sells
/// take ETH out; both pay a 1% fee split between platform and creator. For the first
/// SNIPE_WINDOW seconds after launch, non-creator wallets can accumulate at most 2%
/// of supply (the creator's atomic dev buy is exempt).
///
/// When 3.5 ETH (net) has been raised the curve completes: the raised ETH minus a
/// flat graduation fee is paired with the remaining tokens into a full-range
/// **Uniswap v3 position at the 1% fee tier**, opened at the exact final curve
/// price. The position is held forever by the CoopLocker — liquidity can never be
/// pulled, while the pool's swap fees stream to the creator and platform (and, for
/// LP-Growing tokens, back into the locked position).
///
/// Virtual reserve parameters mirror pump.fun's shape scaled to a 3.5 ETH raise:
/// start 1.25 virtual ETH / 1.073B virtual tokens, so ~790.6M tokens sell on the
/// curve and ~209.4M remain for liquidity at graduation.
contract CoopLaunchpad is Ownable, ReentrancyGuard {
    enum Flavor {
        Standard, // pool fees split creator/platform
        LPGrow // 70% of pool fees reinvested into the locked position
    }

    enum Phase {
        None,
        Trading,
        Graduated
    }

    struct Curve {
        address creator;
        Phase phase;
        Flavor flavor;
        uint40 createdAt;
        uint128 vEth;
        uint128 vToken;
    }

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant VIRTUAL_ETH_RESERVE = 1.25 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_073_000_000 ether;
    uint256 public constant CURVE_TARGET_ETH = 3.5 ether;

    uint256 public constant PLATFORM_FEE_BPS = 50; // 0.5%
    uint256 public constant CREATOR_FEE_BPS = 50; // 0.5%
    uint256 public constant TOTAL_FEE_BPS = PLATFORM_FEE_BPS + CREATOR_FEE_BPS;
    uint256 public constant BPS = 10_000;

    uint256 public constant MAX_GRADUATION_FEE = 0.35 ether; // 10% of the raise

    /// @dev Anti-snipe: cumulative buy cap per non-creator wallet right after launch.
    uint256 public constant SNIPE_WINDOW = 120; // seconds
    uint256 public constant SNIPE_MAX_TOKENS = TOTAL_SUPPLY * 200 / 10_000; // 2% of supply

    uint24 public constant POOL_FEE = 10_000; // Uniswap v3 1% tier
    int24 public constant TICK_LOWER = -887200; // full range at tickSpacing 200
    int24 public constant TICK_UPPER = 887200;
    uint16 public constant LP_GROW_REINVEST_BPS = 7_000;

    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IUniswapV3FactoryMin public immutable uniswapFactory;
    address public immutable weth;
    CoopLocker public immutable locker;

    address public feeRecipient;
    uint256 public graduationFeeEth = 0.1 ether;

    mapping(address => Curve) public curves;
    address[] public allTokens;

    /// @notice Claimable ETH per address: platform trade fees, creator trade fees,
    /// and graduation fees all accrue here.
    mapping(address => uint256) public feesOwed;

    /// @notice Tokens bought per wallet during a token's anti-snipe window.
    mapping(address => mapping(address => uint256)) public earlyBuys;

    // Set for the duration of a pool mint/swap so callbacks can verify the caller.
    address private _pendingPool;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        Flavor flavor,
        string name,
        string symbol,
        string metadataURI
    );
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 feeEth,
        uint256 vEthAfter,
        uint256 vTokenAfter
    );
    event Graduated(
        address indexed token,
        address indexed pool,
        uint256 ethLiquidity,
        uint256 tokenLiquidity,
        uint256 tokensBurned,
        uint128 liquidity
    );
    event FeesClaimed(address indexed account, uint256 amount);
    event FeeRecipientUpdated(address indexed recipient);
    event GraduationFeeUpdated(uint256 fee);

    constructor(address uniswapV3Factory_, address weth_, address feeRecipient_)
        Ownable(msg.sender)
    {
        require(uniswapV3Factory_ != address(0) && weth_ != address(0), "Launchpad: zero uniswap");
        require(feeRecipient_ != address(0), "Launchpad: zero fee recipient");
        uniswapFactory = IUniswapV3FactoryMin(uniswapV3Factory_);
        weth = weth_;
        feeRecipient = feeRecipient_;
        locker = new CoopLocker(address(this));
    }

    receive() external payable {} // WETH withdrawals during graduation

    // ---------------------------------------------------------------- launches

    /// @notice Launch a new token. Creation is free (gas only); any ETH sent along
    /// is an atomic dev buy executed before anyone else can trade. `salt` fixes the
    /// CREATE2 token address (vanity-mined off-chain to end in the coop suffix).
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        Flavor flavor,
        uint256 minTokensOut,
        bytes32 salt
    ) external payable nonReentrant returns (address token) {
        token = address(new CoopLaunchToken{salt: salt}(name, symbol, metadataURI));

        curves[token] = Curve({
            creator: msg.sender,
            phase: Phase.Trading,
            flavor: flavor,
            createdAt: uint40(block.timestamp),
            vEth: uint128(VIRTUAL_ETH_RESERVE),
            vToken: uint128(VIRTUAL_TOKEN_RESERVE)
        });
        allTokens.push(token);

        // Create + initialize the pool now, at the (deterministic) graduation price,
        // so launch-time state is ours. Graduation re-aligns the price regardless.
        _ensurePool(token, VIRTUAL_ETH_RESERVE + CURVE_TARGET_ETH, _finalVTokenTheoretical());

        emit TokenCreated(token, msg.sender, flavor, name, symbol, metadataURI);

        if (msg.value > 0) {
            _buy(token, msg.sender, msg.value, minTokensOut);
        }
    }

    function _finalVTokenTheoretical() private pure returns (uint256) {
        return VIRTUAL_ETH_RESERVE * VIRTUAL_TOKEN_RESERVE / (VIRTUAL_ETH_RESERVE + CURVE_TARGET_ETH);
    }

    // ---------------------------------------------------------------- trading

    function buy(address token, uint256 minTokensOut) external payable nonReentrant {
        _buy(token, msg.sender, msg.value, minTokensOut);
    }

    function _buy(address token, address buyer, uint256 grossIn, uint256 minTokensOut) private {
        Curve storage c = curves[token];
        require(c.phase == Phase.Trading, "Launchpad: not trading");
        require(grossIn > 0, "Launchpad: zero buy");

        // Cap the buy at whatever completes the curve; refund the rest.
        (uint256 grossUsed, uint256 fee, uint256 net) = _splitBuy(c, grossIn);

        // x * y = k, rounding the post-trade reserve up so the curve keeps the dust.
        uint256 tokensOut;
        {
            uint256 vEth = c.vEth;
            uint256 vToken = c.vToken;
            uint256 newVToken = _ceilDiv(vEth * vToken, vEth + net);
            tokensOut = vToken - newVToken;
            c.vEth = uint128(vEth + net);
            c.vToken = uint128(newVToken);
        }
        require(tokensOut > 0, "Launchpad: dust buy");

        // On a capped (curve-completing) buy, scale the slippage bound to the ETH
        // actually spent so the price protection stays intact.
        require(
            tokensOut >= (grossUsed == grossIn ? minTokensOut : minTokensOut * grossUsed / grossIn),
            "Launchpad: slippage"
        );

        // Anti-snipe: per-wallet cap during the launch window (creator exempt —
        // that's what the atomic dev buy is for).
        if (buyer != c.creator && block.timestamp < uint256(c.createdAt) + SNIPE_WINDOW) {
            uint256 bought = earlyBuys[token][buyer] + tokensOut;
            require(bought <= SNIPE_MAX_TOKENS, "Launchpad: launch window max buy");
            earlyBuys[token][buyer] = bought;
        }

        _accrueFees(c.creator, fee);

        require(IERC20Min(token).transfer(buyer, tokensOut), "Launchpad: transfer failed");

        emit Trade(token, buyer, true, net, tokensOut, fee, c.vEth, c.vToken);

        if (uint256(c.vEth) - VIRTUAL_ETH_RESERVE >= CURVE_TARGET_ETH) {
            _graduate(token, c);
        }

        if (grossIn > grossUsed) {
            (bool ok,) = buyer.call{value: grossIn - grossUsed}("");
            require(ok, "Launchpad: refund failed");
        }
    }

    /// @dev Fee-splits a buy and caps it at the ETH still needed to complete the curve.
    function _splitBuy(Curve storage c, uint256 grossIn)
        private
        view
        returns (uint256 grossUsed, uint256 fee, uint256 net)
    {
        uint256 remainingNet = CURVE_TARGET_ETH - (uint256(c.vEth) - VIRTUAL_ETH_RESERVE);
        fee = grossIn * TOTAL_FEE_BPS / BPS;
        net = grossIn - fee;
        grossUsed = grossIn;
        if (net > remainingNet) {
            net = remainingNet;
            // Smallest gross covering `net` after the fee is shaved off.
            grossUsed = _ceilDiv(net * BPS, BPS - TOTAL_FEE_BPS);
            fee = grossUsed - net;
        }
    }

    function _accrueFees(address creator, uint256 fee) private {
        uint256 platformFee = fee * PLATFORM_FEE_BPS / TOTAL_FEE_BPS;
        feesOwed[feeRecipient] += platformFee;
        feesOwed[creator] += fee - platformFee;
    }

    function sell(address token, uint256 tokenAmount, uint256 minEthOut) external nonReentrant {
        Curve storage c = curves[token];
        require(c.phase == Phase.Trading, "Launchpad: not trading");
        require(tokenAmount > 0, "Launchpad: zero sell");

        uint256 grossOut;
        {
            uint256 vEth = c.vEth;
            uint256 vToken = c.vToken;
            uint256 newVEth = _ceilDiv(vEth * vToken, vToken + tokenAmount);
            grossOut = vEth - newVEth;
            c.vEth = uint128(newVEth);
            c.vToken = uint128(vToken + tokenAmount);
        }
        require(grossOut > 0, "Launchpad: dust sell");

        uint256 fee = grossOut * TOTAL_FEE_BPS / BPS;
        require(grossOut - fee >= minEthOut, "Launchpad: slippage");

        _accrueFees(c.creator, fee);

        require(
            IERC20Min(token).transferFrom(msg.sender, address(this), tokenAmount),
            "Launchpad: transfer failed"
        );

        (bool ok,) = msg.sender.call{value: grossOut - fee}("");
        require(ok, "Launchpad: eth transfer failed");

        emit Trade(token, msg.sender, false, grossOut, tokenAmount, fee, c.vEth, c.vToken);
    }

    // ---------------------------------------------------------------- graduation

    function _graduate(address token, Curve storage c) private {
        c.phase = Phase.Graduated;

        // Buys are capped at the target, so exactly CURVE_TARGET_ETH was raised.
        uint256 gradFee = graduationFeeEth;
        uint256 ethLP = CURVE_TARGET_ETH - gradFee;
        if (gradFee > 0) {
            feesOwed[feeRecipient] += gradFee;
        }

        ICoopLaunchToken(token).graduate();
        IWETHMin(weth).deposit{value: ethLP}();

        address pool = _ensurePool(token, c.vEth, c.vToken);
        _alignPoolPrice(token, pool, c.vEth, c.vToken);

        // Open the locked full-range position at the pool's (aligned) price.
        (uint128 liquidity, uint256 tokensForLP) = _fullRangeLiquidity(pool, token, ethLP);
        _pendingPool = pool;
        IUniswapV3PoolMin(pool).mint(
            address(locker), TICK_LOWER, TICK_UPPER, liquidity, abi.encode(token)
        );
        _pendingPool = address(0);

        // Burn unpaired token inventory; sweep WETH dust into platform fees.
        uint256 burned = IERC20Min(token).balanceOf(address(this));
        if (burned > 0) {
            require(IERC20Min(token).transfer(DEAD, burned), "Launchpad: burn failed");
        }
        uint256 wethDust = IWETHMin(weth).balanceOf(address(this));
        if (wethDust > 0) {
            IWETHMin(weth).withdraw(wethDust);
            feesOwed[feeRecipient] += wethDust;
        }

        locker.register(
            token, pool, c.creator, c.flavor == Flavor.LPGrow ? LP_GROW_REINVEST_BPS : 0
        );

        emit Graduated(token, pool, ethLP - wethDust, tokensForLP, burned, liquidity);
    }

    /// @dev Get or create+initialize the token/WETH 1% pool at the curve-end price
    /// implied by the given reserves.
    function _ensurePool(address token, uint256 vEth, uint256 vToken) private returns (address pool) {
        pool = uniswapFactory.getPool(token, weth, POOL_FEE);
        if (pool == address(0)) {
            pool = uniswapFactory.createPool(token, weth, POOL_FEE);
        }
        (uint160 sqrtP,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        if (sqrtP == 0) {
            IUniswapV3PoolMin(pool).initialize(_sqrtPriceX96(token, vEth, vToken));
        }
    }

    /// @dev The pool is empty pre-graduation (tokens are locked), but anyone can
    /// initialize it or walk its price with liquidity-less swaps. Walk it back to
    /// the exact curve-end price with a dust swap before minting.
    function _alignPoolPrice(address token, address pool, uint256 vEth, uint256 vToken) private {
        uint160 target = _sqrtPriceX96(token, vEth, vToken);
        (uint160 current,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        if (current == target) return;

        _pendingPool = pool;
        IUniswapV3PoolMin(pool).swap(
            address(this), current > target, int256(1), target, abi.encode(token)
        );
        _pendingPool = address(0);
    }

    /// @dev sqrtPriceX96 for the pool implied by curve reserves, respecting
    /// token0/token1 ordering. price(token1 per token0) → sqrt(price) * 2^96.
    function _sqrtPriceX96(address token, uint256 vEth, uint256 vToken)
        private
        view
        returns (uint160)
    {
        // ratio = token1/token0 as a Q96 number, then sqrt(ratio * 2^96) = sqrt * 2^96.
        uint256 ratioX96 = token < weth
            ? FullMath.mulDiv(vEth, 1 << 96, vToken) // token is token0
            : FullMath.mulDiv(vToken, 1 << 96, vEth); // weth is token0
        uint256 sqrtX48 = _sqrt(ratioX96); // sqrt(ratio) * 2^48
        return uint160(sqrtX48 << 48);
    }

    /// @dev Full-range liquidity fundable by all remaining tokens + ethLP WETH at
    /// the pool's current price. Returns the liquidity and the token side it uses.
    function _fullRangeLiquidity(address pool, address token, uint256 ethLP)
        private
        view
        returns (uint128 liquidity, uint256 tokensForLP)
    {
        (uint160 sqrtP,,,,,,) = IUniswapV3PoolMin(pool).slot0();
        uint160 sqrtL = TickMath.getSqrtRatioAtTick(TICK_LOWER);
        uint160 sqrtU = TickMath.getSqrtRatioAtTick(TICK_UPPER);
        uint256 q96 = 1 << 96;

        uint256 tokenBal = IERC20Min(token).balanceOf(address(this));
        (uint256 amt0, uint256 amt1) = token < weth ? (tokenBal, ethLP) : (ethLP, tokenBal);

        uint256 l0 = FullMath.mulDiv(amt0, FullMath.mulDiv(sqrtP, sqrtU, q96), sqrtU - sqrtP);
        uint256 l1 = FullMath.mulDiv(amt1, q96, sqrtP - sqrtL);
        uint256 liq = l0 < l1 ? l0 : l1;
        require(liq > 0 && liq <= type(uint128).max, "Launchpad: bad liquidity");
        liquidity = uint128(liq);

        // Token side actually consumed (approximate, for the event).
        tokensForLP = token < weth
            ? FullMath.mulDiv(liq, sqrtU - sqrtP, FullMath.mulDiv(sqrtP, sqrtU, q96))
            : FullMath.mulDiv(liq, sqrtP - sqrtL, q96);
    }

    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    // ------------------------------------------------------- uniswap callbacks

    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Launchpad: bad callback");
        (address token) = abi.decode(data, (address));
        (address t0, address t1) = token < weth ? (token, weth) : (weth, token);
        if (amount0Owed > 0) IERC20Min(t0).transfer(msg.sender, amount0Owed);
        if (amount1Owed > 0) IERC20Min(t1).transfer(msg.sender, amount1Owed);
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Launchpad: bad callback");
        (address token) = abi.decode(data, (address));
        (address t0, address t1) = token < weth ? (token, weth) : (weth, token);
        if (amount0Delta > 0) IERC20Min(t0).transfer(msg.sender, uint256(amount0Delta));
        if (amount1Delta > 0) IERC20Min(t1).transfer(msg.sender, uint256(amount1Delta));
    }

    // ---------------------------------------------------------------- fees

    function claimFees() external nonReentrant {
        uint256 amount = feesOwed[msg.sender];
        require(amount > 0, "Launchpad: nothing to claim");
        feesOwed[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Launchpad: claim transfer failed");
        emit FeesClaimed(msg.sender, amount);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Launchpad: zero fee recipient");
        feeRecipient = recipient;
        emit FeeRecipientUpdated(recipient);
    }

    function setGraduationFee(uint256 fee) external onlyOwner {
        require(fee <= MAX_GRADUATION_FEE, "Launchpad: fee too high");
        graduationFeeEth = fee;
        emit GraduationFeeUpdated(fee);
    }

    // ---------------------------------------------------------------- views

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    /// @notice Predict the CREATE2 token address for given launch params + salt
    /// (used by the vanity miner and the frontend).
    function predictTokenAddress(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        bytes32 salt
    ) external view returns (address) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(CoopLaunchToken).creationCode, abi.encode(name, symbol, metadataURI)
            )
        );
        return address(
            uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), salt, initCodeHash))))
        );
    }

    function curveProgressBps(address token) external view returns (uint256) {
        Curve storage c = curves[token];
        if (c.phase == Phase.Graduated) return BPS;
        if (c.phase == Phase.None) return 0;
        return (uint256(c.vEth) - VIRTUAL_ETH_RESERVE) * BPS / CURVE_TARGET_ETH;
    }

    /// @notice Mirrors `_buy` exactly, including fee, curve cap, and rounding.
    function quoteBuy(address token, uint256 grossIn)
        external
        view
        returns (uint256 tokensOut, uint256 fee, uint256 grossUsed, uint256 refund)
    {
        Curve storage c = curves[token];
        require(c.phase == Phase.Trading, "Launchpad: not trading");
        uint256 net;
        (grossUsed, fee, net) = _splitBuy(c, grossIn);
        refund = grossIn - grossUsed;
        uint256 vEth = c.vEth;
        uint256 vToken = c.vToken;
        tokensOut = vToken - _ceilDiv(vEth * vToken, vEth + net);
    }

    /// @notice Mirrors `sell` exactly.
    function quoteSell(address token, uint256 tokenAmount)
        external
        view
        returns (uint256 ethOut, uint256 fee)
    {
        Curve storage c = curves[token];
        require(c.phase == Phase.Trading, "Launchpad: not trading");
        uint256 vEth = c.vEth;
        uint256 vToken = c.vToken;

        uint256 grossOut = vEth - _ceilDiv(vEth * vToken, vToken + tokenAmount);
        fee = grossOut * TOTAL_FEE_BPS / BPS;
        ethOut = grossOut - fee;
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return (a + b - 1) / b;
    }
}
