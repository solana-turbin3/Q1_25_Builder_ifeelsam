use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};
use crate::state::bet::Bet;
#[derive(Accounts)]
#[instruction(seed: u128)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub house: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        init,
        space = 8 + Bet::INIT_SPACE,
        payer = player,
        seeds = [b"", vault.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump  
    )]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>
}

impl<'info> PlaceBet<'info> {
    pub fn create_bet(&mut self, seed: u128, roll: u8, amount: u64, bumps: &PlaceBetBumps) ->Result<()> {
        self.bet.set_inner( Bet {
            player: self.player.key(),
            seed,
            slot: Clock::get()?.slot,
            amount,
            roll,
            bump: bumps.bet,
        });
    Ok(())
    } 
    
    pub fn diposit(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.player.to_account_info(),
            to: self.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, amount)
    }
}