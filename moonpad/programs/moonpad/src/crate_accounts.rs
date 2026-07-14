// Account structs included at crate root for Anchor `#[program]` codegen (`crate::__client_accounts_*`).
#[allow(unused_imports)]
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{self, Metadata};
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{DAMM_V2_PROGRAM, PLATFORM_AUTHORITY_PUBKEY};
use crate::errors::PresaleError;
use crate::state::{ContributionState, PresaleState};

/// Fixed-size instruction args (null-padded UTF-8) to keep BPF stack under 4KiB in `try_accounts`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializePresaleParams {
    pub token_name: [u8; 32],
    pub token_ticker: [u8; 10],
    pub token_uri: [u8; 200],
    pub description: [u8; 128],
    pub duration_seconds: i64,
    pub max_contribution: u64,
    pub twitter: [u8; 48],
    pub telegram: [u8; 48],
    pub website: [u8; 80],
}

#[derive(Accounts)]
pub struct InitializePresale<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Platform co-signer — must approve the per-sale treasury pubkey stored on-chain.
    #[account(
        constraint = platform_authority.key() == PLATFORM_AUTHORITY_PUBKEY @ PresaleError::InvalidPlatformAuthority
    )]
    pub platform_authority: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + PresaleState::INIT_SPACE,
        seeds = [b"presale", mint.key().as_ref()],
        bump
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = presale_state,
        mint::freeze_authority = presale_state,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA `[b"token_vault", mint]` — allocated + `initialize_account3` in handler (keeps `try_accounts` under stack limit).
    #[account(mut)]
    pub token_vault: UncheckedAccount<'info>,

    /// CHECK: PDA `[b"vault", mint]` — not `init` here (Anchor stacks 5× `init` and overflows BPF stack).
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: PDA `[b"fee_vault", mint]` — allocated in `initialize_presale` via `invoke_signed`.
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,

    /// CHECK: per-presale treasury (system account); pubkey is stored in presale_state.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// Metaplex Token Metadata program (`metaqbxx…`).
    pub token_metadata_program: Program<'info, Metadata>,

    /// Metaplex metadata PDA for `mint` — created via CPI before mint authority is revoked.
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata::mpl_token_metadata::ID.as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        seeds::program = metadata::mpl_token_metadata::ID
    )]
    pub metadata: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(mut, seeds = [b"vault", mint.key().as_ref()], bump = presale_state.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = contributor,
        space = 8 + ContributionState::INIT_SPACE,
        seeds = [b"contribution", mint.key().as_ref(), contributor.key().as_ref()],
        bump
    )]
    pub contribution_state: Account<'info, ContributionState>,

    #[account(mut, constraint = treasury.key() == presale_state.treasury @ PresaleError::InvalidTreasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawContribution<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(mut, seeds = [b"vault", mint.key().as_ref()], bump = presale_state.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"contribution", mint.key().as_ref(), contributor.key().as_ref()],
        bump = contribution_state.bump,
        constraint = contribution_state.contributor == contributor.key() @ PresaleError::NothingToWithdraw,
    )]
    pub contribution_state: Account<'info, ContributionState>,

    #[account(mut, constraint = treasury.key() == presale_state.treasury @ PresaleError::InvalidTreasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LaunchPresale<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(mut, seeds = [b"vault", mint.key().as_ref()], bump = presale_state.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump = presale_state.token_vault_bump,
        token::mint = mint,
        token::authority = presale_state,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// Per-sale treasury — receives the non-LP share of raised SOL at launch (e.g. 5/85).
    #[account(mut, constraint = treasury.key() == presale_state.treasury @ PresaleError::InvalidTreasury)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Meteora DAMM v2 program (CPI pool init — next iteration).
    #[account(constraint = damm_v2_program.key() == DAMM_V2_PROGRAM @ PresaleError::InvalidMeteoraProgram)]
    pub damm_v2_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPoolFees<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: Meteora DAMM v2 program
    #[account(constraint = damm_v2_program.key() == DAMM_V2_PROGRAM @ PresaleError::InvalidMeteoraProgram)]
    pub damm_v2_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CollectMyFees<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
        constraint = presale_state.launched @ PresaleError::NotLaunched,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(mut, seeds = [b"fee_vault", mint.key().as_ref()], bump = presale_state.fee_vault_bump)]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"contribution", mint.key().as_ref(), contributor.key().as_ref()],
        bump = contribution_state.bump,
        constraint = contribution_state.contributor == contributor.key() @ PresaleError::NothingToClaim,
    )]
    pub contribution_state: Account<'info, ContributionState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
        constraint = presale_state.launched @ PresaleError::NotLaunched,
        constraint = presale_state.pool != Pubkey::default() @ PresaleError::LiquidityPoolNotLive,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(
        mut,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump = presale_state.token_vault_bump,
        token::mint = mint,
        token::authority = presale_state,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"contribution", mint.key().as_ref(), contributor.key().as_ref()],
        bump = contribution_state.bump,
        constraint = contribution_state.contributor == contributor.key() @ PresaleError::NothingToClaim,
        constraint = !contribution_state.claimed @ PresaleError::AlreadyClaimed,
    )]
    pub contribution_state: Account<'info, ContributionState>,

    #[account(
        init_if_needed,
        payer = contributor,
        associated_token::mint = mint,
        associated_token::authority = contributor,
        associated_token::token_program = token_program,
    )]
    pub contributor_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct EnableRefund<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
    )]
    pub presale_state: Account<'info, PresaleState>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(mut, seeds = [b"vault", mint.key().as_ref()], bump = presale_state.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"contribution", mint.key().as_ref(), contributor.key().as_ref()],
        bump = contribution_state.bump,
        constraint = contribution_state.contributor == contributor.key() @ PresaleError::NothingToWithdraw,
    )]
    pub contribution_state: Account<'info, ContributionState>,

    pub system_program: Program<'info, System>,
}

