# Coop deployment runbook

Three environments: local (anvil), Robinhood testnet (46630), Robinhood mainnet (4663).
Chain facts and verified addresses live in [evm/README.md](evm/README.md).

## Chain switch (testnet <-> mainnet)

`NEXT_PUBLIC_EVM_CHAIN` is the ONLY switch: `robinhoodTestnet` or `robinhood`.
Launchpad/router addresses and the indexer start block are baked into
`lib/evm/chains.ts` (DEPLOYMENTS map) per chain, and the indexer wipes and
re-syncs its database automatically whenever the chain or launchpad changes.
Do NOT set NEXT_PUBLIC_LAUNCHPAD_ADDRESS / NEXT_PUBLIC_ROUTER_ADDRESS /
EVM_INDEXER_START_BLOCK in production — those env overrides are for local
anvil runs only.

## Current deployments

| Env | CoopLaunchpad | Notes |
| --- | --- | --- |
| **Robinhood mainnet (4663) — V2 instant-pool (PRODUCTION)** | `0x39d80E039591dFA0C0C6016987982dd025498cC8` | CoopLaunchpadV2 deployed 2026-07-15, block 10516434. LockerV2 `0xDc0Fc9110aA3Cf0AC581c7d1DE1918586D9C8989`, CoopRouter `0x7490D61Ed78ba14d4535D74aA5EADb44f5921e5a`. Canonical Uniswap v3 factory + WETH; fee recipient = treasury `0x0d3dCa650B3546DbAA1DA51b1e7A125bFa94F45E`; owner = deployer `0x2FCa…3cFd`. All three source-verified on Blockscout. |
| **Robinhood mainnet (4663)** | **`0x2f52bf3D414828171F46Bf90977BFAe525EB1d93`** | **PRODUCTION.** Deployed 2026-07-14, block 9734526, tx `0xc1e6d7b78ada100efa57235e4c2ece68ed0e2be9d8acaeb6a08dfa807586ff54`. Locker `0x321707187cB1802c4327C34498289cac5A3A43b5`. Canonical Uniswap v3 factory `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` + WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`. Fee recipient (treasury) `0x0d3dCa650B3546DbAA1DA51b1e7A125bFa94F45E`; owner = deployer `0x2FCa34559d533f1F8a70f722E7F06C1BA6Ba3cFd`. Explorer: https://robinhoodchain.blockscout.com/address/0x2f52bf3D414828171F46Bf90977BFAe525EB1d93 |
| Robinhood testnet (46630) — **V2 instant-pool** | `0x2f52bf3D414828171F46Bf90977BFAe525EB1d93` | CoopLaunchpadV2 (single-sided locked v3 launches, 3 flavors incl. Super LP swap-and-liquify), deployed 2026-07-15. LockerV2 `0x321707187cB1802c4327C34498289cac5A3A43b5`. NOTE: same address as the MAINNET v1 launchpad (same deployer, nonce 0) — mind the chain. Smoke token SMOKE `0xdfe214ea49cb4f051c29472771ea563a3e05877f` (launch block 90481827): dev buy untaxed ✓, 5% buy tax skim ✓, collect() compounded tax into locked LP ✓, graduation view ✓. Test router `0x7490D61Ed78ba14d4535D74aA5EADb44f5921e5a`. |
| Robinhood testnet (46630) — v1 curve | `0x6f7D9F1002303c58bFdf5F6ca65Ef4b9B71f2D86` | v3 architecture (clean tokens, locked v3 LP, anti-snipe, vanity …c00), deployed 2026-07-14 blocks 90205079–117. Locker `0xbb2B6CCbF55B7d2e115E5fEAcBd407fd9A1524b0`, own WETH `0xb3eE9260EB257d4508F0a3FD604Fe5C3485eB82f`, own UniV3 factory `0xcb2fb61633Bc49893d595E43de0Fd8811f3475B8`. Fee recipient = deployer. Superseded: `0x8aAB…2C7C` (v2 fee-on-transfer), `0x90A7…2CE6` (v1). |

## 1. Local dev (three terminals)

```bash
# 1 — chain
anvil

