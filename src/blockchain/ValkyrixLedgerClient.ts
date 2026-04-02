import { Buffer } from 'buffer';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  VALKYRIX_GAME_CONFIG_SEED,
  VALKYRIX_LEDGER_PROGRAM_ID,
  VALKYRIX_PLAYER_LEDGER_SEED,
} from './blockchain.types';

export type ValkyrixBossOutcome = 'negotiated' | 'killed';
export type ValkyrixGameOutcome = 'win' | 'loss';
export type ValkyrixGameplayEntity =
  | 'attack-tower'
  | 'buff-tower'
  | 'light-ally'
  | 'heavy-ally'
  | 'collector'
  | 'berserker'
  | 'guardian'
  | 'light-enemy'
  | 'heavy-enemy'
  | 'ranged-enemy'
  | 'boss-enemy';

export type PlayerLedgerSnapshot = {
  player: string;
  game: string;
  bestScore: number;
  lastSessionScore: number;
  gamesPlayed: number;
  totalKills: number;
  totalCreates: number;
  bossKills: number;
  bossNegotiations: number;
  currentSessionNonce: bigint;
  currentSessionAuthority: string;
  currentSessionExpiresAt: bigint;
  currentSessionScore: number;
  currentSessionKills: number;
  currentSessionCreates: number;
  currentSessionActive: boolean;
  bossOutcomeRecorded: boolean;
  currentSessionEventIndex: bigint;
  gamesWon: number;
  wavesStarted: number;
  bump: number;
};

const PROGRAM_ID = new PublicKey(VALKYRIX_LEDGER_PROGRAM_ID);
const PLAYER_LEDGER_DISCRIMINATOR_LENGTH = 8;
const UTF8_ENCODER = new TextEncoder();

const IX_DISCRIMINATORS = {
  initializeGame: Uint8Array.from([44, 62, 102, 247, 126, 208, 130, 215]),
  initializePlayer: Uint8Array.from([79, 249, 88, 177, 220, 62, 56, 128]),
  startSession: Uint8Array.from([23, 227, 111, 142, 212, 230, 3, 175]),
  recordKill: Uint8Array.from([199, 67, 232, 200, 144, 122, 230, 56]),
  recordCreate: Uint8Array.from([15, 60, 43, 216, 1, 154, 130, 35]),
  recordBossOutcome: Uint8Array.from([224, 136, 7, 42, 188, 91, 114, 22]),
  recordWaveStart: Uint8Array.from([91, 138, 7, 89, 147, 116, 46, 213]),
  recordGameOutcome: Uint8Array.from([248, 171, 152, 92, 115, 193, 93, 72]),
  finalizeSession: Uint8Array.from([34, 148, 144, 47, 37, 130, 206, 161]),
} as const;

const GAMEPLAY_ENTITY_ORDER: readonly ValkyrixGameplayEntity[] = [
  'attack-tower',
  'buff-tower',
  'light-ally',
  'heavy-ally',
  'collector',
  'berserker',
  'guardian',
  'light-enemy',
  'heavy-enemy',
  'ranged-enemy',
  'boss-enemy',
] as const;

function encodeU64(value: bigint | number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}

function encodeI64(value: bigint | number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, BigInt(value), true);
  return bytes;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function encodeUtf8(value: string): Uint8Array {
  return UTF8_ENCODER.encode(value);
}

function encodeGameplayEntity(entity: ValkyrixGameplayEntity): Uint8Array {
  const variant = GAMEPLAY_ENTITY_ORDER.indexOf(entity);
  if (variant < 0) {
    throw new Error(`[ValkyrixLedgerClient] Unsupported gameplay entity: ${entity}`);
  }
  return Uint8Array.of(variant);
}

function asPublicKey(value: PublicKey | string): PublicKey {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
}

function readU64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true);
}

function readI64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true);
}

function readBool(data: Uint8Array, offset: number): boolean {
  return data[offset] === 1;
}

export class ValkyrixLedgerClient {
  readonly programId: PublicKey;

  constructor(programId: PublicKey | string = PROGRAM_ID) {
    this.programId = asPublicKey(programId);
  }

  deriveGameConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [encodeUtf8(VALKYRIX_GAME_CONFIG_SEED)],
      this.programId,
    )[0];
  }

  derivePlayerLedgerPda(player: PublicKey | string): PublicKey {
    const playerKey = asPublicKey(player);
    return PublicKey.findProgramAddressSync(
      [encodeUtf8(VALKYRIX_PLAYER_LEDGER_SEED), playerKey.toBytes()],
      this.programId,
    )[0];
  }

  buildInitializeGameInstruction(authority: PublicKey | string): TransactionInstruction {
    const authorityKey = asPublicKey(authority);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.deriveGameConfigPda(), isSigner: false, isWritable: true },
        { pubkey: authorityKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(IX_DISCRIMINATORS.initializeGame),
    });
  }

  buildInitializePlayerInstruction(player: PublicKey | string): TransactionInstruction {
    const playerKey = asPublicKey(player);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.deriveGameConfigPda(), isSigner: false, isWritable: false },
        { pubkey: this.derivePlayerLedgerPda(playerKey), isSigner: false, isWritable: true },
        { pubkey: playerKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(IX_DISCRIMINATORS.initializePlayer),
    });
  }

  buildStartSessionInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    sessionNonce: bigint | number,
    sessionExpiresAt: bigint | number,
  ): TransactionInstruction {
    const playerKey = asPublicKey(player);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.deriveGameConfigPda(), isSigner: false, isWritable: false },
        { pubkey: this.derivePlayerLedgerPda(playerKey), isSigner: false, isWritable: true },
        { pubkey: playerKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(concatBytes(
        IX_DISCRIMINATORS.startSession,
        encodeU64(sessionNonce),
        asPublicKey(sessionAuthority).toBytes(),
        encodeI64(sessionExpiresAt),
      )),
    });
  }

  buildRecordKillInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    entity: ValkyrixGameplayEntity,
    eventIndex: bigint | number,
  ): TransactionInstruction {
    return this.buildGameplayInstruction(
      player,
      sessionAuthority,
      concatBytes(IX_DISCRIMINATORS.recordKill, encodeGameplayEntity(entity), encodeU64(eventIndex)),
    );
  }

  buildRecordCreateInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    entity: ValkyrixGameplayEntity,
    eventIndex: bigint | number,
  ): TransactionInstruction {
    return this.buildGameplayInstruction(
      player,
      sessionAuthority,
      concatBytes(IX_DISCRIMINATORS.recordCreate, encodeGameplayEntity(entity), encodeU64(eventIndex)),
    );
  }

  buildRecordBossOutcomeInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    outcome: ValkyrixBossOutcome,
    eventIndex: bigint | number,
  ): TransactionInstruction {
    const encodedOutcome = Uint8Array.of(outcome === 'negotiated' ? 0 : 1);
    return this.buildGameplayInstruction(
      player,
      sessionAuthority,
      concatBytes(IX_DISCRIMINATORS.recordBossOutcome, encodedOutcome, encodeU64(eventIndex)),
    );
  }

  buildRecordWaveStartInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    waveNumber: number,
    eventIndex: bigint | number,
  ): TransactionInstruction {
    return this.buildGameplayInstruction(
      player,
      sessionAuthority,
      concatBytes(IX_DISCRIMINATORS.recordWaveStart, Uint8Array.of(waveNumber), encodeU64(eventIndex)),
    );
  }

  buildRecordGameOutcomeInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    outcome: ValkyrixGameOutcome,
    eventIndex: bigint | number,
  ): TransactionInstruction {
    const encodedOutcome = Uint8Array.of(outcome === 'win' ? 0 : 1);
    return this.buildGameplayInstruction(
      player,
      sessionAuthority,
      concatBytes(IX_DISCRIMINATORS.recordGameOutcome, encodedOutcome, encodeU64(eventIndex)),
    );
  }

  buildFinalizeSessionInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
  ): TransactionInstruction {
    return this.buildGameplayInstruction(player, sessionAuthority, IX_DISCRIMINATORS.finalizeSession);
  }

  decodePlayerLedgerAccount(rawData: Uint8Array): PlayerLedgerSnapshot | null {
    const data = rawData;
    if (data.length < PLAYER_LEDGER_DISCRIMINATOR_LENGTH + 183) {
      return null;
    }

    let offset = PLAYER_LEDGER_DISCRIMINATOR_LENGTH;
    const player = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const game = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const bestScore = Number(readU64(data, offset));
    offset += 8;
    const lastSessionScore = Number(readU64(data, offset));
    offset += 8;
    const gamesPlayed = readU32(data, offset);
    offset += 4;
    const totalKills = readU32(data, offset);
    offset += 4;
    const totalCreates = readU32(data, offset);
    offset += 4;
    const bossKills = readU32(data, offset);
    offset += 4;
    const bossNegotiations = readU32(data, offset);
    offset += 4;
    const currentSessionNonce = readU64(data, offset);
    offset += 8;
    const currentSessionAuthority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const currentSessionExpiresAt = readI64(data, offset);
    offset += 8;
    const currentSessionScore = Number(readU64(data, offset));
    offset += 8;
    const currentSessionKills = readU32(data, offset);
    offset += 4;
    const currentSessionCreates = readU32(data, offset);
    offset += 4;
    const currentSessionActive = readBool(data, offset);
    offset += 1;
    const bossOutcomeRecorded = readBool(data, offset);
    offset += 1;
    const currentSessionEventIndex = readU64(data, offset);
    offset += 8;
    const gamesWon = readU32(data, offset);
    offset += 4;
    const wavesStarted = readU32(data, offset);
    offset += 4;
    const bump = data[offset] ?? 0;

    return {
      player: player.toBase58(),
      game: game.toBase58(),
      bestScore,
      lastSessionScore,
      gamesPlayed,
      totalKills,
      totalCreates,
      bossKills,
      bossNegotiations,
      currentSessionNonce,
      currentSessionAuthority: currentSessionAuthority.toBase58(),
      currentSessionExpiresAt,
      currentSessionScore,
      currentSessionKills,
      currentSessionCreates,
      currentSessionActive,
      bossOutcomeRecorded,
      currentSessionEventIndex,
      gamesWon,
      wavesStarted,
      bump,
    };
  }

  private buildGameplayInstruction(
    player: PublicKey | string,
    sessionAuthority: PublicKey | string,
    data: Uint8Array,
  ): TransactionInstruction {
    const playerKey = asPublicKey(player);
    const sessionAuthorityKey = asPublicKey(sessionAuthority);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.deriveGameConfigPda(), isSigner: false, isWritable: false },
        { pubkey: this.derivePlayerLedgerPda(playerKey), isSigner: false, isWritable: true },
        { pubkey: playerKey, isSigner: false, isWritable: false },
        { pubkey: sessionAuthorityKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }
}