/// COOP-only: move LP SOL + LP project tokens from presale PDAs to the sale treasury for Meteora pool creation.
#[derive(Accounts)]
pub struct SweepLpForMeteora<'info> {
    #[account(
        mut,
        constraint = platform_authority.key() == PLATFORM_AUTHORITY_PUBKEY @ PresaleError::InvalidPlatformAuthority
    )]
    pub platform_authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
        constraint = presale_state.launched @ PresaleError::NotLaunched,
        constraint = presale_state.pool == Pubkey::default() @ PresaleError::MeteoraPoolAlreadyRegistered,
    )]
    pub presale_state: Account<'info, PresaleState>,

    #[account(mut, seeds = [b"vault", mint.key().as_ref()], bump = presale_state.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump = presale_state.token_vault_bump,
        token::mint = mint,
        token::authority = presale_state,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = treasury.key() == presale_state.treasury @ PresaleError::InvalidTreasury)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = treasury_token_account.owner == treasury.key() @ PresaleError::InvalidTreasuryTokenAccount,
        constraint = treasury_token_account.mint == mint.key() @ PresaleError::InvalidTreasuryTokenAccount,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// COOP-only: record DAMM v2 pool keys after successful `initialize_customizable_pool`.
#[derive(Accounts)]
pub struct RegisterMeteoraPool<'info> {
    #[account(
        constraint = platform_authority.key() == PLATFORM_AUTHORITY_PUBKEY @ PresaleError::InvalidPlatformAuthority
    )]
    pub platform_authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"presale", mint.key().as_ref()],
        bump = presale_state.state_bump,
        constraint = presale_state.launched @ PresaleError::NotLaunched,
        constraint = presale_state.pool == Pubkey::default() @ PresaleError::MeteoraPoolAlreadyRegistered,
    )]
    pub presale_state: Account<'info, PresaleState>,
}
