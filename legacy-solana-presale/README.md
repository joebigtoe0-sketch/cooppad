# Legacy Solana presale (parked)

The original Coop product: Solana presale launches with Meteora DAMM v2 graduation.
Moved out of `moonpad/` on 2026-07-14 when the Robinhood Chain bonding curve became
the primary product — the `/presale*` routes and Solana wallet UI no longer exist in
the app.

## What's here

Mirrors the old `moonpad/` layout: `app/` (presale pages + API routes incl. the
completion cron), `components/`, `hooks/`, `lib/` (+`lib/server/` stores),
`types/index.ts`, `scripts/` (mint-pool miner, Meteora devnet helper).

Still inside `moonpad/` (not web-reachable): the Anchor program (`programs/`,
`Anchor.toml`, `tests/`, `migrations/`, `target/`), `public/idl/moonpad.json`, and
the Solana npm dependencies in package.json.

## To revive

1. Move these folders back into `moonpad/` at the same relative paths.
2. Re-add `SolanaWalletProvider` to `app/layout.tsx` and the Solana wallet button
   to `CoopTopBar` (see git history).
3. Restore the Solana env vars (see `.env.example` — the platform authority secret
   lives in `.env.local`, and `.data/` still holds treasury/mint-pool state).
