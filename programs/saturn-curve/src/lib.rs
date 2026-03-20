use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};

// REPLACE with actual program ID after first `anchor build`
declare_id!("SatCurve1111111111111111111111111111111111111");

/// Total supply for every token launched on Saturn Curve
const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000; // 1B with 6 decimals
/// Tokens allocated to the bonding curve (80%)
const CURVE_SUPPLY: u64 = 800_000_000_000_000;
/// Tokens reserved for LP migration (20%)
const LP_SUPPLY: u64 = 200_000_000_000_000;
/// Default virtual SOL reserves (30 SOL in lamports)
const DEFAULT_VIRTUAL_SOL: u64 = 30_000_000_000;
/// Default virtual token reserves
const DEFAULT_VIRTUAL_TOKENS: u64 = CURVE_SUPPLY;
/// Maximum fee in basis points (10%)
const MAX_FEE_BPS: u16 = 1000;

// ─── Global Config ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub platform_fee_wallet: Pubkey,
    pub graduation_threshold_lamports: u64,  // e.g. 85 SOL = 85_000_000_000
    pub platform_fee_bps: u16,               // e.g. 100 = 1%
    pub creator_fee_bps: u16,                // e.g. 50 = 0.5%
    pub bump: u8,
}

// ─── Pool State ─────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub token_vault: Pubkey,
    pub sol_vault: Pubkey,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub total_supply: u64,
    pub graduation_threshold: u64,
    pub platform_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub is_graduated: bool,
    pub graduated_at: i64,
    pub total_volume_lamports: u64,
    pub trade_count: u64,
    pub created_at: i64,
    pub bump: u8,
    pub token_vault_bump: u8,
    pub sol_vault_bump: u8,
}

// ─── Events ─────────────────────────────────────────────────────

#[event]
pub struct PoolCreated {
    pub pool: Pubkey,
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub graduation_threshold: u64,
    pub timestamp: i64,
}

#[event]
pub struct SwapExecuted {
    pub pool: Pubkey,
    pub mint: Pubkey,
    pub user: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub price_lamports_per_token: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub bonding_progress_bps: u64,  // 0-10000
    pub timestamp: i64,
}

#[event]
pub struct PoolGraduated {
    pub pool: Pubkey,
    pub mint: Pubkey,
    pub final_sol_reserves: u64,
    pub final_price: u64,
    pub final_market_cap: u64,
    pub timestamp: i64,
}

// ─── Errors ─────────────────────────────────────────────────────

#[error_code]
pub enum SaturnError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Pool already graduated")]
    AlreadyGraduated,
    #[msg("Pool not yet graduated")]
    NotGraduated,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Invalid fee")]
    InvalidFee,
    #[msg("Insufficient output")]
    InsufficientOutput,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Graduation threshold not met")]
    ThresholdNotMet,
}

// ─── Program ────────────────────────────────────────────────────

#[program]
pub mod saturn_curve {
    use super::*;

    /// Initialize global config — called once by deployer
    pub fn initialize(
        ctx: Context<Initialize>,
        platform_fee_wallet: Pubkey,
        graduation_threshold_lamports: u64,
        platform_fee_bps: u16,
        creator_fee_bps: u16,
    ) -> Result<()> {
        require!(platform_fee_bps <= MAX_FEE_BPS, SaturnError::InvalidFee);
        require!(creator_fee_bps <= MAX_FEE_BPS, SaturnError::InvalidFee);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.platform_fee_wallet = platform_fee_wallet;
        config.graduation_threshold_lamports = graduation_threshold_lamports;
        config.platform_fee_bps = platform_fee_bps;
        config.creator_fee_bps = creator_fee_bps;
        config.bump = ctx.bumps.config;

        Ok(())
    }

    /// Create a new bonding curve pool with a fresh SPL token
    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        let clock = Clock::get()?;
        let config = &ctx.accounts.config;

