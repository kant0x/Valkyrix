use anchor_lang::prelude::*;

declare_id!("Esj1LL1kQTYZ6kVi2wbiJiHbEs3cAiW6dDsZyjdZpmNo");

const GAME_CONFIG_SEED: &[u8] = b"game-config";
const PLAYER_LEDGER_SEED: &[u8] = b"player-ledger";
const MAX_UNIT_TYPE_LEN: usize = 32;
const SCORE_PER_KILL: u64 = 10;
const SCORE_PER_CREATE: u64 = 1;
const SCORE_BOSS_KILL: u64 = 10;
const SCORE_BOSS_NEGOTIATED: u64 = 10_000;

#[program]
pub mod valkyrix_ledger {
    use super::*;

    pub fn initialize_game(ctx: Context<InitializeGame>) -> Result<()> {
        let game = &mut ctx.accounts.game_config;
        game.authority = ctx.accounts.authority.key();
        game.created_at = Clock::get()?.unix_timestamp;
        game.bump = ctx.bumps.game_config;
        Ok(())
    }

    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let ledger = &mut ctx.accounts.player_ledger;
        ledger.player = ctx.accounts.player.key();
        ledger.game = ctx.accounts.game_config.key();
        ledger.best_score = 0;
        ledger.last_session_score = 0;
        ledger.games_played = 0;
        ledger.total_kills = 0;
        ledger.total_creates = 0;
        ledger.boss_kills = 0;
        ledger.boss_negotiations = 0;
        ledger.current_session_nonce = 0;
        ledger.current_session_score = 0;
        ledger.current_session_kills = 0;
        ledger.current_session_creates = 0;
        ledger.current_session_active = false;
        ledger.boss_outcome_recorded = false;
        ledger.last_event_timestamp = 0;
        ledger.bump = ctx.bumps.player_ledger;
        Ok(())
    }

    pub fn start_session(ctx: Context<StartSession>, session_nonce: u64) -> Result<()> {
        let ledger = &mut ctx.accounts.player_ledger;
        ledger.current_session_nonce = session_nonce;
        ledger.current_session_score = 0;
        ledger.current_session_kills = 0;
        ledger.current_session_creates = 0;
        ledger.current_session_active = true;
        ledger.boss_outcome_recorded = false;
        ledger.last_event_timestamp = Clock::get()?.unix_timestamp;

        emit!(SessionStarted {
            player: ledger.player,
            session_nonce,
            timestamp: ledger.last_event_timestamp,
        });

        Ok(())
    }

    pub fn record_kill(
        ctx: Context<RecordGameplayEvent>,
        unit_type: String,
        timestamp: i64,
    ) -> Result<()> {
        require_session_active(&ctx.accounts.player_ledger)?;
        validate_unit_type(&unit_type)?;

        let ledger = &mut ctx.accounts.player_ledger;
        ledger.total_kills = ledger.total_kills.saturating_add(1);
        ledger.current_session_kills = ledger.current_session_kills.saturating_add(1);
        ledger.current_session_score = ledger.current_session_score.saturating_add(SCORE_PER_KILL);
        ledger.last_event_timestamp = timestamp;

        emit!(KillRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            unit_type,
            timestamp,
            total_kills: ledger.total_kills,
            current_session_score: ledger.current_session_score,
        });

        Ok(())
    }

    pub fn record_create(
        ctx: Context<RecordGameplayEvent>,
        unit_type: String,
        timestamp: i64,
    ) -> Result<()> {
        require_session_active(&ctx.accounts.player_ledger)?;
        validate_unit_type(&unit_type)?;

        let ledger = &mut ctx.accounts.player_ledger;
        ledger.total_creates = ledger.total_creates.saturating_add(1);
        ledger.current_session_creates = ledger.current_session_creates.saturating_add(1);
        ledger.current_session_score = ledger.current_session_score.saturating_add(SCORE_PER_CREATE);
        ledger.last_event_timestamp = timestamp;

        emit!(CreateRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            unit_type,
            timestamp,
            total_creates: ledger.total_creates,
            current_session_score: ledger.current_session_score,
        });

        Ok(())
    }

    pub fn record_boss_outcome(
        ctx: Context<RecordGameplayEvent>,
        outcome: BossOutcome,
        timestamp: i64,
    ) -> Result<()> {
        require_session_active(&ctx.accounts.player_ledger)?;

        let ledger = &mut ctx.accounts.player_ledger;
        require!(
            !ledger.boss_outcome_recorded,
            ValkyrixLedgerError::BossOutcomeAlreadyRecorded
        );

        match outcome {
            BossOutcome::Negotiated => {
                ledger.boss_negotiations = ledger.boss_negotiations.saturating_add(1);
                ledger.current_session_score =
                    ledger.current_session_score.saturating_add(SCORE_BOSS_NEGOTIATED);
            }
            BossOutcome::Killed => {
                ledger.boss_kills = ledger.boss_kills.saturating_add(1);
                ledger.current_session_score =
                    ledger.current_session_score.saturating_add(SCORE_BOSS_KILL);
            }
        }

        ledger.boss_outcome_recorded = true;
        ledger.last_event_timestamp = timestamp;

        emit!(BossOutcomeRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            outcome,
            timestamp,
            current_session_score: ledger.current_session_score,
        });

        Ok(())
    }

    pub fn finalize_session(ctx: Context<FinalizeSession>, timestamp: i64) -> Result<()> {
        require_session_active(&ctx.accounts.player_ledger)?;

        let ledger = &mut ctx.accounts.player_ledger;
        let final_score = ledger.current_session_score;

        ledger.games_played = ledger.games_played.saturating_add(1);
        ledger.last_session_score = final_score;
        ledger.best_score = ledger.best_score.max(final_score);
        ledger.current_session_active = false;
        ledger.last_event_timestamp = timestamp;

        emit!(SessionFinalized {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            timestamp,
            session_score: final_score,
            best_score: ledger.best_score,
            games_played: ledger.games_played,
            session_kills: ledger.current_session_kills,
            session_creates: ledger.current_session_creates,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GameConfig::SIZE,
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    #[account(
        init,
        payer = player,
        space = 8 + PlayerLedger::SIZE,
        seeds = [PLAYER_LEDGER_SEED, player.key().as_ref()],
        bump
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartSession<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    #[account(
        mut,
        seeds = [PLAYER_LEDGER_SEED, player.key().as_ref()],
        bump = player_ledger.bump,
        has_one = player,
        constraint = player_ledger.game == game_config.key() @ ValkyrixLedgerError::GameMismatch
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordGameplayEvent<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    #[account(
        mut,
        seeds = [PLAYER_LEDGER_SEED, player.key().as_ref()],
        bump = player_ledger.bump,
        has_one = player,
        constraint = player_ledger.game == game_config.key() @ ValkyrixLedgerError::GameMismatch
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeSession<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    #[account(
        mut,
        seeds = [PLAYER_LEDGER_SEED, player.key().as_ref()],
        bump = player_ledger.bump,
        has_one = player,
        constraint = player_ledger.game == game_config.key() @ ValkyrixLedgerError::GameMismatch
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    pub player: Signer<'info>,
}

#[account]
pub struct GameConfig {
    pub authority: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

impl GameConfig {
    pub const SIZE: usize = 32 + 8 + 1;
}

#[account]
pub struct PlayerLedger {
    pub player: Pubkey,
    pub game: Pubkey,
    pub best_score: u64,
    pub last_session_score: u64,
    pub games_played: u32,
    pub total_kills: u32,
    pub total_creates: u32,
    pub boss_kills: u32,
    pub boss_negotiations: u32,
    pub current_session_nonce: u64,
    pub current_session_score: u64,
    pub current_session_kills: u32,
    pub current_session_creates: u32,
    pub current_session_active: bool,
    pub boss_outcome_recorded: bool,
    pub last_event_timestamp: i64,
    pub bump: u8,
}

impl PlayerLedger {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 4 + 4 + 4 + 4 + 4 + 8 + 8 + 4 + 4 + 1 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum BossOutcome {
    Negotiated,
    Killed,
}

#[event]
pub struct SessionStarted {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct KillRecorded {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub unit_type: String,
    pub timestamp: i64,
    pub total_kills: u32,
    pub current_session_score: u64,
}

#[event]
pub struct CreateRecorded {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub unit_type: String,
    pub timestamp: i64,
    pub total_creates: u32,
    pub current_session_score: u64,
}

#[event]
pub struct BossOutcomeRecorded {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub outcome: BossOutcome,
    pub timestamp: i64,
    pub current_session_score: u64,
}

#[event]
pub struct SessionFinalized {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub timestamp: i64,
    pub session_score: u64,
    pub best_score: u64,
    pub games_played: u32,
    pub session_kills: u32,
    pub session_creates: u32,
}

#[error_code]
pub enum ValkyrixLedgerError {
    #[msg("Gameplay event labels must not be empty.")]
    EmptyUnitType,
    #[msg("Gameplay event labels are too long.")]
    UnitTypeTooLong,
    #[msg("Session is not active.")]
    SessionNotActive,
    #[msg("This boss outcome was already recorded for the active session.")]
    BossOutcomeAlreadyRecorded,
    #[msg("Player ledger does not belong to the provided game config.")]
    GameMismatch,
}

fn validate_unit_type(unit_type: &str) -> Result<()> {
    require!(!unit_type.trim().is_empty(), ValkyrixLedgerError::EmptyUnitType);
    require!(
        unit_type.len() <= MAX_UNIT_TYPE_LEN,
        ValkyrixLedgerError::UnitTypeTooLong
    );
    Ok(())
}

fn require_session_active(ledger: &Account<PlayerLedger>) -> Result<()> {
    require!(
        ledger.current_session_active,
        ValkyrixLedgerError::SessionNotActive
    );
    Ok(())
}
