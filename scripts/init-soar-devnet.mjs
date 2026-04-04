#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import anchorPkg from '@coral-xyz/anchor';
import soarPkg from '@magicblock-labs/soar-sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

const { AnchorProvider, Wallet, BN } = anchorPkg;
const { SoarProgram, Genre, GameType } = soarPkg;

const DEVNET_RPC = 'https://api.devnet.solana.com';
const ZERO_PUBKEY = new PublicKey('11111111111111111111111111111111');

function resolveKeypairPath() {
  const candidates = [
    process.env.SOLANA_KEYPAIR_PATH,
    process.env.SOLANA_KEYPAIR,
    join(homedir(), '.config', 'solana', 'id.json'),
    process.env.APPDATA ? join(process.env.APPDATA, 'Solana', 'id.json') : null,
  ].filter(Boolean);

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      [
        'Solana keypair not found.',
        'Expected one of:',
        ...candidates.map((candidate) => `- ${candidate}`),
        'Set SOLANA_KEYPAIR_PATH to your id.json file or run `solana-keygen new` first.',
      ].join('\n'),
    );
  }

  return found;
}

async function main() {
  const keypairPath = resolveKeypairPath();
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const gameKeypair = Keypair.generate();

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const provider = new AnchorProvider(connection, new Wallet(authority), {
    commitment: 'confirmed',
  });
  const soar = SoarProgram.get(provider);

  console.log('Authority:', authority.publicKey.toString());
  console.log('Keypair:', keypairPath);
  console.log('Initializing Valkyrix game on SOAR devnet...');

  const gameInit = await soar.initializeNewGame(
    gameKeypair.publicKey,
    'Valkyrix',
    'On-chain leaderboard for Valkyrix matches',
    Genre.Action,
    GameType.Web,
    ZERO_PUBKEY,
    [authority.publicKey],
  );
  await soar.sendAndConfirmTransaction(gameInit.transaction, [gameKeypair]);

  const leaderboardInit = await soar.addNewGameLeaderBoard(
    gameInit.newGame,
    authority.publicKey,
    'Valkyrix session ranking',
    ZERO_PUBKEY,
    100,
    false,
    0,
    new BN(0),
    new BN(999999999),
    false,
  );
  await soar.sendAndConfirmTransaction(leaderboardInit.transaction);

  console.log('GAME_PDA:', gameInit.newGame.toString());
  console.log('LEADERBOARD_PDA:', leaderboardInit.newLeaderBoard.toString());
  console.log('');
  console.log('Paste these into src/blockchain/blockchain.types.ts:');
  console.log(`export const SOAR_GAME_PDA = '${gameInit.newGame.toString()}';`);
  console.log(`export const SOAR_LEADERBOARD_PDA = '${leaderboardInit.newLeaderBoard.toString()}';`);
}

main().catch((error) => {
  console.error('[init:soar:devnet] failed:', error);
  process.exitCode = 1;
});
