use anchor_lang::prelude::*;

#[event]
pub struct PresaleCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub end_time: i64,
}

#[event]
pub struct ContributionMade {
    pub mint: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
    pub total_raised: u64,
}

#[event]
pub struct ContributionWithdrawn {
    pub mint: Pubkey,
    pub contributor: Pubkey,
    pub amount_returned: u64,
    pub penalty: u64,
}

#[event]
pub struct PresaleLaunched {
    pub mint: Pubkey,
    pub pool: Pubkey,
    pub position_nft: Pubkey,
    pub total_raised: u64,
    pub lp_amount: u64,
    pub distribution_amount: u64,
}

#[event]
pub struct TokensClaimed {
    pub mint: Pubkey,
    pub contributor: Pubkey,
    pub tokens_amount: u64,
}
