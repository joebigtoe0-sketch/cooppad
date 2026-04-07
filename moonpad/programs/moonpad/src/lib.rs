use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod state;

include!("crate_accounts.rs");

pub mod claim_pool_fees;
pub mod claim_refund;
pub mod claim_tokens;
pub mod collect_my_fees;
pub mod contribute;
pub mod enable_refund;
pub mod initialize_presale;
pub mod launch_presale;
pub mod withdraw_contribution;

declare_id!("Aja9DiMcEQuKYmZyb2Rvd9ddcrVqw6scVDasJfii1qzo");

#[program]
pub mod moonpad {
    use super::*;

    pub fn initialize_presale(
        ctx: Context<InitializePresale>,
        params: InitializePresaleParams,
    ) -> Result<()> {
        super::initialize_presale::handler(ctx, params)
    }

    pub fn contribute(
        ctx: Context<Contribute>,
        amount_lamports: u64,
    ) -> Result<()> {
        super::contribute::handler(ctx, amount_lamports)
    }

    pub fn withdraw_contribution(ctx: Context<WithdrawContribution>) -> Result<()> {
        super::withdraw_contribution::handler(ctx)
    }

    pub fn launch_presale(ctx: Context<LaunchPresale>) -> Result<()> {
        super::launch_presale::handler(ctx)
    }

    pub fn claim_pool_fees(ctx: Context<ClaimPoolFees>) -> Result<()> {
        super::claim_pool_fees::handler(ctx)
    }

    pub fn collect_my_fees(ctx: Context<CollectMyFees>) -> Result<()> {
        super::collect_my_fees::handler(ctx)
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        super::claim_tokens::handler(ctx)
    }

    pub fn enable_refund(ctx: Context<EnableRefund>) -> Result<()> {
        super::enable_refund::handler(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        super::claim_refund::handler(ctx)
    }
}
