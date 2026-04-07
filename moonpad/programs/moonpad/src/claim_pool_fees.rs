use anchor_lang::prelude::*;

use crate::errors::PresaleError;
use crate::ClaimPoolFees;

pub fn handler(_ctx: Context<ClaimPoolFees>) -> Result<()> {
    err!(PresaleError::MeteoraCpiNotImplemented)
}
