# Coop Launchpad — Robinhood Chain contracts

Pump.fun-style bonding curve launchpad, built with Foundry for Robinhood Chain
(chain ID 4663 mainnet / 46630 testnet, Arbitrum Orbit, gas in ETH).

## Contracts

| Contract | Purpose |
| --- | --- |
| `src/CoopLaunchpad.sol` | Factory + curve manager. Deploys tokens, runs the constant-product curve, handles fees, graduates to Uniswap v2. |
| `src/tokens/CoopLaunchToken.sol` | The launch token, both flavors. Standard: 0.2% tax on post-graduation Uniswap trades (0.1% platform / 0.1% creator). LP-Growing: 3% (adds 2.8% auto-LP, LP burned). |

## Mechanics

- **Supply:** 1B tokens per launch, all held by the launchpad at creation.
- **Curve:** x·y = k with virtual reserves — 1.25 virtual ETH / 1.073B virtual tokens.
  ~790.6M tokens sell on the curve; ~209.4M remain for liquidity.
- **Trade fees on the curve:** 1% (0.5% platform + 0.5% creator), accrued in
  `feesOwed`, claimed via `claimFees()`.
- **Creation:** free; send ETH with `createToken` for an atomic dev buy.
- **Graduation:** at exactly 3.5 ETH raised, the curve closes. Raised ETH
  minus the flat graduation fee (default 0.1 ETH, owner-settable ≤ 0.35) is paired with
  tokens *at the final curve price* into a Uniswap v2 pool. LP tokens are minted to
  `0xdead`; unpaired curve inventory is burned; the pool opens exactly where the
  curve ended. The pair is seeded via direct `pair.mint()` so WETH-donation griefing
  can't brick a launch.
- **Transfer lock:** tokens only move to/from the launchpad until graduation
  (prevents pre-graduation parallel pools).
- **Fee-on-transfer caveat:** both flavors are taxed post-graduation, so tokens work
  on Uniswap v2 only (v3/v4 reject fee-on-transfer) and sells must use the
  `SupportingFeeOnTransferTokens` router functions — frontends must route accordingly.

## Develop

```bash
forge build
forge test
```

Tests run against the real Uniswap v2 contracts (vendored under `test/vendor/`,
compiled with their original solc versions, deployed via `deployCode`). The only
vendor patch is `UniswapV2Library.pairFor`, which resolves pairs through
`factory.getPair` because locally compiled pairs have a different init code hash.

## Chain facts (verified live 2026-07-14)

| | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | 4663 | 46630 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | robinhoodchain.blockscout.com | explorer.testnet.chain.robinhood.com |
| Faucet | — | faucet.testnet.chain.robinhood.com |
| Uniswap v2 factory | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` | none (deploy our own) |
| Uniswap v2 router | `0x89e5db8b5aa49aa85ac63f691524311aeb649eba` | none (deploy our own) |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | none (deploy our own) |

## Deploy

**Testnet** (no public Uniswap v2 there — `DeployLocal.s.sol` ships the whole stack:
WETH + Uniswap v2 + launchpad). Fund the deployer at the faucet first, then from
`evm/` with `.env` filled in:

```bash
source .env && forge script script/DeployLocal.s.sol \
  --rpc-url $ROBINHOOD_TESTNET_RPC_URL --broadcast --private-key $DEPLOYER_KEY
```

**Mainnet** (uses the canonical Uniswap v2 above — only the launchpad deploys):

```bash
source .env && forge script script/Deploy.s.sol \
  --rpc-url $ROBINHOOD_RPC_URL --broadcast --private-key $DEPLOYER_KEY
```

Set `FEE_RECIPIENT` in `.env` to the platform treasury before deploying, then put
the printed launchpad address into the app's `NEXT_PUBLIC_LAUNCHPAD_ADDRESS`.
