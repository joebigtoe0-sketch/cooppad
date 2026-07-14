use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::system_program::{self, CreateAccount};
use anchor_spl::metadata::{self as token_metadata};
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, InitializeAccount3, MintTo, SetAuthority};

use crate::constants::{self, LAUNCH_FEE, RAISE_TARGET, TOTAL_SUPPLY};
use crate::{InitializePresale, InitializePresaleParams};
use crate::errors::PresaleError;
use crate::events::PresaleCreated;

/// Decode null-padded UTF-8 into `String` (heap). One field at a time.
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

#[inline(always)]
fn padded_utf8_byte_len<const N: usize>(buf: &[u8; N]) -> Result<usize> {
    let end = buf.iter().position(|&b| b == 0).unwrap_or(N);
    let slice = &buf[..end];
    if slice.is_empty() {
        return Ok(0);
    }
    let s = core::str::from_utf8(slice).map_err(|_| error!(PresaleError::InvalidUtf8))?;
    Ok(s.len())
}

#[inline(never)]
fn validate_presale_params(p: &InitializePresaleParams) -> Result<()> {
    require!(padded_utf8_byte_len(&p.token_name)? <= 32, PresaleError::NameTooLong);
    require!(padded_utf8_byte_len(&p.token_ticker)? <= 10, PresaleError::TickerTooLong);
    require!(
        padded_utf8_byte_len(&p.token_uri)? <= constants::MAX_INIT_TOKEN_URI_LEN,
        PresaleError::UriTooLong
    );
    require!(
        padded_utf8_byte_len(&p.description)? <= constants::MAX_INIT_DESCRIPTION_LEN,
        PresaleError::DescriptionTooLong
    );
    require!(
        padded_utf8_byte_len(&p.twitter)? <= constants::MAX_INIT_SOCIAL_LEN,
        PresaleError::SocialTooLong
    );
    require!(
        padded_utf8_byte_len(&p.telegram)? <= constants::MAX_INIT_SOCIAL_LEN,
        PresaleError::SocialTooLong
    );
    require!(
        padded_utf8_byte_len(&p.website)? <= constants::MAX_INIT_WEBSITE_LEN,
        PresaleError::WebsiteTooLong
    );
    require!(
        p.duration_seconds >= constants::MIN_DURATION,
        PresaleError::DurationTooShort
    );
    require!(
        p.duration_seconds <= constants::MAX_DURATION,
        PresaleError::DurationTooLong
    );
    Ok(())
}

#[inline(never)]
fn fill_string_fields(state: &mut crate::state::PresaleState, p: &InitializePresaleParams) -> Result<()> {
    state.token_name = utf8_padded(&p.token_name)?;
    state.token_ticker = utf8_padded(&p.token_ticker)?;
    state.token_uri = utf8_padded(&p.token_uri)?;
    state.description = utf8_padded(&p.description)?;
    state.twitter = utf8_padded(&p.twitter)?;
    state.telegram = utf8_padded(&p.telegram)?;
    state.website = utf8_padded(&p.website)?;
    Ok(())
}

/// Allocate 0-byte program-owned PDA for native SOL (same semantics as prior `init, space = 0`).
#[inline(never)]
fn create_sol_vault_pda<'info>(
    creator: AccountInfo<'info>,
    vault: AccountInfo<'info>,
    system_ai: AccountInfo<'info>,
    mint_key: &Pubkey,
    seed: &[u8],
    bump: u8,
    program_id: &Pubkey,
    lamports: u64,
) -> Result<()> {
    require!(vault.data_is_empty(), PresaleError::VaultNotEmpty);
    require!(vault.lamports() == 0, PresaleError::VaultNotEmpty);
    let bump_ref = &[bump];
    let signer: &[&[u8]] = &[seed, mint_key.as_ref(), bump_ref];
    system_program::create_account(
        CpiContext::new_with_signer(
            system_ai,
            CreateAccount {
                from: creator,
                to: vault,
            },
            &[signer],
        ),
        lamports,
        0,
        program_id,
    )
}

pub fn handler(ctx: Context<InitializePresale>, params: Box<InitializePresaleParams>) -> Result<()> {
    handler_inner(ctx, params.as_ref())
}