# 2 — contracts (fresh anvil each time; prints the env values)
cd moonpad && npm run evm:local

# 3 — app
cd moonpad && npm run dev     # http://localhost:3040
```

`.env.local` needs `NEXT_PUBLIC_EVM_CHAIN=local` and the printed
`NEXT_PUBLIC_LAUNCHPAD_ADDRESS` (stable across fresh anvil runs: `0xCf7E…0Fc9`).
The indexer detects a restarted anvil automatically and re-indexes from scratch.
MetaMask: add network `http://127.0.0.1:8545`, chain 31337, then import an anvil
test key for funds.

## 2. Testnet

1. Fund the deployer (`evm/.env` → `DEPLOYER_ADDRESS`) at
   https://faucet.testnet.chain.robinhood.com
2. Set `FEE_RECIPIENT` in `evm/.env`.
3. From `evm/`:
   ```bash
   source .env && forge script script/DeployLocal.s.sol \
     --rpc-url $ROBINHOOD_TESTNET_RPC_URL --broadcast --private-key $DEPLOYER_KEY
   ```
   (Deploys WETH + Uniswap v3 factory + launchpad — the testnet has no public Uniswap.)
4. App env:
   ```
   NEXT_PUBLIC_EVM_CHAIN=robinhoodTestnet
   NEXT_PUBLIC_LAUNCHPAD_ADDRESS=<printed CoopLaunchpad address>
   ```

## 3. Mainnet — DONE 2026-07-14 (see table above)

Deployed with a fresh deployer key (never the transcript-exposed testnet one),
`--slow`, against the canonical Uniswap v3 factory + WETH:

```bash
source .env && forge script script/Deploy.s.sol \
  --rpc-url $ROBINHOOD_RPC_URL --broadcast --slow --private-key $DEPLOYER_KEY
```

Production app env:

```
NEXT_PUBLIC_EVM_CHAIN=robinhood
NEXT_PUBLIC_LAUNCHPAD_ADDRESS=0x2f52bf3D414828171F46Bf90977BFAe525EB1d93
EVM_INDEXER_START_BLOCK=9734526
```

The deployer key is the launchpad **owner** (fee-recipient/graduation-fee setters
+ ownership transfer). Transfer ownership to the treasury when ready:
`cast send 0x2f52bf3D414828171F46Bf90977BFAe525EB1d93 "transferOwnership(address)" <treasury> --rpc-url $ROBINHOOD_RPC_URL --private-key $DEPLOYER_KEY`

## 4. Railway (app hosting)

1. New Railway project → **Deploy from GitHub repo**, root directory `moonpad/`.
   `railway.json` already sets build (`npm run build`) and start (`npm start`).
2. Add the **PostgreSQL** plugin; Railway injects `DATABASE_URL` automatically —
   the indexer uses it instead of PGlite.
3. Service variables:
   ```
   NEXT_PUBLIC_EVM_CHAIN=robinhoodTestnet        # THE switch: robinhoodTestnet | robinhood
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=…        # cloud.reown.com (free)
   PINATA_JWT=…                                  # image/metadata pinning
   PINATA_GATEWAY=https://<your-gateway>.mypinata.cloud   # optional
   VANITY_SUFFIX=c00                             # optional, this is the default
   KEEPER_PRIVATE_KEY=…                          # optional: gas-dust wallet that
                                                 # auto-cranks Super LP compounding
   ```
   Addresses + indexer start block resolve automatically from the chain
   (see "Chain switch" above). Remove any old NEXT_PUBLIC_LAUNCHPAD_ADDRESS /
   EVM_INDEXER_START_BLOCK variables — they override the map.
4. One service is enough: the Next server hosts UI + APIs + the indexer loop.
   Keep replicas at 1 — the indexer assumes a single writer.

## Notes

- Contract changes: `npm run evm:abi` regenerates `lib/evm/abi/*` — commit them.
- The Solana presale product was moved to `legacy-solana-presale/` (repo root) —
  see its README for revival instructions.
