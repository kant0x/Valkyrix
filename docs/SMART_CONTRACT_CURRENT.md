# Valkyrix Smart Contract Current Spec

## Overview

`Valkyrix Ledger` is the Solana Anchor program that stores match-session events and player score state for `Valkyrix`.

Current program id:

- `NkxXENw6u1jWc8iUo28M9NiDVEcoUdqGiGZ3TyNf9Xn`

Current role:

- on-chain session ledger
- score accumulator
- per-player match history PDA

Not yet its role:

- authoritative combat simulation
- fully trustless anti-cheat layer

## Location

- `anchor/Anchor.toml`
- `anchor/programs/valkyrix_ledger/Cargo.toml`
- `anchor/programs/valkyrix_ledger/src/lib.rs`

## Account Model

`GameConfig`

- PDA seed: `["game-config"]`
- stores game authority metadata

`PlayerLedger`

- PDA seed: `["player-ledger", player_pubkey]`
- one ledger per wallet
- stores best score, games played, totals, and active session state

## Instructions

1. `initialize_game`
2. `initialize_player`
3. `start_session(session_nonce)`
4. `record_kill(entity, event_index)`
5. `record_create(entity, event_index)`
6. `record_boss_outcome(outcome, event_index)`
7. `finalize_session()`

## Current Safety Model

What is now enforced on-chain:

- session cannot be started while already active
- session nonce must strictly increase
- gameplay events must arrive in strict order through `event_index`
- kill/create events use constrained enum entities instead of free-form strings
- boss outcome cannot be recorded twice in one session
- boss outcome requires prior session activity
- event time is taken from chain clock in emitted events, not from the raw client payload

What is still not fully solved:

- the browser client is still the source of gameplay events
- a determined player can still try to abuse event submission without a trusted execution path
- full trust minimization still requires MagicBlock delegation or another authoritative execution layer

## Gameplay Entity Enum

The contract accepts only these gameplay entities:

- `attack-tower`
- `buff-tower`
- `light-ally`
- `heavy-ally`
- `collector`
- `berserker`
- `guardian`
- `light-enemy`
- `heavy-enemy`
- `ranged-enemy`
- `boss-enemy`

## Score Rules

Current score weights:

- enemy kill: `+10`
- create tower or recruit unit: `+1`
- boss outcome: `+1000`

## Client Integration

The game client is wired to this program through:

- `src/blockchain/ValkyrixLedgerClient.ts`
- `src/blockchain/BlockchainService.ts`

Current flow:

1. Match start checks and initializes `GameConfig` and `PlayerLedger` if needed.
2. Match start sends `start_session`.
3. Tower creation and unit recruitment send `record_create`.
4. Enemy kills send `record_kill`.
5. Boss outcome sends `record_boss_outcome`.
6. Match end sends `finalize_session`.

The client serializes these writes so `event_index` stays ordered even if gameplay events fire close together.

## MagicBlock Position

The intended production flow is:

1. Deploy `Valkyrix Ledger`
2. Open a battle session
3. Delegate relevant accounts into MagicBlock ER
4. Execute gameplay events through the delegated session
5. Finalize and commit back to Solana

That means:

- the smart contract holds rules and ledger state
- MagicBlock provides the fast execution layer for those instructions

## Current Honest Status

The integration is now contract-backed, not memo-backed.

Still required for a full production-grade flow:

- live redeploy of the updated Anchor program
- funded wallet verification on devnet
- real MagicBlock delegation and undelegation around the session accounts
- Anchor abuse-path tests

## Deployment Note

This hardening pass keeps `PlayerLedger` account size unchanged, so existing PDA accounts do not need a size migration for this schema update.
