use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub house: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn init(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.house.to_account_info();
        let cpi_account = Transfer {
            from: self.house.to_account_info(),
            to: self.vault.to_account_info(),
        };

        let cpi_cpx = CpiContext::new(cpi_program, cpi_account);

        transfer(cpi_cpx, amount)
    }
}
