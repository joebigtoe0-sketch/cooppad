use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ContributionState {
    pub contributor: Pubkey,
    pub mint: Pubkey,
    pub amount_contributed: u64,
    pub claimed: bool,
    pub refunded: bool,
    pub early_withdrew: bool,
    pub bump: u8,
    pub fee_debt_x64: u128,
    pub fees_collected: u64,
}
