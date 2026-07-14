use anchor_lang::prelude::*;

use crate::constants::MIN_CONTRIBUTION;
use crate::errors::PresaleError;
use crate::events::ContributionMade;
use crate::Contribute;

pub fn handler(ctx: Context<Contribute>, amount_lamports: u64) -> Result<()> {
    let state = &mut ctx.accounts.presale_state;
    let now = Clock::get()?.unix_timestamp;

    require!(!state.launched, PresaleError::AlreadyLaunched);
    require!(!state.refund_enabled, PresaleError::PresaleFailed);
    require!(now < state.end_time, PresaleError::PresaleEnded);
    require!(amount_lamports >= MIN_CONTRIBUTION, PresaleError::AmountTooSmall);

    // `amount_lamports` is the net amount credited to the raise / position; 1% platform fee is charged on top.
    let net_amount = amount_lamports;
    let platform_fee = net_amount / 100;
    require!(
        net_amount.checked_add(platform_fee).is_some(),
        PresaleError::ArithmeticOverflow
    );

    if state.max_contribution > 0 {
        let c = &ctx.accounts.contribution_state;
        let after = c
            .amount_contributed
            .checked_add(net_amount)
            .ok_or(PresaleError::ArithmeticOverflow)?;
        require!(after <= state.max_contribution, PresaleError::ExceedsMaxContribution);
    }

    let new_total = state
        .total_raised
        .checked_add(net_amount)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    require!(new_total <= state.raise_target, PresaleError::ExceedsRaiseTarget);

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.contributor.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        platform_fee,
    )?;

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.contributor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        net_amount,
    )?;

    let contribution = &mut ctx.accounts.contribution_state;
    if contribution.contributor == Pubkey::default() {
        contribution.contributor = ctx.accounts.contributor.key();
        contribution.mint = ctx.accounts.mint.key();
        contribution.claimed = false;
        contribution.refunded = false;
        contribution.early_withdrew = false;
        contribution.bump = ctx.bumps.contribution_state;
        contribution.fee_debt_x64 = 0;
        contribution.fees_collected = 0;
    }

    if contribution.amount_contributed == 0 && net_amount > 0 {
        state.total_contributors = state
            .total_contributors
            .checked_add(1)
            .ok_or(PresaleError::ArithmeticOverflow)?;
        if contribution.early_withdrew {
            contribution.early_withdrew = false;
        }
    }

    contribution.amount_contributed = contribution
        .amount_contributed
        .checked_add(net_amount)
        .ok_or(PresaleError::ArithmeticOverflow)?;
    state.total_raised = new_total;
    if state.goal_reached_at == 0 && new_total >= state.raise_target {
        state.goal_reached_at = now;
    }

    emit!(ContributionMade {
        mint: ctx.accounts.mint.key(),
        contributor: ctx.accounts.contributor.key(),
        amount: net_amount,
        total_raised: state.total_raised,
    });

    Ok(())
}
