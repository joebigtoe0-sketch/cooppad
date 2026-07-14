//! Program constants (set platform authority before deployment).
use anchor_lang::prelude::*;
use solana_program::pubkey;

/// Signs `initialize_presale` with the creator so the treasury pubkey cannot be swapped by users.
pub const PLATFORM_AUTHORITY_PUBKEY: Pubkey =
    pubkey!("C7bttWUQDVGjxtUpAh1n18vRwQrbTaxV2kVmMkgD16xF");
/// Dev-friendly cap (0.85 SOL) so a full raise is easy to test on devnet.
pub const RAISE_TARGET: u64 = 850_000_000;
pub const LAUNCH_FEE: u64 = 1_000_000_000;
pub const PLATFORM_FEE_BPS: u64 = 100;
pub const EARLY_WITHDRAWAL_PENALTY_BPS: u64 = 300;
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;
pub const MIN_CONTRIBUTION: u64 = 10_000_000;
pub const MIN_DURATION: i64 = 3_600;
/// Upper bound for presale length (30 days). Must cover the web app default duration.
pub const MAX_DURATION: i64 = 2_592_000;

/// After the raise target is hit, `launch_presale` is blocked until this many seconds pass.
/// Dev builds: 60s. Production: compile with `--features mainnet` for 3600 (1 hour).
#[cfg(feature = "mainnet")]
pub const POST_GOAL_LAUNCH_DELAY_SECS: i64 = 3_600;
#[cfg(not(feature = "mainnet"))]
pub const POST_GOAL_LAUNCH_DELAY_SECS: i64 = 60;

/// Share of **vault** SOL (net raised) intended for the Meteora pool; remainder stays in vault for treasury/platform (e.g. 5/85).
pub const LP_VAULT_SOL_NUMERATOR: u64 = 80;
pub const LP_VAULT_SOL_DENOMINATOR: u64 = 85;

/// `initialize_presale` ix + `PresaleState` string caps — align Metaplex `DataV2.uri` (max 200).
pub const MAX_INIT_TOKEN_URI_LEN: usize = 200;
pub const MAX_INIT_DESCRIPTION_LEN: usize = 128;
pub const MAX_INIT_SOCIAL_LEN: usize = 48;
pub const MAX_INIT_WEBSITE_LEN: usize = 80;

pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const DAMM_V2_PROGRAM: Pubkey = pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
pub const DAMM_V2_POOL_AUTHORITY: Pubkey = pubkey!("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC");
pub const TOKEN_METADATA_PROGRAM: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
