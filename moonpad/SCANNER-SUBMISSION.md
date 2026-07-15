# The Coop — Security-scanner review / whitelist request

Submission for GMGN, GoPlus Security (the risk engine most terminals — GMGN,
DEXScreener partners, etc. — pull from), and DEXScreener. Purpose: our
launchpad tokens are being flagged with automatically-decompiled false
positives. All contracts are **verified from source** on the Robinhood Chain
explorer; the scanners are reading bytecode, not our source, and
mis-describing three things.

---

## Project

- **Name:** The Coop
- **Site:** https://thecoop.fun
- **X:** https://x.com/thecoopdotfun
- **Chain:** Robinhood Chain (EVM L2), chainId **4663**
- **Explorer:** https://robinhoodchain.blockscout.com  *(all contracts verified)*
- **What it is:** a fair-launch token launchpad. Every token is deployed with a
  fixed 1,000,000,000 supply minted **entirely** into a single-sided Uniswap
  v3 position that is **locked forever** in our locker contract. The pool is
  the bonding curve — tokens trade on Uniswap v3 from block one.

## Canonical contracts (mainnet, chainId 4663)

| Role | Address |
|------|---------|
| Launchpad / token factory (`CoopLaunchpadV2`) | `0x39d80E039591dFA0C0C6016987982dd025498cC8` |
| LP locker (`CoopLockerV2`) — holds 100% of every pool's LP | `0xDc0Fc9110aA3Cf0AC581c7d1DE1918586D9C8989` |
| Swap router (`CoopRouter`) | `0x7490D61Ed78ba14d4535D74aA5EADb44f5921e5a` |
| Platform fee recipient | `0x0d3dCa650B3546DbAA1DA51b1e7A125bFa94F45E` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Uniswap v3 factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |

Every token this launchpad creates is a `CoopLaunchTokenV2` deployed via CREATE2
by the launchpad above. **Request: whitelist the factory** so tokens it mints
inherit the correct risk profile (LP locked by protocol; fixed supply, no mint;
no owner rug; buy-tax-only on the "Super LP" flavor, zero tax otherwise).

## Token flavors (only one has any tax)

| Flavor | Tax | Notes |
|--------|-----|-------|
| **Standard** | **0%** | plain fixed-supply ERC20; pool fees split 50/50 creator/platform |
| **LP-Growing** | **0%** | plain fixed-supply ERC20; 70% of pool fees reinvested into the locked LP |
| **Super LP** | **5% on BUYS only, forever** | the 5% is skimmed on pool→buyer transfers and compounded into the locked LP. **No sell tax. No wallet-transfer tax.** |

---

## The three false / mis-scored flags, with the exact code

### 1. "TradeRestriction — token cannot be sold / 100% sell tax" (HIGH) — FALSE

This is a decompiler misread. Our transfer hook `CoopLaunchTokenV2._update`
touches **only pool→buyer transfers** (buys). The whole branch is gated on
`_isPairPool(from)` — i.e. tokens leaving a Uniswap pool. Therefore:

- **Sells (token → pool) are never taxed and never restricted.**
- **Wallet → wallet transfers are never taxed or restricted.**
- The only fee that exists anywhere is the Super LP **buy** tax (5%). Standard
  and LP-Growing tokens have `buyTaxBps = 0` — literally no fee code path runs.

Relevant source (`CoopLaunchTokenV2._update`):

```solidity
function _update(address from, address to, uint256 value) internal override {
    // Only pool -> buyer transfers are ever touched.
    if (from != address(0) && to != address(0) && _isPairPool(from)) {
        ...
        if (buyTaxBps > 0 && !devBuy) {      // buyTaxBps == 0 for Standard & LP-Growing
            uint256 tax = value * buyTaxBps / BPS;
            ...
        }
    }
    super._update(from, to, value);          // sells & transfers fall straight through
}
```

**Why the honeypot simulator likely fails:** the canonical Uniswap periphery
`SwapRouter` is not deployed at its standard address on Robinhood Chain, so a
simulator that hardcodes that address for its test sell reverts (no contract
there) and reports "cannot sell." Selling actually works via direct v3-core
swaps and via the third-party routers that are deployed here. Please route the
sell simulation through a deployed router (e.g. our
`CoopRouter.sellExactTokens` at `0x7490D61…21e5a`) or a direct `pool.swap`.

