use anchor_lang::prelude::*;

use crate::errors::PresaleError;
use crate::LaunchPresale;

pub fn handler(_ctx: Context<LaunchPresale>) -> Result<()> {
    err!(PresaleError::MeteoraCpiNotImplemented)
}