#[inline(never)]
fn handler_inner(ctx: Context<InitializePresale>, params: &InitializePresaleParams) -> Result<()> {
    validate_presale_params(params)?;

    let mint_key = ctx.accounts.mint.key();
    let (want_vault, bump_vault) =
        Pubkey::find_program_address(&[b"vault", mint_key.as_ref()], ctx.program_id);
    require_keys_eq!(want_vault, ctx.accounts.vault.key(), PresaleError::InvalidVaultPda);
    let (want_fee, bump_fee) =
        Pubkey::find_program_address(&[b"fee_vault", mint_key.as_ref()], ctx.program_id);
    require_keys_eq!(want_fee, ctx.accounts.fee_vault.key(), PresaleError::InvalidFeeVaultPda);

    let rent_lamports = Rent::get()?.minimum_balance(0);
    create_sol_vault_pda(
        ctx.accounts.creator.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        &mint_key,
        b"vault",
        bump_vault,
        ctx.program_id,
        rent_lamports,
    )?;
    create_sol_vault_pda(
        ctx.accounts.creator.to_account_info(),
        ctx.accounts.fee_vault.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        &mint_key,
        b"fee_vault",
        bump_fee,
        ctx.program_id,
        rent_lamports,
    )?;

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

    let state_bump = ctx.bumps.presale_state;
    let presale_seeds: &[&[u8]] = &[b"presale", mint_key.as_ref(), &[state_bump]];
    let presale_sign = &[presale_seeds];

    let (want_tv, bump_tv) =
        Pubkey::find_program_address(&[b"token_vault", mint_key.as_ref()], ctx.program_id);
    require_keys_eq!(
        want_tv,
        ctx.accounts.token_vault.key(),
        PresaleError::InvalidTokenVaultPda
    );
    let token_space = anchor_spl::token::spl_token::state::Account::LEN as u64;
    let token_rent = Rent::get()?.minimum_balance(token_space as usize);
    let tv_ai = ctx.accounts.token_vault.to_account_info();
    require!(tv_ai.data_is_empty(), PresaleError::VaultNotEmpty);
    require!(tv_ai.lamports() == 0, PresaleError::VaultNotEmpty);
    let tv_bump_arr = &[bump_tv];
    let tv_seeds: &[&[u8]] = &[b"token_vault", mint_key.as_ref(), tv_bump_arr];
    system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.creator.to_account_info(),
                to: tv_ai.clone(),
            },
            &[tv_seeds],
        ),
        token_rent,
        token_space,
        &token::ID,
    )?;
    token::initialize_account3(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        InitializeAccount3 {
            account: tv_ai.clone(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.presale_state.to_account_info(),
        },
        &[tv_seeds],
    ))?;

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.presale_state.to_account_info(),
            },
            presale_sign,
        ),
        TOTAL_SUPPLY,
    )?;

    let (want_metadata, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            token_metadata::mpl_token_metadata::ID.as_ref(),
            mint_key.as_ref(),
        ],
        &token_metadata::mpl_token_metadata::ID,
    );
    require_keys_eq!(
        want_metadata,
        ctx.accounts.metadata.key(),
        PresaleError::InvalidMetadataPda
    );

    let meta_name = utf8_padded(&params.token_name)?;
    let meta_symbol = utf8_padded(&params.token_ticker)?;
    let meta_uri = utf8_padded(&params.token_uri)?;
    let data = token_metadata::mpl_token_metadata::types::DataV2 {
        name: meta_name,
        symbol: meta_symbol,
        uri: meta_uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    token_metadata::create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            token_metadata::CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.presale_state.to_account_info(),
                payer: ctx.accounts.creator.to_account_info(),
                update_authority: ctx.accounts.creator.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            presale_sign,
        ),
        data,
        true,
        true,
        None,
    )?;

    // Fixed supply: no further minting; users expect mint + freeze authorities gone.
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.presale_state.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            presale_sign,
        ),
        AuthorityType::MintTokens,
        None,
    )?;
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.presale_state.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            presale_sign,
        ),
        AuthorityType::FreezeAccount,
        None,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let state = &mut ctx.accounts.presale_state;
    state.mint = ctx.accounts.mint.key();
    state.treasury = ctx.accounts.treasury.key();
    fill_string_fields(state, params)?;
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
    state.goal_reached_at = 0;
    state.tokens_per_lamport_x64 = 0;
    state.position_nft_mint = Pubkey::default();
    state.pool = Pubkey::default();
    state.total_fees_claimed = 0;
    state.fee_pool_balance = 0;
    state.fee_pool_per_share_x64 = 0;
    state.vault_bump = bump_vault;
    state.token_vault_bump = bump_tv;
    state.state_bump = ctx.bumps.presale_state;
    state.fee_vault_bump = bump_fee;

    emit!(PresaleCreated {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.creator.key(),
        end_time: state.end_time,
    });

    Ok(())
}
