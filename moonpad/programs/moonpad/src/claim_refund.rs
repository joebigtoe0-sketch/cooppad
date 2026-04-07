use anchor_lang::prelude::*;

use crate::errors::PresaleError;
use crate::ClaimRefund;

pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let state = &ctx.accounts.presale_state;
    let contribution = &mut ctx.accounts.contribution_state;

    require!(state.refund_enabled, PresaleError::RefundsNotEnabled);
    require!(!contribution.refunded, PresaleError::AlreadyRefunded);
    require!(contribution.amount_contributed > 0, PresaleError::NothingToWithdraw);

    let amount = contribution.amount_contributed;

    **ctx.accounts.vault.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.contributor.try_borrow_mut_lamports()? += amount;

    contribution.refunded = true;
    contribution.amount_contributed = 0;

    Ok(())
}
