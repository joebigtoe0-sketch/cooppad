use anchor_lang::prelude::*;

use crate::constants::EARLY_WITHDRAWAL_PENALTY_BPS;
use crate::errors::PresaleError;
use crate::events::ContributionWithdrawn;
use crate::WithdrawContribution;

pub fn handler(ctx: Context<WithdrawContribution>) -> Result<()> {
    let state = &mut ctx.accounts.presale_state;
    let contribution = &mut ctx.accounts.contribution_state;

    require!(!state.launched, PresaleError::AlreadyLaunched);
    require!(
        state.total_raised < state.raise_target,
        PresaleError::RaiseTargetMet
    );
    require!(!state.refund_enabled, PresaleError::PresaleFailed);
    require!(!contribution.refunded, PresaleError::AlreadyRefunded);
    require!(contribution.amount_contributed > 0, PresaleError::NothingToWithdraw);

    let amount = contribution.amount_contributed;
    let penalty = amount
        .checked_mul(EARLY_WITHDRAWAL_PENALTY_BPS)
        .ok_or(PresaleError::ArithmeticOverflow)?
        / 10_000;
    let return_amount = amount
        .checked_sub(penalty)
        .ok_or(PresaleError::ArithmeticOverflow)?;

    **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= penalty;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? += penalty;

    **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= return_amount;
    **ctx.accounts.contributor.try_borrow_mut_lamports()? += return_amount;

    state.total_raised = state
        .total_raised
        .checked_sub(amount)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    state.total_contributors = state
        .total_contributors
        .checked_sub(1)
        .ok_or(PresaleError::ArithmeticOverflow)?;

    contribution.amount_contributed = 0;
    contribution.early_withdrew = true;

    emit!(ContributionWithdrawn {
        mint: ctx.accounts.mint.key(),
        contributor: ctx.accounts.contributor.key(),
        amount_returned: return_amount,
        penalty,
    });

    Ok(())
}
