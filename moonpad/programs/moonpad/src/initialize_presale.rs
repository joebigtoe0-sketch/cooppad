use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};

use crate::constants::{self, LAUNCH_FEE, RAISE_TARGET, TOTAL_SUPPLY};
use crate::{InitializePresale, InitializePresaleParams};
use crate::errors::PresaleError;
use crate::events::PresaleCreated;

fn utf8_padded<const N: usize>(buf: &[u8; N]) -> Result<String> {
    let end = buf.iter().position(|&b| b == 0).unwrap_or(N);
    let slice = &buf[..end];
    if slice.is_empty() {
        return Ok(String::new());
    }
    core::str::from_utf8(slice)
        .map(|s| s.to_string())
        .map_err(|_| error!(PresaleError::InvalidUtf8))
}

#[inline(never)]
pub fn handler(ctx: Context<InitializePresale>, params: InitializePresaleParams) -> Result<()> {
    let token_name = utf8_padded(&params.token_name)?;
    let token_ticker = utf8_padded(&params.token_ticker)?;
    let token_uri = utf8_padded(&params.token_uri)?;
    let description = utf8_padded(&params.description)?;
    let twitter = utf8_padded(&params.twitter)?;
    let telegram = utf8_padded(&params.telegram)?;
    let website = utf8_padded(&params.website)?;

    require!(token_name.len() <= 32, PresaleError::NameTooLong);
    require!(token_ticker.len() <= 10, PresaleError::TickerTooLong);
    require!(token_uri.len() <= 200, PresaleError::UriTooLong);
    require!(description.len() <= 256, PresaleError::DescriptionTooLong);
    require!(twitter.len() <= 100, PresaleError::SocialTooLong);
    require!(telegram.len() <= 100, PresaleError::SocialTooLong);
    require!(website.len() <= 100, PresaleError::SocialTooLong);
    require!(
        params.duration_seconds >= constants::MIN_DURATION,
        PresaleError::DurationTooShort
    );
    require!(
        params.duration_seconds <= constants::MAX_DURATION,
        PresaleError::DurationTooLong
    );

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        LAUNCH_FEE,
    )?;

    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.bumps.presale_state;
    let seeds: &[&[u8]] = &[b"presale", mint_key.as_ref(), &[bump]];
    let signer = &[seeds];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.presale_state.to_account_info(),
            },
            signer,
        ),
        TOTAL_SUPPLY,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let state = &mut ctx.accounts.presale_state;
    state.mint = ctx.accounts.mint.key();
    state.treasury = ctx.accounts.treasury.key();
    state.token_name = token_name;
    state.token_ticker = token_ticker;
    state.token_uri = token_uri;
    state.description = description;
    state.creator = ctx.accounts.creator.key();
    state.raise_target = RAISE_TARGET;
    state.total_supply = TOTAL_SUPPLY;
    state.lp_tokens_amount = TOTAL_SUPPLY / 2;
    state.distribution_amount = TOTAL_SUPPLY / 2;
    state.max_contribution = params.max_contribution;
    state.total_raised = 0;
    state.total_contributors = 0;
    state.start_time = now;
    state.end_time = now + params.duration_seconds;
    state.launched = false;
    state.refund_enabled = false;
    state.tokens_per_lamport_x64 = 0;
    state.position_nft_mint = Pubkey::default();
    state.pool = Pubkey::default();
    state.total_fees_claimed = 0;
    state.fee_pool_balance = 0;
    state.fee_pool_per_share_x64 = 0;
    state.vault_bump = ctx.bumps.vault;
    state.token_vault_bump = ctx.bumps.token_vault;
    state.state_bump = ctx.bumps.presale_state;
    state.fee_vault_bump = ctx.bumps.fee_vault;
    state.twitter = twitter;
    state.telegram = telegram;
    state.website = website;

    emit!(PresaleCreated {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.creator.key(),
        end_time: state.end_time,
    });

    Ok(())
}
