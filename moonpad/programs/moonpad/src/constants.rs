//! Program constants (set platform authority before deployment).
use anchor_lang::prelude::*;
use solana_program::pubkey;

/// Signs `initialize_presale` with the creator so the treasury pubkey cannot be swapped by users.
pub const PLATFORM_AUTHORITY_PUBKEY: Pubkey =
    pubkey!("C7bttWUQDVGjxtUpAh1n18vRwQrbTaxV2kVmMkgD16xF");
pub const RAISE_TARGET: u64 = 85_000_000_000;
pub const LAUNCH_FEE: u64 = 1_000_000_000;
pub const PLATFORM_FEE_BPS: u64 = 100;
pub const EARLY_WITHDRAWAL_PENALTY_BPS: u64 = 300;
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;
pub const MIN_CONTRIBUTION: u64 = 10_000_000;
pub const MIN_DURATION: i64 = 3_600;
/// Upper bound for presale length (30 days). Must cover the web app default duration.
pub const MAX_DURATION: i64 = 2_592_000;

pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const DAMM_V2_PROGRAM: Pubkey = pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
pub const DAMM_V2_POOL_AUTHORITY: Pubkey = pubkey!("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC");
pub const TOKEN_METADATA_PROGRAM: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
