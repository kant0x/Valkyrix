use anchor_lang::prelude::*;

declare_id!("NkxXENw6u1jWc8iUo28M9NiDVEcoUdqGiGZ3TyNf9Xn");

const GAME_CONFIG_SEED: &[u8] = b"game-config";
const PLAYER_LEDGER_SEED: &[u8] = b"player-ledger";
const SCORE_PER_KILL: u64 = 10;
const SCORE_PER_CREATE: u64 = 1;
const SCORE_BOSS_KILL: u64 = 1_000;
const SCORE_BOSS_NEGOTIATED: u64 = 1_000;
const MIN_ACTIVITY_BEFORE_BOSS: u64 = 1;

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
        ledger.current_session_authority = Pubkey::default();
        ledger.current_session_expires_at = 0;
        ledger.current_session_score = 0;
        ledger.current_session_kills = 0;
        ledger.current_session_creates = 0;
        ledger.current_session_active = false;
        ledger.boss_outcome_recorded = false;
        ledger.current_session_event_index = 0;
        ledger.games_won = 0;
        ledger.waves_started = 0;
        ledger.bump = ctx.bumps.player_ledger;
        Ok(())
    }

    pub fn start_session(
        ctx: Context<StartSession>,
        session_nonce: u64,
        session_authority: Pubkey,
        session_expires_at: i64,
    ) -> Result<()> {
        let ledger = &mut ctx.accounts.player_ledger;
        require!(
            !ledger.current_session_active,
            ValkyrixLedgerError::SessionAlreadyActive
        );
        require!(
            session_nonce > ledger.current_session_nonce,
            ValkyrixLedgerError::SessionNonceNotIncreasing
        );

        let timestamp = Clock::get()?.unix_timestamp;

        ledger.current_session_nonce = session_nonce;
        ledger.current_session_authority = session_authority;
        ledger.current_session_expires_at = session_expires_at;
        ledger.current_session_score = 0;
        ledger.current_session_kills = 0;
        ledger.current_session_creates = 0;
        ledger.current_session_active = true;
        ledger.boss_outcome_recorded = false;
        ledger.current_session_event_index = 0;

        emit!(SessionStarted {
            player: ledger.player,
            session_nonce,
            timestamp,
        });

        Ok(())
    }

    pub fn record_kill(
        ctx: Context<RecordGameplayEvent>,
        entity: GameplayEntity,
        event_index: u64,
    ) -> Result<()> {
        require_session_write_access(
            &ctx.accounts.player_ledger,
            ctx.accounts.session_authority.key(),
        )?;
        require!(
            entity.is_kill_entity(),
            ValkyrixLedgerError::InvalidKillEntity
        );

        let ledger = &mut ctx.accounts.player_ledger;
        let timestamp = apply_ordered_event(ledger, event_index)?;
        ledger.total_kills = ledger.total_kills.saturating_add(1);
        ledger.current_session_kills = ledger.current_session_kills.saturating_add(1);
        ledger.current_session_score = ledger.current_session_score.saturating_add(SCORE_PER_KILL);

        emit!(KillRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            entity,
            event_index,
            timestamp,
            total_kills: ledger.total_kills,
            current_session_score: ledger.current_session_score,
        });

        Ok(())
    }

    pub fn record_create(
        ctx: Context<RecordGameplayEvent>,
        entity: GameplayEntity,
        event_index: u64,
    ) -> Result<()> {
        require_session_write_access(
            &ctx.accounts.player_ledger,
            ctx.accounts.session_authority.key(),
        )?;
        require!(
            entity.is_create_entity(),
            ValkyrixLedgerError::InvalidCreateEntity
        );

        let ledger = &mut ctx.accounts.player_ledger;
        let timestamp = apply_ordered_event(ledger, event_index)?;
        ledger.total_creates = ledger.total_creates.saturating_add(1);
        ledger.current_session_creates = ledger.current_session_creates.saturating_add(1);
        ledger.current_session_score = ledger.current_session_score.saturating_add(SCORE_PER_CREATE);

        emit!(CreateRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            entity,
            event_index,
            timestamp,
            total_creates: ledger.total_creates,
            current_session_score: ledger.current_session_score,
        });

        Ok(())
    }

    pub fn record_boss_outcome(
        ctx: Context<RecordGameplayEvent>,
        outcome: BossOutcome,
        event_index: u64,
    ) -> Result<()> {
        require_session_write_access(
            &ctx.accounts.player_ledger,
            ctx.accounts.session_authority.key(),
        )?;

        let ledger = &mut ctx.accounts.player_ledger;
        require!(
            !ledger.boss_outcome_recorded,
            ValkyrixLedgerError::BossOutcomeAlreadyRecorded
        );
        require!(
            ledger.current_session_event_index >= MIN_ACTIVITY_BEFORE_BOSS,
            ValkyrixLedgerError::BossOutcomeLocked
        );

        let timestamp = apply_ordered_event(ledger, event_index)?;

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

        emit!(BossOutcomeRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            outcome,
            event_index,
            timestamp,
            current_session_score: ledger.current_session_score,
        });

        Ok(())
    }

    pub fn record_wave_start(
        ctx: Context<RecordGameplayEvent>,
        wave_number: u8,
        event_index: u64,
    ) -> Result<()> {
        require_session_write_access(
            &ctx.accounts.player_ledger,
            ctx.accounts.session_authority.key(),
        )?;
        let ledger = &mut ctx.accounts.player_ledger;
        let timestamp = apply_ordered_event(ledger, event_index)?;
        ledger.waves_started = ledger.waves_started.saturating_add(1);
        emit!(WaveStarted {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            wave_number,
            event_index,
            timestamp,
        });
        Ok(())
    }

    pub fn record_game_outcome(
        ctx: Context<RecordGameplayEvent>,
        outcome: GameOutcome,
        event_index: u64,
    ) -> Result<()> {
        require_session_write_access(
            &ctx.accounts.player_ledger,
            ctx.accounts.session_authority.key(),
        )?;
        let ledger = &mut ctx.accounts.player_ledger;
        let timestamp = apply_ordered_event(ledger, event_index)?;
        if outcome == GameOutcome::Win {
            ledger.games_won = ledger.games_won.saturating_add(1);
        }
        emit!(GameOutcomeRecorded {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            outcome,
            event_index,
            timestamp,
        });
        Ok(())
    }

    pub fn finalize_session(ctx: Context<FinalizeSession>) -> Result<()> {
        require_session_finalize_access(
            &ctx.accounts.player_ledger,
            ctx.accounts.session_authority.key(),
        )?;

        let ledger = &mut ctx.accounts.player_ledger;
        let final_score = ledger.current_session_score;
        let timestamp = Clock::get()?.unix_timestamp;

        ledger.games_played = ledger.games_played.saturating_add(1);
        ledger.last_session_score = final_score;
        ledger.best_score = ledger.best_score.max(final_score);
        ledger.current_session_active = false;
        ledger.current_session_authority = Pubkey::default();
        ledger.current_session_expires_at = 0;

        emit!(SessionFinalized {
            player: ledger.player,
            session_nonce: ledger.current_session_nonce,
            timestamp,
            session_score: final_score,
            best_score: ledger.best_score,
            games_played: ledger.games_played,
            session_kills: ledger.current_session_kills,
            session_creates: ledger.current_session_creates,
            last_event_index: ledger.current_session_event_index,
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
        realloc = 8 + PlayerLedger::SIZE,
        realloc::payer = player,
        realloc::zero = false,
        seeds = [PLAYER_LEDGER_SEED, player.key().as_ref()],
        bump = player_ledger.bump,
        has_one = player,
        constraint = player_ledger.game == game_config.key() @ ValkyrixLedgerError::GameMismatch
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
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
        constraint = player.key() == player_ledger.player @ ValkyrixLedgerError::InvalidPlayerAccount,
        constraint = player_ledger.game == game_config.key() @ ValkyrixLedgerError::GameMismatch
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    /// CHECK: used only for PDA seed derivation and equality check against player_ledger.player
    pub player: UncheckedAccount<'info>,
    #[account(
        address = player_ledger.current_session_authority @ ValkyrixLedgerError::InvalidSessionAuthority
    )]
    pub session_authority: Signer<'info>,
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
        constraint = player.key() == player_ledger.player @ ValkyrixLedgerError::InvalidPlayerAccount,
        constraint = player_ledger.game == game_config.key() @ ValkyrixLedgerError::GameMismatch
    )]
    pub player_ledger: Account<'info, PlayerLedger>,
    /// CHECK: used only for PDA seed derivation and equality check against player_ledger.player
    pub player: UncheckedAccount<'info>,
    #[account(
        address = player_ledger.current_session_authority @ ValkyrixLedgerError::InvalidSessionAuthority
    )]
    pub session_authority: Signer<'info>,
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
    pub current_session_authority: Pubkey,
    pub current_session_expires_at: i64,
    pub current_session_score: u64,
    pub current_session_kills: u32,
    pub current_session_creates: u32,
    pub current_session_active: bool,
    pub boss_outcome_recorded: bool,
    pub current_session_event_index: u64,
    pub games_won: u32,
    pub waves_started: u32,
    pub bump: u8,
}

