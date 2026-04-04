# Valkyrix Smart Contract Bible

## Purpose

This document is the source of truth for the current `Valkyrix Ledger` smart contract state:

- what the contract does well
- what is broken or unsafe
- what still depends on the client
- what must be fixed before the contract can be treated as trusted game infrastructure

Primary code references:

- [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- [Anchor.toml](/e:/py_scrypt/карта валкирикс/anchor/Anchor.toml)
- [BlockchainService.ts](/e:/py_scrypt/карта валкирикс/src/blockchain/BlockchainService.ts)
- [ValkyrixLedgerClient.ts](/e:/py_scrypt/карта валкирикс/src/blockchain/ValkyrixLedgerClient.ts)

Program id:

- `NkxXENw6u1jWc8iUo28M9NiDVEcoUdqGiGZ3TyNf9Xn`

Current role of the contract:

- event ledger
- score accumulator
- player session ledger

Current non-role of the contract:

- authoritative combat engine
- anti-cheat enforcement layer
- fully trustless leaderboard source

## Current Contract Snapshot

The contract currently exposes these instructions:

1. `initialize_game`
2. `initialize_player`
3. `start_session`
4. `record_kill`
5. `record_create`
6. `record_boss_outcome`
7. `finalize_session`

The on-chain model is simple:

- one global `GameConfig`
- one `PlayerLedger` PDA per player wallet

This is good for simplicity, but it means almost all trust currently sits in the client that calls the instructions.

## Severity Scale

- `Critical`: can directly break trust, fairness, or the economic meaning of the contract
- `High`: major design/security flaw, but not the single most catastrophic one
- `Medium`: important robustness or maintainability issue
- `Low`: cleanup, clarity, or future-proofing issue

## Problem Register

### SC-001: Client-authoritative scoring

- Severity: `Critical`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instructions affected: `record_kill`, `record_create`, `record_boss_outcome`
- Problem:
  The contract accepts gameplay events from the player's own signer without any proof that the event actually happened in the match.
- Why this matters:
  A player can call `record_kill` manually in a loop and inflate score.
- Impact:
  The leaderboard is not trust-minimized. It is only a signed client report.
- Required fix:
  Move event authority out of the raw client path. At minimum, use a delegated trusted execution path. Ideally, move critical match-state transitions into an authoritative execution layer.
- Status: `Open`

### SC-002: Boss negotiation reward is trivially forgeable

- Severity: `Critical`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instruction affected: `record_boss_outcome`
- Problem:
  Boss outcome scoring was previously over-incentivized; current target is `+1000` rather than `+10000`.
- Why this matters:
  This is the single highest-value scoring event in the system and is currently the easiest event to fake.
- Impact:
  Any player can open a session and write a near-winning score in one call.
- Required fix:
  Tie boss outcome to verifiable match state. Do not let the raw client submit this outcome without an authoritative precondition.
- Status: `Partially Fixed`

### SC-003: Session can be restarted while already active

- Severity: `High`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instruction affected: `start_session`
- Problem:
  `start_session` resets current counters and marks the session active, but does not reject starting a new session on top of an already active one.
- Why this matters:
  This lets the client rewrite the active session boundary whenever it wants.
- Impact:
  Session lifecycle is weak and hard to reason about.
- Required fix:
  Add `SessionAlreadyActive` and reject `start_session` unless the previous session is finalized or explicitly aborted through a controlled path.
- Status: `Fixed`

### SC-004: No event ordering guarantees

- Severity: `High`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instructions affected: all gameplay event instructions
- Problem:
  The contract does not enforce any ordering or progression for events.
- Why this matters:
  Events can be replayed in arbitrary shape from the client.
- Impact:
  The ledger can describe impossible matches.
- Required fix:
  Introduce ordered event sequence checks, session phase markers, or authoritative relay execution.
- Status: `Partially Fixed`

### SC-005: No whitelist for valid unit/build labels

- Severity: `High`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instructions affected: `record_kill`, `record_create`
- Problem:
  The contract only checks `unit_type` length and emptiness. It does not validate that the label belongs to a known game entity.
- Why this matters:
  A client can emit arbitrary event names that have no meaning in the actual game.
- Impact:
  Event data is noisy, ambiguous, and harder to audit.
- Required fix:
  Replace free-form strings with a constrained enum or validated numeric code.
- Status: `Fixed`

### SC-006: Timestamp is fully client-controlled

- Severity: `Medium`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instructions affected: all event writes and `finalize_session`
- Problem:
  The contract trusts the timestamp passed by the client and writes it into ledger state.
- Why this matters:
  The event history can be made misleading.
- Impact:
  Timing analytics and audit trails are weak.
- Required fix:
  Use `Clock::get()?.unix_timestamp` for authoritative event time, or at least validate the client timestamp against chain time.
- Status: `Fixed`

### SC-007: Session nonce is not validated

- Severity: `Medium`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instruction affected: `start_session`
- Problem:
  `session_nonce` is accepted from the client with no monotonicity or uniqueness rule.
- Why this matters:
  Session identifiers are currently just client suggestions.
- Impact:
  Session analytics and event grouping are less reliable.
- Required fix:
  Either generate nonce from on-chain state or enforce monotonic increment / uniqueness.
- Status: `Fixed`

### SC-008: `GameConfig.authority` is not meaningfully used

- Severity: `Medium`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Problem:
  The contract stores an authority in `GameConfig`, but there are no authority-gated administrative instructions that make this field operationally important.
- Why this matters:
  The data model suggests governance exists, but runtime behavior does not use it.
- Impact:
  The contract has dead authority metadata and unclear ownership semantics.
- Required fix:
  Either add explicit authority-controlled actions or remove/reduce the field until needed.
- Status: `Open`

### SC-009: Finalization trusts manipulated session state

- Severity: `Medium`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instruction affected: `finalize_session`
- Problem:
  `finalize_session` is structurally sound, but it finalizes whatever score the current session accumulated, even if that score was built from forged client events.
- Why this matters:
  Finalization is not the problem by itself, but it seals an already untrusted event stream.
- Impact:
  `best_score` and `games_played` look authoritative while still depending on untrusted inputs.
- Required fix:
  Fix event authority first. Then `finalize_session` becomes meaningful.
- Status: `Open`

### SC-010: No contract-side rate limiting or replay controls

- Severity: `Medium`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Problem:
  The same player can repeatedly send gameplay instructions as fast as the network allows.
- Why this matters:
  Spam and replay are not constrained by business rules.
- Impact:
  Abuse and noisy event ledgers.
- Required fix:
  Introduce sequence numbers, event counters, or trusted relay / delegation checks.
- Status: `Partially Fixed`

### SC-011: No Anchor integration tests for abuse cases

- Severity: `Medium`
- Location: [anchor](/e:/py_scrypt/карта валкирикс/anchor)
- Problem:
  I do not see dedicated Anchor tests covering:
  `double start_session`, forged boss outcome, repeated kill spam, invalid ordering, or authority mismatches.
- Why this matters:
  The most important contract properties are not automatically verified.
- Impact:
  Regressions can ship unnoticed.
- Required fix:
  Add program tests for both happy path and malicious path.
- Status: `Open`

### SC-012: `PlayerLedger` keeps stale session counters after finalize

- Severity: `Low`
- Location: [lib.rs](/e:/py_scrypt/карта валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)
- Instruction affected: `finalize_session`
- Problem:
  `current_session_score`, `current_session_kills`, and `current_session_creates` are not zeroed during `finalize_session`; they are only reset on the next `start_session`.
- Why this matters:
  This is not a direct security flaw, but it can confuse downstream readers.
- Impact:
  Ledger interpretation is slightly less clean.
- Required fix:
  Either zero them on finalize or document that they intentionally preserve the last finalized session snapshot until the next start.
- Status: `Accepted Risk`

### SC-013: Documentation is internally inconsistent

- Severity: `Low`
- Location: [SMART_CONTRACT.md](/e:/py_scrypt/карта валкирикс/docs/SMART_CONTRACT.md)
- Problem:
  The doc still contains outdated statements that mention memo-placeholder TX while the current client already sends real contract instructions.
- Why this matters:
  Devs can follow the wrong mental model.
- Impact:
  Slow debugging and deployment mistakes.
- Required fix:
  Align docs with the current client and keep this Bible as the issue register.
- Status: `Fixed`

## What Is Already Good

- The account model is simple and understandable.
- PDA derivation is deterministic and easy to reason about.
- `has_one = player` and `game mismatch` constraints are present.
- `boss_outcome_recorded` prevents duplicate boss outcome inside one session.
- `saturating_add` avoids naive arithmetic overflow problems.
- The contract is a workable foundation for a future authoritative flow.

## What This Contract Can Honestly Claim Today

Today the contract can honestly claim:

- it stores player event history
- it stores a signed session score path
- it stores best score and games played
- it enforces player ownership of their ledger PDA

Today it cannot honestly claim:

- that the recorded kills really happened
- that the recorded creates really happened
- that the boss outcome really happened
- that the leaderboard is cheat-resistant

## Fix Roadmap

### Phase A: Stabilize Contract Semantics

1. Add `SessionAlreadyActive`
2. Add stricter session lifecycle rules
3. Decide whether stale counters remain after finalize
4. Replace free-form strings with controlled event enums

### Phase B: Raise Trust Level

1. Stop treating the raw browser client as the authoritative event source
2. Move event submission behind delegated or trusted execution
3. Add event ordering / replay protection
4. Make boss outcome depend on match state, not just signer intent

### Phase C: Verification

1. Add Anchor tests for all critical abuse scenarios
2. Add deployment checklist for devnet
3. Add live verification checklist for:
   - `initialize_game`
   - `initialize_player`
   - `start_session`
   - `record_create`
   - `record_kill`
   - `record_boss_outcome`
   - `finalize_session`

## Suggested Fix Order

If we want the fastest path to something materially safer, the order should be:

1. Fix `start_session` lifecycle
2. Replace free-form event strings with enums
3. Add Anchor tests for abuse
4. Lock boss outcome behind stronger rules
5. Rework event authority around trusted execution / MagicBlock delegation

## Done Criteria For This Bible

This document is only considered resolved when:

- every `SC-xxx` item is either `Fixed`, `Accepted Risk`, or `Removed`
- the contract has abuse-path tests
- docs are aligned with the current implementation
- the live devnet flow is verified with fresh signatures

## Status Board

- `SC-001` Open
- `SC-002` Partially Fixed
- `SC-003` Fixed
- `SC-004` Partially Fixed
- `SC-005` Fixed
- `SC-006` Fixed
- `SC-007` Fixed
- `SC-008` Open
- `SC-009` Open
- `SC-010` Partially Fixed
- `SC-011` Open
- `SC-012` Accepted Risk
- `SC-013` Fixed