        // Mint total supply to token vault
        let seeds = &[b"config".as_ref(), &[config.bump]];
        let signer = &[&seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            TOTAL_SUPPLY,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.mint = ctx.accounts.mint.key();
        pool.creator = ctx.accounts.creator.key();
        pool.token_vault = ctx.accounts.token_vault.key();
        pool.sol_vault = ctx.accounts.sol_vault.key();
        pool.virtual_sol_reserves = DEFAULT_VIRTUAL_SOL;
        pool.virtual_token_reserves = DEFAULT_VIRTUAL_TOKENS;
        pool.real_sol_reserves = 0;
        pool.real_token_reserves = CURVE_SUPPLY;
        pool.total_supply = TOTAL_SUPPLY;
        pool.graduation_threshold = config.graduation_threshold_lamports;
        pool.platform_fee_bps = config.platform_fee_bps;
        pool.creator_fee_bps = config.creator_fee_bps;
        pool.is_graduated = false;
        pool.graduated_at = 0;
        pool.total_volume_lamports = 0;
        pool.trade_count = 0;
        pool.created_at = clock.unix_timestamp;
        pool.bump = ctx.bumps.pool;
        pool.token_vault_bump = ctx.bumps.token_vault;
        pool.sol_vault_bump = ctx.bumps.sol_vault;

        emit!(PoolCreated {
            pool: ctx.accounts.pool.key(),
            mint: ctx.accounts.mint.key(),
            creator: ctx.accounts.creator.key(),
            virtual_sol_reserves: DEFAULT_VIRTUAL_SOL,
            virtual_token_reserves: DEFAULT_VIRTUAL_TOKENS,
            graduation_threshold: config.graduation_threshold_lamports,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Execute a swap (buy or sell) against the bonding curve
    pub fn swap(
        ctx: Context<Swap>,
        is_buy: bool,
        amount_in: u64,          // lamports if buy, tokens if sell
        min_amount_out: u64,     // minimum output (slippage protection)
    ) -> Result<()> {
        require!(amount_in > 0, SaturnError::ZeroAmount);
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_graduated, SaturnError::AlreadyGraduated);

        let clock = Clock::get()?;
        let total_fee_bps = pool.platform_fee_bps as u64 + pool.creator_fee_bps as u64;

        let (sol_amount, token_amount) = if is_buy {
            // User sends SOL, receives tokens
            let fee = amount_in
                .checked_mul(total_fee_bps).ok_or(SaturnError::MathOverflow)?
                .checked_div(10_000).ok_or(SaturnError::MathOverflow)?;
            let sol_in_after_fee = amount_in.checked_sub(fee).ok_or(SaturnError::MathOverflow)?;

            // Constant product: tokens_out = virtual_token * sol_in / (virtual_sol + sol_in)
            let vsr = pool.virtual_sol_reserves as u128 + pool.real_sol_reserves as u128;
            let vtr = pool.virtual_token_reserves as u128;
            let sol_in_128 = sol_in_after_fee as u128;

            let tokens_out = vtr
                .checked_mul(sol_in_128).ok_or(SaturnError::MathOverflow)?
                .checked_div(vsr.checked_add(sol_in_128).ok_or(SaturnError::MathOverflow)?)
                .ok_or(SaturnError::MathOverflow)?;
            let tokens_out_u64 = tokens_out as u64;

            require!(tokens_out_u64 >= min_amount_out, SaturnError::SlippageExceeded);
            require!(tokens_out_u64 <= pool.real_token_reserves, SaturnError::InsufficientOutput);

            // Transfer SOL from user to sol_vault
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.user.to_account_info(),
                        to: ctx.accounts.sol_vault.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            // Transfer tokens from token_vault to user
            let pool_seeds = &[
                b"pool".as_ref(),
                pool.mint.as_ref(),
                &[pool.bump],
            ];
            let pool_signer = &[&pool_seeds[..]];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.token_vault.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    pool_signer,
                ),
                tokens_out_u64,
            )?;

            // Update reserves
            pool.real_sol_reserves = pool.real_sol_reserves
                .checked_add(sol_in_after_fee).ok_or(SaturnError::MathOverflow)?;
            pool.real_token_reserves = pool.real_token_reserves
                .checked_sub(tokens_out_u64).ok_or(SaturnError::MathOverflow)?;
            pool.virtual_token_reserves = pool.virtual_token_reserves
                .checked_sub(tokens_out_u64).ok_or(SaturnError::MathOverflow)?;

            (amount_in, tokens_out_u64)
        } else {
            // User sends tokens, receives SOL
            let vsr = pool.virtual_sol_reserves as u128 + pool.real_sol_reserves as u128;
            let vtr = pool.virtual_token_reserves as u128;
            let token_in_128 = amount_in as u128;

            let sol_out_gross = vsr
                .checked_mul(token_in_128).ok_or(SaturnError::MathOverflow)?
                .checked_div(vtr.checked_add(token_in_128).ok_or(SaturnError::MathOverflow)?)
                .ok_or(SaturnError::MathOverflow)?;
            let sol_out_gross_u64 = sol_out_gross as u64;

            let fee = sol_out_gross_u64
                .checked_mul(total_fee_bps).ok_or(SaturnError::MathOverflow)?
                .checked_div(10_000).ok_or(SaturnError::MathOverflow)?;
            let sol_out = sol_out_gross_u64.checked_sub(fee).ok_or(SaturnError::MathOverflow)?;

            require!(sol_out >= min_amount_out, SaturnError::SlippageExceeded);
            require!(sol_out <= pool.real_sol_reserves, SaturnError::InsufficientOutput);

            // Transfer tokens from user to token_vault
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_account.to_account_info(),
                        to: ctx.accounts.token_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            // Transfer SOL from sol_vault to user
            let vault_lamports = ctx.accounts.sol_vault.lamports();
            require!(vault_lamports >= sol_out, SaturnError::InsufficientOutput);
            **ctx.accounts.sol_vault.try_borrow_mut_lamports()? -= sol_out;
            **ctx.accounts.user.try_borrow_mut_lamports()? += sol_out;

            // Update reserves
            pool.real_sol_reserves = pool.real_sol_reserves
                .checked_sub(sol_out_gross_u64).ok_or(SaturnError::MathOverflow)?;
            pool.real_token_reserves = pool.real_token_reserves
                .checked_add(amount_in).ok_or(SaturnError::MathOverflow)?;
            pool.virtual_token_reserves = pool.virtual_token_reserves
                .checked_add(amount_in).ok_or(SaturnError::MathOverflow)?;

            (sol_out, amount_in)
        };

        // Update stats
        pool.total_volume_lamports = pool.total_volume_lamports
            .checked_add(sol_amount).ok_or(SaturnError::MathOverflow)?;
        pool.trade_count = pool.trade_count.checked_add(1).ok_or(SaturnError::MathOverflow)?;

        // Calculate current price
        let vsr_total = pool.virtual_sol_reserves as u128 + pool.real_sol_reserves as u128;
        let vtr_total = pool.virtual_token_reserves as u128;
        let price = if vtr_total > 0 {
            vsr_total.checked_mul(1_000_000).ok_or(SaturnError::MathOverflow)?
                .checked_div(vtr_total).ok_or(SaturnError::MathOverflow)? as u64
        } else { 0 };

        // Calculate bonding progress (0-10000 bps)
        let progress = if pool.graduation_threshold > 0 {
            std::cmp::min(
                (pool.real_sol_reserves as u128)
                    .checked_mul(10_000).ok_or(SaturnError::MathOverflow)?
                    .checked_div(pool.graduation_threshold as u128).ok_or(SaturnError::MathOverflow)? as u64,
                10_000,
            )
        } else { 10_000 };

        emit!(SwapExecuted {
            pool: ctx.accounts.pool.key(),
            mint: pool.mint,
            user: ctx.accounts.user.key(),
            is_buy,
            sol_amount,
            token_amount,
            price_lamports_per_token: price,
            virtual_sol_reserves: pool.virtual_sol_reserves,
            virtual_token_reserves: pool.virtual_token_reserves,
            real_sol_reserves: pool.real_sol_reserves,
            bonding_progress_bps: progress,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Graduate a pool — marks it as graduated so the server can migrate to Meteora
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_graduated, SaturnError::AlreadyGraduated);
        require!(
            pool.real_sol_reserves >= pool.graduation_threshold,
            SaturnError::ThresholdNotMet
        );

        let clock = Clock::get()?;
        pool.is_graduated = true;
        pool.graduated_at = clock.unix_timestamp;

        let vsr_total = pool.virtual_sol_reserves as u128 + pool.real_sol_reserves as u128;
        let vtr_total = pool.virtual_token_reserves as u128;
        let price = if vtr_total > 0 {
            vsr_total.checked_mul(1_000_000).ok_or(SaturnError::MathOverflow)?
                .checked_div(vtr_total).ok_or(SaturnError::MathOverflow)? as u64
        } else { 0 };

        let market_cap = (price as u128)
            .checked_mul(pool.total_supply as u128).ok_or(SaturnError::MathOverflow)?
            .checked_div(1_000_000).ok_or(SaturnError::MathOverflow)? as u64;

        emit!(PoolGraduated {
            pool: ctx.accounts.pool.key(),
            mint: pool.mint,
            final_sol_reserves: pool.real_sol_reserves,
            final_price: price,
            final_market_cap: market_cap,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update global config (admin only)
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_threshold: Option<u64>,
        new_platform_fee_bps: Option<u16>,
        new_creator_fee_bps: Option<u16>,
        new_platform_fee_wallet: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            ctx.accounts.admin.key() == config.admin,
            SaturnError::Unauthorized
        );

        if let Some(t) = new_threshold {
            config.graduation_threshold_lamports = t;
        }
        if let Some(f) = new_platform_fee_bps {
            require!(f <= MAX_FEE_BPS, SaturnError::InvalidFee);
            config.platform_fee_bps = f;
        }
        if let Some(f) = new_creator_fee_bps {
            require!(f <= MAX_FEE_BPS, SaturnError::InvalidFee);
            config.creator_fee_bps = f;
        }
        if let Some(w) = new_platform_fee_wallet {
            config.platform_fee_wallet = w;
        }

        Ok(())
    }
}

// ─── Account Contexts ───────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = creator,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", mint.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = config,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = pool,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA used as SOL vault
    #[account(
        mut,
        seeds = [b"sol_vault", mint.key().as_ref()],
        bump,
    )]
    pub sol_vault: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        address = pool.token_vault,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA sol vault
    #[account(
        mut,
        seeds = [b"sol_vault", pool.mint.as_ref()],
        bump = pool.sol_vault_bump,
    )]
    pub sol_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, GlobalConfig>,

    /// Any signer can trigger graduation if threshold is met
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,
}
