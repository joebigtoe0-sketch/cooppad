use anchor_lang::prelude::*;

use crate::errors::PresaleError;
use crate::CollectMyFees;

pub fn handler(ctx: Context<CollectMyFees>) -> Result<()> {
    let state = &ctx.accounts.presale_state;
    let contribution = &mut ctx.accounts.contribution_state;

    require!(contribution.amount_contributed > 0, PresaleError::NothingToClaim);
    require!(state.total_raised > 0, PresaleError::ArithmeticOverflow);

    let earned = (contribution.amount_contributed as u128)
        .checked_mul(state.fee_pool_per_share_x64)
        .ok_or(PresaleError::ArithmeticOverflow)?
        >> 64;

    let pending = earned
        .checked_sub(contribution.fee_debt_x64)
        .ok_or(PresaleError::ArithmeticOverflow)?;

    if pending == 0 {
        return Ok(());
    }

    let pending_u64: u64 = pending.try_into().map_err(|_| error!(PresaleError::ArithmeticOverflow))?;

    **ctx.accounts.fee_vault.try_borrow_mut_lamports()? -= pending_u64;
    **ctx.accounts.contributor.try_borrow_mut_lamports()? += pending_u64;

    contribution.fee_debt_x64 = earned;
    contribution.fees_collected = contribution
        .fees_collected
        .checked_add(pending_u64)
        .ok_or(PresaleError::ArithmeticOverflow)?;

    Ok(())
}