impl PlayerLedger {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 4 + 4 + 4 + 4 + 4 + 8 + 32 + 8 + 8 + 4 + 4 + 1 + 1 + 8 + 4 + 4 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameplayEntity {
    AttackTower,
    BuffTower,
    LightAlly,
    HeavyAlly,
    Collector,
    Berserker,
    Guardian,
    LightEnemy,
    HeavyEnemy,
    RangedEnemy,
    BossEnemy,
}

impl GameplayEntity {
    pub fn is_kill_entity(self) -> bool {
        matches!(
            self,
            Self::LightEnemy | Self::HeavyEnemy | Self::RangedEnemy | Self::BossEnemy
                | Self::LightAlly | Self::HeavyAlly | Self::Berserker | Self::Guardian | Self::Collector
        )
    }

    pub fn is_create_entity(self) -> bool {
        matches!(
            self,
            Self::AttackTower
                | Self::BuffTower
                | Self::LightAlly
                | Self::HeavyAlly
                | Self::Collector
                | Self::Berserker
                | Self::Guardian
        )
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum BossOutcome {
    Negotiated,
    Killed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameOutcome {
    Win,
    Loss,
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
    pub entity: GameplayEntity,
    pub event_index: u64,
    pub timestamp: i64,
    pub total_kills: u32,
    pub current_session_score: u64,
}

#[event]
pub struct CreateRecorded {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub entity: GameplayEntity,
    pub event_index: u64,
    pub timestamp: i64,
    pub total_creates: u32,
    pub current_session_score: u64,
}

#[event]
pub struct BossOutcomeRecorded {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub outcome: BossOutcome,
    pub event_index: u64,
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
    pub last_event_index: u64,
}

#[event]
pub struct WaveStarted {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub wave_number: u8,
    pub event_index: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameOutcomeRecorded {
    pub player: Pubkey,
    pub session_nonce: u64,
    pub outcome: GameOutcome,
    pub event_index: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ValkyrixLedgerError {
    #[msg("Session is not active.")]
    SessionNotActive,
    #[msg("A session is already active for this player.")]
    SessionAlreadyActive,
    #[msg("Session nonce must strictly increase.")]
    SessionNonceNotIncreasing,
    #[msg("This boss outcome was already recorded for the active session.")]
    BossOutcomeAlreadyRecorded,
    #[msg("Boss outcome cannot be recorded before any prior session activity.")]
    BossOutcomeLocked,
    #[msg("Gameplay event index is out of order for the active session.")]
    SessionEventOutOfOrder,
    #[msg("Player ledger does not belong to the provided game config.")]
    GameMismatch,
    #[msg("Player account does not match the player ledger owner.")]
    InvalidPlayerAccount,
    #[msg("Session authority does not match the active session signer.")]
    InvalidSessionAuthority,
    #[msg("The active gameplay session has expired.")]
    SessionExpired,
    #[msg("Kill events must target enemy entities only.")]
    InvalidKillEntity,
    #[msg("Create events must target buildable or recruitable entities only.")]
    InvalidCreateEntity,
}

fn require_session_active(ledger: &Account<PlayerLedger>) -> Result<()> {
    require!(
        ledger.current_session_active,
        ValkyrixLedgerError::SessionNotActive
    );
    Ok(())
}

fn require_session_write_access(ledger: &Account<PlayerLedger>, signer: Pubkey) -> Result<()> {
    require_session_active(ledger)?;
    require!(
        ledger.current_session_authority == signer,
        ValkyrixLedgerError::InvalidSessionAuthority
    );
    require!(
        Clock::get()?.unix_timestamp <= ledger.current_session_expires_at,
        ValkyrixLedgerError::SessionExpired
    );
    Ok(())
}

fn require_session_finalize_access(ledger: &Account<PlayerLedger>, signer: Pubkey) -> Result<()> {
    require_session_active(ledger)?;
    require!(
        ledger.current_session_authority == signer,
        ValkyrixLedgerError::InvalidSessionAuthority
    );
    Ok(())
}

fn apply_ordered_event(ledger: &mut Account<PlayerLedger>, event_index: u64) -> Result<i64> {
    let expected = ledger.current_session_event_index.saturating_add(1);
    require!(
        event_index == expected,
        ValkyrixLedgerError::SessionEventOutOfOrder
    );
    ledger.current_session_event_index = event_index;
    Ok(Clock::get()?.unix_timestamp)
}
