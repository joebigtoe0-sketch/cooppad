// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Base} from "../base/ERC20Base.sol";

interface IUniswapV3FactoryView {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

interface IUniswapV3PoolFeeView {
    function fee() external view returns (uint24);
}

interface ILaunchContext {
    function launchContext()
        external
        view
        returns (address locker, address uniswapFactory, address pairToken, uint24 poolFee);
}

/**
 * @title CoopLaunchTokenV2
 * @notice Fixed-supply ERC20 launched straight into a locked single-sided
 * Uniswap v3 position by CoopLaunchpadV2. Two mechanisms live here, both
 * applied ONLY to pool->buyer transfers so third-party routers and terminals
 * can always trade the token (taxing transfers INTO a v3 pool breaks sells):
 *
 *  - Launch window (all flavors): buys in the launch block are rejected
 *    (except the creator's atomic dev buy) and cumulative buys per wallet are
 *    capped at 2% of supply for `SNIPE_WINDOW` seconds. Afterwards the checks
 *    disappear and the token behaves as a plain ERC20.
 *  - Super LP flavor only: a permanent `buyTaxBps` cut of every pool buy is
 *    skimmed to the locker, which pairs it with reinvested pool fees to mint
 *    more permanently locked liquidity.
 */
contract CoopLaunchTokenV2 is ERC20Base {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant SNIPE_WINDOW = 120; // seconds
    uint256 public constant SNIPE_MAX_TOKENS = TOTAL_SUPPLY / 50; // 2% per wallet
    uint256 public constant BPS = 10_000;

    address public immutable launchpad;
    address public immutable creator;
    address public immutable locker;
    address public immutable uniswapFactory;
    address public immutable pairToken;
    uint24 public immutable poolFee;
    uint16 public immutable buyTaxBps; // 0 for Standard/LP-Growing, 500 for Super LP
    uint256 public immutable launchBlock;
    uint256 public immutable restrictionEnd;

    string public metadataURI;

    // Cumulative pool buys per wallet inside the launch window.
    mapping(address => uint256) private _windowBuys;
    // Set by the launchpad only while its atomic dev buy executes.
    address private _devBuyRecipient;

    event BuyTaxCollected(address indexed buyer, uint256 amount);

    error LaunchBlockBuyBlocked();
    error LaunchWindowMaxBuy();
    error NotLaunchpad();

    /// @dev Infra addresses are read back from the deploying launchpad, which
    /// keeps the constructor small enough for cheap CREATE2 vanity mining.
    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address creator_,
        uint16 buyTaxBps_
    ) ERC20Base(name_, symbol_) {
        launchpad = msg.sender;
        (address locker_, address uniswapFactory_, address pairToken_, uint24 poolFee_) =
            ILaunchContext(msg.sender).launchContext();
        creator = creator_;
        locker = locker_;
        uniswapFactory = uniswapFactory_;
        pairToken = pairToken_;
        poolFee = poolFee_;
        buyTaxBps = buyTaxBps_;
        metadataURI = metadataURI_;
        launchBlock = block.number;
        restrictionEnd = block.timestamp + SNIPE_WINDOW;
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /// @notice Canonical Uniswap v3 pool for this token (zero before creation).
    function liquidityPool() public view returns (address) {
        return IUniswapV3FactoryView(uniswapFactory).getPool(address(this), pairToken, poolFee);
    }

    /// @notice One-call exemption used by the launchpad's atomic dev buy.
    function setDevBuyRecipient(address recipient) external {
        if (msg.sender != launchpad) revert NotLaunchpad();
        _devBuyRecipient = recipient;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Only pool -> buyer transfers are ever touched (see contract natspec).
        if (from != address(0) && to != address(0) && _isPairPool(from)) {
            bool devBuy = _devBuyRecipient != address(0) && to == _devBuyRecipient;

            if (block.timestamp <= restrictionEnd && !devBuy) {
                if (block.number == launchBlock) revert LaunchBlockBuyBlocked();
                uint256 cumulative = _windowBuys[to] + value;
                if (cumulative > SNIPE_MAX_TOKENS) revert LaunchWindowMaxBuy();
                _windowBuys[to] = cumulative;
            }

            if (buyTaxBps > 0 && !devBuy) {
                uint256 tax = value * buyTaxBps / BPS;
                if (tax > 0) {
                    super._update(from, locker, tax);
                    emit BuyTaxCollected(to, tax);
                    super._update(from, to, value - tax);
                    return;
                }
            }
        }
        super._update(from, to, value);
    }

    /// @dev True when `candidate` is a Uniswap v3 pool for this token/pair
    /// registered by the canonical factory (any fee tier — covers pools
    /// third parties might create on other tiers).
    function _isPairPool(address candidate) private view returns (bool) {
        address canonical = liquidityPool();
        if (candidate == canonical && canonical != address(0)) return true;
        if (candidate.code.length == 0) return false;
        (bool ok, bytes memory data) =
            candidate.staticcall(abi.encodeWithSelector(IUniswapV3PoolFeeView.fee.selector));
        if (!ok || data.length < 32) return false;
        uint24 candidateFee = abi.decode(data, (uint24));
        return IUniswapV3FactoryView(uniswapFactory).getPool(address(this), pairToken, candidateFee)
            == candidate;
    }
}
