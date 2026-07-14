use anchor_lang::prelude::*;

use crate::constants::{
    LP_VAULT_SOL_DENOMINATOR, LP_VAULT_SOL_NUMERATOR, POST_GOAL_LAUNCH_DELAY_SECS,
};
use crate::errors::PresaleError;
use crate::LaunchPresale;

/// Finalize presale: set token claim rate, move non-LP SOL share to per-sale treasury, mark hatched.
///
/// **Meteora DAMM v2:** LP-side SOL + tokens remain in vault / token_vault for a follow-up CPI that
/// opens the pool with **platform treasury** as position owner (trading fees → COOP).
pub fn handler(ctx: Context<LaunchPresale>) -> Result<()> {
    let state = &mut ctx.accounts.presale_state;
    let now = Clock::get()?.unix_timestamp;

    require!(!state.launched, PresaleError::AlreadyLaunched);
    require!(!state.refund_enabled, PresaleError::PresaleFailed);
    require!(
        state.total_raised >= state.raise_target,
        PresaleError::RaiseTargetNotReached
    );
    require!(state.goal_reached_at > 0, PresaleError::GoalTimestampMissing);

    let unlock = state
        .goal_reached_at
        .checked_add(POST_GOAL_LAUNCH_DELAY_SECS)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    require!(now >= unlock, PresaleError::LaunchCountdownActive);

    require!(state.raise_target > 0, PresaleError::ArithmeticOverflow);

    let rate = (state.distribution_amount as u128)
        .checked_shl(64)
        .ok_or(PresaleError::ArithmeticOverflow)?
        .checked_div(state.raise_target as u128)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    state.tokens_per_lamport_x64 = rate;

    let lp_sol = state
        .total_raised
        .checked_mul(LP_VAULT_SOL_NUMERATOR)
        .ok_or(PresaleError::ArithmeticOverflow)?
        .checked_div(LP_VAULT_SOL_DENOMINATOR)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    let remainder = state
        .total_raised
        .checked_sub(lp_sol)
        .ok_or(PresaleError::ArithmeticOverflow)?;

    // Move non-LP SOL out of the vault using direct lamport updates (same pattern as
    // `withdraw_contribution`). System Program CPI from a program-owned vault PDA can fail on some
    // runtimes with "spent from the balance of an account it does not own".
    if remainder > 0 {
        let vault_ai = ctx.accounts.vault.to_account_info();
        let treasury_ai = ctx.accounts.treasury.to_account_info();
        let rent_min = Rent::get()?.minimum_balance(0);
        let v_bal = vault_ai.lamports();
        let new_vault = v_bal
            .checked_sub(remainder)
            .ok_or(PresaleError::ArithmeticOverflow)?;
        require!(
            new_vault >= rent_min,
            PresaleError::LaunchVaultInsufficientForRemainder
        );
        **vault_ai.try_borrow_mut_lamports()? = new_vault;
        **treasury_ai.try_borrow_mut_lamports()? = treasury_ai
            .lamports()
            .checked_add(remainder)
            .ok_or(PresaleError::ArithmeticOverflow)?;
    }

    state.launched = true;
    Ok(())
}
