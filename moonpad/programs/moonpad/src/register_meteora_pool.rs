use anchor_lang::prelude::*;

use crate::errors::PresaleError;
use crate::RegisterMeteoraPool;

/// Store Meteora pool + position NFT mint on `PresaleState` after `initialize_customizable_pool` succeeds.
pub fn handler(
    ctx: Context<RegisterMeteoraPool>,
    pool: Pubkey,
    position_nft_mint: Pubkey,
) -> Result<()> {
    require!(pool != Pubkey::default(), PresaleError::InvalidMeteoraPoolPubkey);
    require!(
        position_nft_mint != Pubkey::default(),
        PresaleError::InvalidMeteoraPoolPubkey
    );
    let s = &mut ctx.accounts.presale_state;
    s.pool = pool;
    s.position_nft_mint = position_nft_mint;
    Ok(())
}
