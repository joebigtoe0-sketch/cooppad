use anchor_lang::prelude::*;

#[error_code]
pub enum PresaleError {
    #[msg("Token name exceeds 32 characters")]
    NameTooLong,
    #[msg("Token ticker exceeds 10 characters")]
    TickerTooLong,
    #[msg("Description exceeds 256 characters")]
    DescriptionTooLong,
    #[msg("URI exceeds 200 characters")]
    UriTooLong,
    #[msg("Social link exceeds 100 characters")]
    SocialTooLong,
    #[msg("Duration must be between 1 hour and 7 days")]
    DurationTooShort,
    #[msg("Duration must be between 1 hour and 7 days")]
    DurationTooLong,
    #[msg("Contribution below minimum (0.01 SOL)")]
    AmountTooSmall,
    #[msg("Contribution would exceed raise target")]
    ExceedsRaiseTarget,
    #[msg("Contribution exceeds per-wallet max")]
    ExceedsMaxContribution,
    #[msg("Presale has already launched")]
    AlreadyLaunched,
    #[msg("Presale ended without meeting goal — refunds enabled")]
    PresaleFailed,
    #[msg("Presale has ended")]
    PresaleEnded,
    #[msg("Presale is still active")]
    PresaleStillActive,
    #[msg("Raise target has not been met")]
    RaiseTargetNotMet,
    #[msg("Goal was met — refunds not available")]
    GoalWasMet,
    #[msg("Refunds are not enabled")]
    RefundsNotEnabled,
    #[msg("Refunds are already enabled")]
    RefundsAlreadyEnabled,
    #[msg("Already refunded")]
    AlreadyRefunded,
    #[msg("No contribution to withdraw")]
    NothingToWithdraw,
    #[msg("Tokens already claimed")]
    AlreadyClaimed,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid platform authority")]
    InvalidPlatformAuthority,
    #[msg("Meteora DAMM v2 CPI not wired yet — deploy with CPI feature")]
    MeteoraCpiNotImplemented,
    #[msg("Presale not launched")]
    NotLaunched,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid Meteora program")]
    InvalidMeteoraProgram,
    #[msg("Invalid UTF-8 in string field")]
    InvalidUtf8,
}