*Verifiable — three successful real sells of the flagged token:* these are
sells of the **Super LP COOP token** `0xef2e5d2c38085d014d1fc7eee19c50c9ea58fc00`
(the taxed flavor GMGN flags as "100% sell tax"), out of its pool
`0x8d35F1806d2141f1fe99B0d736ea868c014B9657`. All succeeded (status 1), and
notably each routed through an **independent third-party router**, not our own
— so sellability does not depend on Coop infrastructure:

| Sell tx | Router used |
|---------|-------------|
| `0x79abb691a341d6b28d0e0269aa1d1127ab2f62cfe002b592ab6161cb8645c24f` | `0x243A17063102c29fB60AA930db199d4b73AB8A37` |
| `0x2b4fb3ad62a891f4edcff857f3e7ea42596772c4cadb0d685e4afa26e4521b8b` | `0x5A705DE8982235a7fa45bB83dCaCf03a211389C7` |
| `0x752e7b1186606e5837e5f1c80b93a0b9487a525e866099a1fc4b68ba0d6e2839` | `0x243A17063102c29fB60AA930db199d4b73AB8A37` |

### 2. "Other — launchpad can reassign a privileged address that bypasses transfer restrictions and fee logic (hidden backdoor)" (HIGH) — MISCHARACTERIZED

This refers to `setDevBuyRecipient(address)` on the token. What it actually is:

- Callable **only by the launchpad contract** (`if (msg.sender != launchpad)
  revert NotLaunchpad();`) — never by any EOA, never by an owner.
- It exists so the creator's **atomic dev-buy**, executed inside the same
  transaction that launches the token, is exempt from the 120-second
  anti-snipe cap and (for Super LP) the buy tax.
- It is **set to the creator and reset to `address(0)` within that single
  launch transaction** — see the launchpad's `_devBuy`:

```solidity
CoopLaunchTokenV2(token).setDevBuyRecipient(msg.sender);   // set
... pool.swap(...);                                        // the dev buy
CoopLaunchTokenV2(token).setDevBuyRecipient(address(0));   // cleared, same tx
```

After the launch transaction the exemption address is `address(0)` **forever**.
The launchpad has **no owner function and no other code path** that can call
`setDevBuyRecipient` again — it is unreachable outside a fresh launch. So there
is no persistent privileged address and nothing can be "reassigned" post-launch.
A static bytecode scan sees the setter exists but cannot see that the
controlling contract never re-invokes it.

For completeness, the token has **no** mint function (supply is fixed in the
constructor), **no** blacklist, **no** pause, **no** owner, **no** upgradeable
proxy, and **no** post-launch fee setter.

### 3. "Burnt/Locked LP < 80% — high rug risk" (HIGH) — FALSE (detection blind spot)

**100% of every token's LP is permanently locked** in `CoopLockerV2`
(`0xDc0F…8989`). The locker has **no** `withdraw`, `unlock`, `removeLiquidity`,
or `decreaseLiquidity` path that returns principal to anyone — the position can
never be pulled. It only ever *collects fees* and (for Super LP / LP-Growing)
*adds* liquidity. Liquidity removal is impossible by construction.

**Why the scanner scores it low:** we mint liquidity directly at the Uniswap v3
**pool core** (`pool.mint(locker, …)`), not through the
`NonfungiblePositionManager`. So there is no LP **NFT** to trace to a burn/lock
address — the position is owned by the locker contract at the core level, keyed
by `(locker, tickLower, tickUpper)`. Please detect the lock by reading the
core position owner (our locker) rather than NFT ownership.

---

## Request

1. **Whitelist the factory** `0x39d80E039591dFA0C0C6016987982dd025498cC8` so its
   tokens are recognized as launchpad tokens with: LP locked by protocol; fixed
   supply / no mint / no owner rug; buys-only 5% tax on the Super LP flavor and
   0% tax on Standard & LP-Growing.
2. **Fix the sell simulation** to route via our router
   `0x7490D61Ed78ba14d4535D74aA5EADb44f5921e5a` or a direct v3-core swap, so the
   honeypot check reflects reality (tokens are freely sellable).
3. **Detect the LP lock** from the v3-core position owner (`0xDc0F…8989`), not
   from NonfungiblePositionManager NFTs.

Happy to walk through the verified source or provide any additional tx examples.

Contact: contact@thecoop.fun
