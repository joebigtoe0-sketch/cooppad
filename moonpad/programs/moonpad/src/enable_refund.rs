use anchor_lang::prelude::*;

use crate::errors::PresaleError;
use crate::EnableRefund;

pub fn handler(ctx: Context<EnableRefund>) -> Result<()> {
    let state = &mut ctx.accounts.presale_state;
    let now = Clock::get()?.unix_timestamp;

    require!(!state.launched, PresaleError::AlreadyLaunched);
    require!(now > state.end_time, PresaleError::PresaleStillActive);
    require!(
        state.total_raised < state.raise_target,
        PresaleError::GoalWasMet
    );
    require!(!state.refund_enabled, PresaleError::RefundsAlreadyEnabled);

    state.refund_enabled = true;
    Ok(())
}
