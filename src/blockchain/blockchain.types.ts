/** Payload sent with each kill transaction to Solana devnet via MagicBlock ER. */
export interface KillPayload {
  walletPubkey: string;
  unitType: string;
  timestamp: number;
}

/** Payload sent when the player creates their own unit. */
export interface CreatePayload {
  walletPubkey: string;
  unitType: string;
  timestamp: number;
}

/** Payload sent when the player resolves a boss encounter. */
export interface BossOutcomePayload {
  walletPubkey: string;
  outcome: 'negotiated' | 'killed';
  timestamp: number;
}

/** One entry in the on-chain leaderboard fetched via SOAR SDK. */
export interface LeaderboardEntry {
  player: string;
  score: number;
  kills: number;
  rank: number;
}

export const MAGIC_ROUTER_DEVNET = 'https://devnet-router.magicblock.app/';
export const MAGIC_ROUTER_WS_DEVNET = 'wss://devnet-router.magicblock.app/';
/** Replace after deploying the Anchor program to devnet. */
export const VALKYRIX_LEDGER_PROGRAM_ID = 'Esj1LL1kQTYZ6kVi2wbiJiHbEs3cAiW6dDsZyjdZpmNo';
export const VALKYRIX_GAME_CONFIG_SEED = 'game-config';
export const VALKYRIX_PLAYER_LEDGER_SEED = 'player-ledger';

/**
 * One-time SOAR devnet PDAs.
 * Fill these after running `npm run init:soar:devnet`.
 */
export const SOAR_GAME_PDA = 'B8HpRRZk9LhmJhoLmggSuFBDaBaFUwJ2sjWR8hWcqpf7';
export const SOAR_LEADERBOARD_PDA = 'Aznk19dV2s2ffSoE9Kq3fHH2Nj5DNZUWNrpqHxaKLFu2';
