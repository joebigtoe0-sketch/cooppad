use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PresaleState {
    pub mint: Pubkey,
    #[max_len(32)]
    pub token_name: String,
    #[max_len(10)]
    pub token_ticker: String,
    #[max_len(200)]
    pub token_uri: String,
    #[max_len(128)]
    pub description: String,
    pub creator: Pubkey,
    /// Per-presale platform treasury (SOL); set once at initialize.
    pub treasury: Pubkey,
    pub raise_target: u64,
    pub total_supply: u64,
    pub lp_tokens_amount: u64,
    pub distribution_amount: u64,
    pub max_contribution: u64,
    pub total_raised: u64,
    pub total_contributors: u32,
    pub start_time: i64,
    pub end_time: i64,
    pub launched: bool,
    pub refund_enabled: bool,
    /// Unix timestamp when `total_raised` first reached `raise_target` (0 = not yet).
    pub goal_reached_at: i64,
    pub tokens_per_lamport_x64: u128,
    pub position_nft_mint: Pubkey,
    pub pool: Pubkey,
    pub total_fees_claimed: u64,
    pub fee_pool_balance: u64,
    pub fee_pool_per_share_x64: u128,
    pub vault_bump: u8,
    pub token_vault_bump: u8,
    pub state_bump: u8,
    pub fee_vault_bump: u8,
    #[max_len(48)]
    pub twitter: String,
    #[max_len(48)]
    pub telegram: String,
    #[max_len(80)]
    pub website: String,
}
