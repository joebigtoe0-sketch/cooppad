use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer as SplTransfer};

use crate::constants::{LP_VAULT_SOL_DENOMINATOR, LP_VAULT_SOL_NUMERATOR};
use crate::errors::PresaleError;
use crate::SweepLpForMeteora;

/// Move LP SOL (still in the presale vault) and LP token leg to the per-sale **treasury** so COOP can
/// wrap SOL → WSOL and call Meteora DAMM v2 (`initialize_customizable_pool`) from a script or second tx.
///
/// **Run before any contributor claims** (or ensure `token_vault` still holds at least `lp_tokens_amount`).
pub fn handler(ctx: Context<SweepLpForMeteora>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let state_bump = ctx.accounts.presale_state.state_bump;

    let lp_sol = ctx
        .accounts
        .presale_state
        .total_raised
        .checked_mul(LP_VAULT_SOL_NUMERATOR)
        .ok_or(PresaleError::ArithmeticOverflow)?
        .checked_div(LP_VAULT_SOL_DENOMINATOR)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    let lp_tokens = ctx.accounts.presale_state.lp_tokens_amount;

    require!(
        ctx.accounts.token_vault.amount >= lp_tokens,
        PresaleError::LpSweepInsufficientTokens
    );

    let rent_min = Rent::get()?.minimum_balance(0);
    let vl = ctx.accounts.vault.lamports();

    // Same as `launch_presale`: vault is a program-owned PDA (0-byte data). System Program CPI
    // `transfer` from `from` must be system-owned; use direct lamport moves instead.
    let vault_ai = ctx.accounts.vault.to_account_info();
    let treasury_ai = ctx.accounts.treasury.to_account_info();
    let new_vault = vl
        .checked_sub(lp_sol)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    require!(
        new_vault >= rent_min,
        PresaleError::InsufficientVaultSolForLpSweep
    );
    **vault_ai.try_borrow_mut_lamports()? = new_vault;
    **treasury_ai.try_borrow_mut_lamports()? = treasury_ai
        .lamports()
        .checked_add(lp_sol)
        .ok_or(PresaleError::ArithmeticOverflow)?;

    let presale_seeds: &[&[u8]] = &[b"presale", mint_key.as_ref(), &[state_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.presale_state.to_account_info(),
            },
            &[presale_seeds],
        ),
        lp_tokens,
    )?;

    Ok(())
}
