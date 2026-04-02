import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { ValkyrixLedgerClient } from './ValkyrixLedgerClient';

const TEST_WALLET = '11111111111111111111111111111111';

function writeU32(bytes: Uint8Array, offset: number, value: number): number {
  new DataView(bytes.buffer).setUint32(offset, value, true);
  return offset + 4;
}

function writeU64(bytes: Uint8Array, offset: number, value: bigint | number): number {
  new DataView(bytes.buffer).setBigUint64(offset, BigInt(value), true);
  return offset + 8;
}

describe('ValkyrixLedgerClient', () => {
  it('builds record_kill instructions for the ledger program', () => {
    const customProgramId = new PublicKey(new Uint8Array(32).fill(9));
    const client = new ValkyrixLedgerClient(customProgramId);
    vi.spyOn(client, 'deriveGameConfigPda').mockReturnValue(new PublicKey(new Uint8Array(32).fill(10)));
    vi.spyOn(client, 'derivePlayerLedgerPda').mockReturnValue(new PublicKey(new Uint8Array(32).fill(11)));
    const sessionAuthority = new PublicKey(new Uint8Array(32).fill(12));
    const instruction = client.buildRecordKillInstruction(TEST_WALLET, sessionAuthority, 'heavy-enemy', 123n);
    const encodedEntity = instruction.data[8];
    const encodedEventIndex = new DataView(
      instruction.data.buffer,
      instruction.data.byteOffset + 9,
      8,
    ).getBigUint64(0, true);

    expect(instruction.programId.toBase58()).toBe(customProgramId.toBase58());
    expect(Array.from(instruction.data.slice(0, 8))).toEqual([199, 67, 232, 200, 144, 122, 230, 56]);
    expect(encodedEntity).toBe(8);
    expect(encodedEventIndex).toBe(123n);
    expect(instruction.keys).toHaveLength(4);
    expect(instruction.keys[1]?.isWritable).toBe(true);
    expect(instruction.keys[2]?.isSigner).toBe(false);
    expect(instruction.keys[3]?.pubkey.toBase58()).toBe(sessionAuthority.toBase58());
    expect(instruction.keys[3]?.isSigner).toBe(true);
  });

  it('decodes a player ledger account snapshot', () => {
    const client = new ValkyrixLedgerClient();
    const game = new PublicKey(new Uint8Array(32).fill(8));
    const sessionAuthority = new PublicKey(new Uint8Array(32).fill(9));
    const raw = new Uint8Array(191);
    let offset = 8;

    raw.set(new PublicKey(TEST_WALLET).toBytes(), offset);
    offset += 32;
    raw.set(game.toBytes(), offset);
    offset += 32;
    offset = writeU64(raw, offset, 110n);
    offset = writeU64(raw, offset, 77n);
    offset = writeU32(raw, offset, 4);
    offset = writeU32(raw, offset, 22);
    offset = writeU32(raw, offset, 11);
    offset = writeU32(raw, offset, 1);
    offset = writeU32(raw, offset, 2);
    offset = writeU64(raw, offset, 55n);
    raw.set(sessionAuthority.toBytes(), offset);
    offset += 32;
    offset = writeU64(raw, offset, 999n);
    offset = writeU64(raw, offset, 77n);
    offset = writeU32(raw, offset, 5);
    offset = writeU32(raw, offset, 3);
    raw[offset] = 1;
    offset += 1;
    raw[offset] = 1;
    offset += 1;
    offset = writeU64(raw, offset, 777n);
    offset = writeU32(raw, offset, 7);
    offset = writeU32(raw, offset, 15);
    raw[offset] = 254;

    const snapshot = client.decodePlayerLedgerAccount(raw);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.player).toBe(TEST_WALLET);
    expect(snapshot?.game).toBe(game.toBase58());
    expect(snapshot?.bestScore).toBe(110);
    expect(snapshot?.currentSessionAuthority).toBe(sessionAuthority.toBase58());
    expect(snapshot?.currentSessionExpiresAt).toBe(999n);
    expect(snapshot?.currentSessionScore).toBe(77);
    expect(snapshot?.currentSessionKills).toBe(5);
    expect(snapshot?.currentSessionCreates).toBe(3);
    expect(snapshot?.currentSessionActive).toBe(true);
    expect(snapshot?.bossOutcomeRecorded).toBe(true);
    expect(snapshot?.currentSessionEventIndex).toBe(777n);
    expect(snapshot?.gamesWon).toBe(7);
    expect(snapshot?.wavesStarted).toBe(15);
    expect(snapshot?.bump).toBe(254);
  });
});
