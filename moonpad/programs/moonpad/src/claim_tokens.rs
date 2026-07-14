use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

use crate::errors::PresaleError;
use crate::events::TokensClaimed;
use crate::ClaimTokens;

pub fn handler(ctx: Context<ClaimTokens>) -> Result<()> {
    let state = &ctx.accounts.presale_state;
    let contribution = &mut ctx.accounts.contribution_state;

    require!(
        state.pool != Pubkey::default(),
        PresaleError::LiquidityPoolNotLive
    );

    require!(!contribution.claimed, PresaleError::AlreadyClaimed);

    let tokens_owed = ((contribution.amount_contributed as u128)
        .checked_mul(state.tokens_per_lamport_x64)
        .ok_or(PresaleError::ArithmeticOverflow)?
        >> 64) as u64;

    require!(tokens_owed > 0, PresaleError::NothingToClaim);

    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[b"presale", mint_key.as_ref(), &[state.state_bump]];
    let signer = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.contributor_token_account.to_account_info(),
                authority: ctx.accounts.presale_state.to_account_info(),
            },
            signer,
        ),
        tokens_owed,
    )?;

    contribution.claimed = true;

    emit!(TokensClaimed {
        mint: ctx.accounts.mint.key(),
        contributor: ctx.accounts.contributor.key(),
        tokens_amount: tokens_owed,
    });

    Ok(())
}
