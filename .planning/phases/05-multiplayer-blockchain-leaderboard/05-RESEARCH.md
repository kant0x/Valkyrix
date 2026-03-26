# Phase 5: Multiplayer & Blockchain Leaderboard - Research

**Researched:** 2026-03-26
**Domain:** Solana devnet on-chain transactions (MagicBlock ephemeral rollup), Anchor program development, on-chain leaderboard (SOAR), real-time multiplayer session architecture
**Confidence:** MEDIUM — MagicBlock SDK is fast-moving; core Solana/Anchor patterns are HIGH confidence

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Each kill = one separate on-chain transaction (not batched, not aggregated per wave)
- Network: Solana **devnet** in Phase 5 (mainnet is a separate future step)
- TX payload: `wallet + unit_type + timestamp`
- Gas is paid by **the player from their own wallet** (Phantom/Backpack, already connected via WalletService)
- MagicBlock ephemeral rollup keeps speed even at high kill rate
- Kill TX must be sent **fire-and-forget** — the game does not wait for confirmation

### Claude's Discretion

- Anchor/MagicBlock program structure (program ID, accounts layout)
- Retry logic on failed TX
- Optimistic vs confirmed UI (show kill immediately or wait for confirmation)

### Deferred Ideas (OUT OF SCOPE)

- Mainnet deploy — requires separate audit and gas balancing
- Multiplayer session model (how many players, P2P vs server) — not discussed, can be addressed in 05-01
- Leaderboard UI placement, on-chain data fields, failure/offline behavior — to be clarified separately before planning those sub-plans
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NET-04 | Multiple players play in one session in real time | Colyseus 0.17 + WS, authoritative server model; MagicBlock ER for state speed |
| CHAIN-01 | Every killed unit is recorded as an on-chain transaction via MagicBlock | `BlockchainService.recordKill()` hooked into `CombatSystem.registerKill()`; ConnectionMagicRouter fire-and-forget pattern |
| CHAIN-02 | Leaderboard stored on blockchain | Anchor program with PDA per player holding kill count + score; SOAR SDK as higher-level alternative |
| CHAIN-03 | Leaderboard read from blockchain and displayed in game | `fetchLeaderBoardAccount()` / `fetchAllLeaderboardAccounts()` via `@magicblock-labs/soar-sdk` 0.1.23; or direct `getProgramAccounts` |
</phase_requirements>

---

## Summary

Phase 5 splits into two mostly independent tracks: **(A) on-chain kill transactions** and **(B) multiplayer real-time session**. Track A is the most constrained by locked decisions — every kill fires a separate Solana devnet transaction routed through MagicBlock's ephemeral rollup (fire-and-forget, player pays gas). Track B is deferred by design: the exact multiplayer model (player count, P2P vs server) is explicitly left for plan 05-01, so research here documents the options and recommends a path for the planner to resolve.

For Track A, the project already has `@magicblock-labs/ephemeral-rollups-sdk` 0.8.8 in `package.json` (npm latest is now 0.10.1), `@solana/web3.js` 1.98.4, and a working `SessionLayer.ts` that connects to `devnet.magicblock.app`. The missing piece is a deployed Anchor program that accepts a `record_kill` instruction with `(wallet, unit_type, timestamp)` — the TypeScript client-side pattern using `ConnectionMagicRouter` is well-documented. The player's wallet signs via the already-working `WalletService`, so no new wallet plumbing is needed.

For Track B leaderboard (CHAIN-02/03), `@magicblock-labs/soar-sdk` 0.1.23 is a purpose-built on-chain leaderboard SDK deployed to devnet. It is the recommended path: `SoarProgram`, `GameClient`, and `InstructionBuilder` handle score submission and ranked reads without custom on-chain code. Alternatively, a minimal custom Anchor PDA program (`PlayerScore` account keyed by wallet) works and is simpler to deploy but loses built-in ranking functionality. Both options are researched below.

**Primary recommendation:** Implement kill TX using `ConnectionMagicRouter` wrapping existing `SessionLayer`; use `@magicblock-labs/soar-sdk` for leaderboard; keep kill-TX hook in `BlockchainService.recordKill()` called from `CombatSystem`'s existing `registerKill()` path — fire-and-forget with async error logging only.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@magicblock-labs/ephemeral-rollups-sdk` | 0.10.1 (project has 0.8.8) | `ConnectionMagicRouter` — routes TX to ER or base layer automatically | Already in package.json; official MagicBlock devnet client |
| `@solana/web3.js` | 1.98.4 (already installed) | Transaction building, blockhash, signing | Used by SessionLayer; required by Anchor provider |
| `@coral-xyz/anchor` | 0.32.1 | TypeScript Anchor program client — IDL-based method calls | Standard Anchor TS client; works with web3.js v1 |
| `@magicblock-labs/soar-sdk` | 0.1.23 | On-chain leaderboard: create game, submit scores, fetch rankings | MagicBlock's purpose-built leaderboard SDK on devnet |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `colyseus` (server) + `colyseus.js` (client) | 0.17.8 | Real-time multiplayer rooms, authoritative server, state sync | When implementing NET-04 — deferred to 05-01 sub-plan |
| `@solana/spl-token` | latest | SPL token ops if leaderboard rewards tokens | Only if reward token added (deferred/out of scope) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@magicblock-labs/soar-sdk` | Custom Anchor PDA program | Custom gives full control, but loses built-in ranking/sorting and requires deploying + maintaining Rust program |
| `ConnectionMagicRouter` | Direct ER validator URL (`https://devnet.magicblock.app/`) | Direct URL requires manual routing decisions; Magic Router is automatic |
| Colyseus server | MagicBlock BOLT ECS | BOLT is deeply integrated with ER but requires Rust program structure; Colyseus is simpler for browser-first TypeScript game |
| Colyseus server | Peer-to-peer (WebRTC / p2play-js) | P2P easier to deploy but vulnerable to cheating — not appropriate for on-chain score tracking |

**Installation:**
```bash
# Update ephemeral-rollups-sdk to latest
npm install @magicblock-labs/ephemeral-rollups-sdk@0.10.1

# New additions
npm install @coral-xyz/anchor@0.32.1
npm install @magicblock-labs/soar-sdk@0.1.23

# Multiplayer server (separate Node.js project or monorepo package)
npm create colyseus-app@latest ./server
```

**Version verification (confirmed 2026-03-26):**
- `@magicblock-labs/ephemeral-rollups-sdk`: 0.10.1 (project pin: 0.8.8 — update needed)
- `@coral-xyz/anchor`: 0.32.1
- `@magicblock-labs/soar-sdk`: 0.1.23
- `colyseus`: 0.17.8
- `@solana/web3.js`: 1.98.4 (already installed)

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── blockchain/
│   ├── BlockchainService.ts       # recordKill() fire-and-forget, fetchLeaderboard()
│   ├── BlockchainService.test.ts  # unit tests with mocked Connection
│   ├── KillProgram.idl.json       # Anchor IDL for kill-recorder program (if custom)
│   └── blockchain.types.ts        # KillPayload, LeaderboardEntry types
├── session/
│   ├── SessionLayer.ts            # existing — replace sendKill() stub
│   └── SessionLayer.test.ts       # existing tests, extend for real sendKill
├── screens/
│   └── LeaderboardScreen.ts       # new screen: reads chain, displays top-N
├── wallet/
│   └── WalletService.ts           # existing — publicKey used in TX signing

server/                            # separate Colyseus server (NET-04 deferred)
├── rooms/
│   └── GameRoom.ts                # authoritative game state, broadcast kills
└── index.ts
```

### Pattern 1: Fire-and-Forget Kill Transaction

**What:** On each `registerKill()` call in `CombatSystem`, call `BlockchainService.recordKill()` asynchronously. Never await; catch and log errors silently.

**When to use:** Every enemy unit death in `CombatSystem.tickFighting()` where `opponent.faction === 'enemy'`

**Example:**
```typescript
// Source: MagicBlock ephemeral-rollups-sdk docs + web3.js patterns
// BlockchainService.ts

import { Connection, Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';

const MAGIC_ROUTER_DEVNET = 'https://devnet-router.magicblock.app/';

export class BlockchainService {
  private connection: ConnectionMagicRouter;

  constructor() {
    this.connection = new ConnectionMagicRouter(MAGIC_ROUTER_DEVNET, {
      wsEndpoint: 'wss://devnet-router.magicblock.app/'
    });
  }

  /**
   * Fire-and-forget: do NOT await this.
   * CombatSystem calls this; game loop does not block on it.
   */
  async recordKill(unitType: string, walletPubkey: string, programId: PublicKey): Promise<void> {
    try {
      // Build instruction with (wallet, unit_type, timestamp) payload
      // Provider wraps the connected Phantom/Backpack wallet for signing
      const tx = await buildKillInstruction(unitType, walletPubkey, programId);
      // sendRawTransaction — returns signature immediately, no await on confirmation
      void this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    } catch (e) {
      console.warn('[BlockchainService] kill TX failed (ignored):', e);
    }
  }
}
```

**Integration point in CombatSystem.ts** (existing `registerKill` call at line 137):
```typescript
// After: registerKill(defKey, state);
// Add:
blockchainService?.recordKill(defKey, walletPublicKey).catch(() => {});
```

### Pattern 2: Anchor Provider from Browser Wallet

**What:** Wrap the existing `SolanaProvider` from `WalletService` into an `AnchorProvider` so `@coral-xyz/anchor` can sign transactions.

**When to use:** When calling SOAR SDK methods or any Anchor program instruction.

**Example:**
```typescript
// Source: https://www.anchor-lang.com/docs/clients/typescript
import { AnchorProvider, Program, setProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { getProvider as getWalletProvider } from '../wallet/WalletService';

export function makeAnchorProvider(connection: Connection): AnchorProvider {
  const walletProvider = getWalletProvider('phantom') ?? getWalletProvider('backpack');
  if (!walletProvider) throw new Error('Wallet not connected');

  // Wrap raw SolanaProvider into Anchor-compatible Wallet interface
  const anchorWallet = {
    publicKey: new PublicKey(walletProvider.publicKey!.toString()),
    signTransaction: (tx: Transaction) => walletProvider.signTransaction!(tx),
    signAllTransactions: (txs: Transaction[]) => walletProvider.signAllTransactions!(txs),
  };

  return new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
}
```

### Pattern 3: SOAR Leaderboard Submit and Read

**What:** Use `@magicblock-labs/soar-sdk` to submit kill counts as scores and fetch top-N entries.

**When to use:** CHAIN-02 (store) and CHAIN-03 (read and display).

**Example:**
```typescript
// Source: https://magicblock-labs.github.io/SOAR/ — SoarProgram docs
import { SoarProgram, GameClient } from '@magicblock-labs/soar-sdk';

// Initialize once at game start
const soar = SoarProgram.getFromProvider(anchorProvider);
const gameClient = await GameClient.fromGameAddress(soar, GAME_PDA_ADDRESS);

// Submit score (call after session end or periodically)
async function submitScore(playerPublicKey: PublicKey, killCount: number): Promise<void> {
  const tx = await soar.instructionBuilder
    .andSubmitScoreToLeaderboard(playerPublicKey, leaderboardPda, killCount)
    .build();
  await anchorProvider.sendAndConfirm(tx);
}

// Read top entries (call when displaying leaderboard screen)
async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  await gameClient.refresh();
  const accounts = await soar.fetchAllLeaderboardAccounts();
  // Transform to display format
  return accounts.map(a => ({ player: a.account.player, score: a.account.score }));
}
```

### Pattern 4: MagicBlock ER Account Delegation (for CHAIN-01 speed)

**What:** Delegate the kill-recorder PDA to the ER validator so transactions run at 10-50ms instead of Solana's 400ms.

**When to use:** High-frequency kills (multiple per second during boss waves). Required to avoid TX backlog.

**Key steps:**
1. Anchor program calls `delegate_account()` CPI at session start
2. All `record_kill` instructions route to ER via `ConnectionMagicRouter`
3. ER validator commits state back to base layer periodically (30s interval) or on session end

**Note:** Magic Router automates routing — if accounts are delegated, it sends to ER; if not, it sends to base layer. No manual routing logic needed in the client.

### Anti-Patterns to Avoid

- **Awaiting kill TX in the game loop:** The game loop runs at 60fps. Any `await` on a Solana TX (even ER at 50ms) will cause jank. Always fire-and-forget.
- **Using `sendAndConfirmTransaction` for kill events:** This blocks until finalized. Use `sendRawTransaction` with `skipPreflight: true` for kills.
- **Building AnchorProvider at every TX:** AnchorProvider is expensive to construct. Build once at session start, reuse throughout.
- **Storing the full kill log on-chain:** Each TX is `~5000 lamports` on devnet. At 60 kills/wave × 5 waves = 300 transactions per session. Budget: ~0.0015 SOL per session. Acceptable for devnet; flag for mainnet.
- **Single global leaderboard PDA:** SOAR uses per-game leaderboard PDAs derived from the game address. Initialize the game account once (not every session).
- **Calling SOAR submitScore on every kill:** SOAR leaderboard is for session-end score aggregation, not per-kill recording. Per-kill recording is the kill-recorder program; SOAR gets the total at the end.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| On-chain leaderboard with rankings | Custom PDA + sorting logic | `@magicblock-labs/soar-sdk` | SOAR handles ranking direction (asc/desc), pagination, score validation; deployed to devnet already |
| Transaction routing to ER vs base layer | Manual `if (delegated) sendToER else sendToSolana` | `ConnectionMagicRouter` | Router inspects account ownership and routes automatically; removing routing bugs |
| Wallet signing in browser | Custom signTransaction wrapper | Anchor's `AnchorProvider` + existing `WalletService` | AnchorProvider bridges the existing `SolanaProvider` to Anchor method calls |
| Real-time state broadcast to multiple clients | Custom WebSocket server | `colyseus` 0.17 | Colyseus handles rooms, matchmaking, delta-only state sync, and reconnection |
| TX retry with exponential backoff | Custom retry loop | Simple: wrap in try/catch, log and skip | Kill TX failures are non-critical; retry adds complexity and can cause duplicate kills on-chain |

**Key insight:** The on-chain infrastructure (SOAR program, delegation program) is pre-deployed to Solana devnet. There is no Rust to write for the leaderboard — only a TypeScript client. The only Rust needed is a minimal kill-recorder program if SOAR is not used for per-kill events (which it is not — SOAR is for aggregate scores).

---

## Common Pitfalls

### Pitfall 1: web3.js v1 vs v2 Incompatibility with Anchor

**What goes wrong:** `@coral-xyz/anchor` 0.32.x is only compatible with `@solana/web3.js` v1 (the `^1.x` line). If you import from `@solana/kit` (web3.js v2), Anchor will break.
**Why it happens:** Anchor has not yet migrated to web3.js v2 as of 2026-03.
**How to avoid:** Project already uses `@solana/web3.js ^1.98.4` — do NOT upgrade to `@solana/kit` or `@solana/web3.js v2` in this phase.
**Warning signs:** TypeScript errors about `Transaction` type mismatch between `@coral-xyz/anchor` and web3.js.

### Pitfall 2: MagicBlock Devnet Cold Start Latency

**What goes wrong:** First call to `devnet.magicblock.app` or `devnet-router.magicblock.app` can take 3–10 seconds (cold start). If `recordKill()` is first called mid-fight, there is a visible lag spike.
**Why it happens:** MagicBlock devnet spins up ER validators on demand.
**How to avoid:** Call `SessionLayer.connect()` (which calls `getSlot()`) when the player presses "Play", before the game loop starts. This is already implemented in `SessionLayer.ts`.
**Warning signs:** First few kills show latency in logs; subsequent kills are fast.

### Pitfall 3: Fire-and-Forget Loses TX Silently

**What goes wrong:** Kill transactions fail (insufficient SOL, RPC error, network timeout) and there is no indication — kills are not recorded but game continues normally.
**Why it happens:** This is intentional (fire-and-forget), but if the player wallet has no SOL, ALL kills silently fail.
**How to avoid:** Check wallet balance at session start. Show a non-blocking warning in HUD if balance < 0.001 SOL (covers ~600 kills). Do not block gameplay.
**Warning signs:** Leaderboard shows 0 kills despite successful gameplay.

### Pitfall 4: AnchorProvider `publicKey` Mismatch

**What goes wrong:** `WalletService` stores `publicKey` as a `string`. Anchor's `AnchorProvider` expects a `PublicKey` instance. Type errors or silent failures occur when wrapping.
**Why it happens:** `WalletService` is designed to be wallet-agnostic and stores plain strings.
**How to avoid:** Wrap with `new PublicKey(walletState.publicKey)` when constructing the Anchor wallet adapter. Type-guard that `walletState.publicKey !== null` before calling.

### Pitfall 5: SOAR Game Account Not Initialized

**What goes wrong:** `submitScoreToLeaderBoard()` throws because the on-chain game account does not exist. Needs a one-time `initializeNewGame()` call with the correct authority keypair.
**Why it happens:** SOAR requires registering a game before creating leaderboards.
**How to avoid:** Run `initializeNewGame()` once as a deployment step. Store the resulting `gamePda` address in a config constant. This is NOT called at runtime — it is a one-time setup script.
**Warning signs:** `AccountNotFound` error on first `addLeaderboard()` call.

### Pitfall 6: Duplicate Kill TX on Retry

**What goes wrong:** If retry logic is added later, a kill that was already recorded fires again due to Solana RPC timeout (the TX may have succeeded but the response was lost).
**Why it happens:** Solana TX IDs are unique per blockhash, but if the same logic builds a new TX it gets a new signature.
**How to avoid:** Do NOT implement retry for kill TX in this phase. Fire-and-forget is correct — occasional missed kills are acceptable. This is documented in CONTEXT.md under Claude's Discretion.

---

## Code Examples

Verified patterns from official sources:

### ConnectionMagicRouter Setup
```typescript
// Source: https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/magic-router.md
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';

const connection = new ConnectionMagicRouter(
  'https://devnet-router.magicblock.app/',
  { wsEndpoint: 'wss://devnet-router.magicblock.app/' }
);
```

### Sending a Transaction to ER (fire-and-forget)
```typescript
// Source: MagicBlock quickstart docs, web3.js v1 pattern
const { blockhash } = await connection.getLatestBlockhash();
const tx = new Transaction({ feePayer: walletPublicKey, recentBlockhash: blockhash });
tx.add(killInstruction);

const signedTx = await walletProvider.signTransaction(tx);
// skipPreflight = true for speed; no await
void connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
```

### Anchor MethodsBuilder Call
```typescript
// Source: https://www.anchor-lang.com/docs/clients/typescript
const txSignature = await program.methods
  .recordKill(unitType, timestamp)
  .accounts({
    playerScore: playerScorePda,
    signer: walletPublicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();  // uses AnchorProvider wallet automatically
```

### SOAR Score Submission (session end)
```typescript
// Source: https://magicblock-labs.github.io/SOAR/
import { SoarProgram } from '@magicblock-labs/soar-sdk';

const soar = SoarProgram.getFromProvider(provider);
const tx = await soar.instructionBuilder
  .andSubmitScoreToLeaderboard(playerPubkey, leaderboardPda, totalKillCount)
  .build();
await provider.sendAndConfirm(tx);
```

### SOAR Fetch Leaderboard
```typescript
// Source: https://magicblock-labs.github.io/SOAR/
const entries = await soar.fetchAllLeaderboardAccounts();
const sorted = entries
  .sort((a, b) => b.account.score - a.account.score)
  .slice(0, 10);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct ER endpoint URL | `ConnectionMagicRouter` (auto-routing) | Mid-2025 | No manual routing logic; one connection object for everything |
| Manual account delegation in client | `@delegate` macro in Anchor program | 2024 | Delegation is now a program instruction, not client-side logic |
| `@project-serum/anchor` | `@coral-xyz/anchor` | 2023 | Same API, different org name; `@project-serum` is abandoned |
| P2P multiplayer for on-chain games | Authoritative server (Colyseus) + ER for state | 2024-2025 | Prevents cheating; game state managed server-side, chain state is settlement |
| `ephemeral-rollups-sdk` 0.8.x | 0.10.1 | March 2026 | Introduces `@magicblock-labs/ephemeral-rollups-kit` for web3.js v2; SDK 0.10.x keeps web3.js v1 support |

**Deprecated/outdated:**
- `@project-serum/anchor`: Replaced by `@coral-xyz/anchor` — do not use
- `sendAndConfirmTransaction` for game kills: Too slow for real-time; use `sendRawTransaction` with fire-and-forget
- SOAR legacy docs at `solana.unity-sdk.gg/docs/soar`: Use `magicblock-labs.github.io/SOAR` instead

---

## Open Questions

1. **Multiplayer session model (NET-04)**
   - What we know: Deferred to plan 05-01 by CONTEXT.md; Colyseus 0.17 is the recommended framework
   - What's unclear: Number of players per room, server hosting (local for dev? Fly.io? Vercel serverless won't work — needs persistent WebSocket), whether game loop runs server-side or client-side
   - Recommendation: Plan 05-01 should resolve this with a minimal 2-player same-device prototype first, then real Colyseus server

2. **Kill-recorder Anchor program: SOAR vs custom**
   - What we know: SOAR handles leaderboard scores (session aggregate); per-kill TX needs its own instruction
   - What's unclear: Should per-kill recording use SOAR's score system (one score update per kill) or a separate lightweight Anchor program? SOAR charges compute per instruction.
   - Recommendation: Use a minimal custom Anchor program (`record_kill`) for per-kill TX (faster, cheaper); use SOAR separately for leaderboard at session end. Requires writing and deploying a small Rust program.

3. **Program deploy authority and devnet airdrop**
   - What we know: Deploying Anchor programs requires SOL for rent + deployment (devnet airdrop available)
   - What's unclear: Who manages the program authority keypair? Is there a deploy script?
   - Recommendation: Add an `anchor/` directory with the program and a `scripts/deploy-devnet.sh`. Use `solana airdrop` in the script for devnet setup.

4. **Leaderboard screen placement**
   - What we know: CONTEXT.md defers this to a separate sub-discussion
   - What's unclear: Main menu? Post-game overlay? Separate screen?
   - Recommendation: Plan 05-03 (or later) — skip in 05-01 and 05-02 plans until UI placement is decided

5. **SOAR game account initialization**
   - What we know: Requires a one-time `initializeNewGame()` with an authority keypair
   - What's unclear: Has this been done for Valkyrix on devnet? Is there a stored game PDA?
   - Recommendation: Wave 0 of the SOAR plan should include a one-time init script, and store `GAME_PDA` and `LEADERBOARD_PDA` as constants in `blockchain.types.ts`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/blockchain/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NET-04 | Multiple players in one real-time session | manual-only (requires running Colyseus server) | `npx vitest run src/session/` | ❌ Wave 0 |
| CHAIN-01 | Kill event triggers `recordKill()` call | unit (mock Connection) | `npx vitest run src/blockchain/BlockchainService.test.ts` | ❌ Wave 0 |
| CHAIN-01 | `CombatSystem` calls `BlockchainService.recordKill` on kill | unit (spy on BlockchainService) | `npx vitest run src/game/CombatSystem.test.ts` | ✅ (extend) |
| CHAIN-02 | Score submitted to leaderboard after session | unit (mock SOAR SDK) | `npx vitest run src/blockchain/BlockchainService.test.ts` | ❌ Wave 0 |
| CHAIN-03 | Leaderboard entries fetched and displayed | unit (mock fetch, test LeaderboardScreen render) | `npx vitest run src/screens/LeaderboardScreen.test.ts` | ❌ Wave 0 |

**Manual-only justification for NET-04:** Real-time multiplayer requires live WebSocket server + two browser sessions. Cannot be meaningfully tested in jsdom. Verify by running two browser tabs against local Colyseus server.

### Sampling Rate
- **Per task commit:** `npx vitest run src/blockchain/ src/game/CombatSystem.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/blockchain/BlockchainService.ts` — core service, covers CHAIN-01 + CHAIN-02
- [ ] `src/blockchain/BlockchainService.test.ts` — mocked Connection + SOAR SDK, covers CHAIN-01 + CHAIN-02
- [ ] `src/blockchain/blockchain.types.ts` — `KillPayload`, `LeaderboardEntry` type definitions
- [ ] `src/screens/LeaderboardScreen.ts` — new screen, covers CHAIN-03
- [ ] `src/screens/LeaderboardScreen.test.ts` — jsdom render test, covers CHAIN-03
- [ ] `anchor/programs/kill-recorder/` — Rust Anchor program (outside Vitest scope; tested with `anchor test`)
- [ ] `scripts/deploy-devnet.sh` — one-time SOAR game init + program deploy

---

## Sources

### Primary (HIGH confidence)
- `@magicblock-labs/ephemeral-rollups-sdk` npm — version 0.10.1 confirmed 2026-03-26
- `@coral-xyz/anchor` npm — version 0.32.1 confirmed 2026-03-26
- `@magicblock-labs/soar-sdk` npm — version 0.1.23 confirmed 2026-03-26
- `colyseus` npm — version 0.17.8 confirmed 2026-03-26
- https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/magic-router.md — `ConnectionMagicRouter` endpoints
- https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart.md — delegation + ER TX pattern
- https://www.anchor-lang.com/docs/clients/typescript — AnchorProvider + MethodsBuilder

### Secondary (MEDIUM confidence)
- https://magicblock-labs.github.io/SOAR/ — SOAR TypeScript SDK functions (fetched, partially verified)
- https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/client.md — fire-and-forget pattern description
- https://docs.colyseus.io/ — Colyseus 0.17 room/state architecture
- MagicBlock quickstart docs — ER transaction TX build + send pattern

### Tertiary (LOW confidence)
- MagicBlock GitHub examples (`magicblock-engine-examples`) — anchor-counter pattern (GitHub fetch succeeded but is an indirect source)
- Anchor program structure for `record_kill` instruction — derived from general Anchor PDA patterns, no Valkyrix-specific precedent

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all npm versions verified 2026-03-26
- Architecture (kill TX flow): HIGH — ConnectionMagicRouter docs fetched, pattern confirmed
- Architecture (SOAR leaderboard): MEDIUM — SDK docs fetched but code examples are partial; need to verify `andSubmitScoreToLeaderboard` exact signature against SDK 0.1.23
- Architecture (multiplayer NET-04): LOW — deferred by CONTEXT.md; Colyseus recommendation is MEDIUM but full integration pattern is unresolved
- Pitfalls: HIGH (web3.js v1 lock, cold start, fire-and-forget) / MEDIUM (SOAR init one-time requirement)

**Research date:** 2026-03-26
**Valid until:** 2026-04-09 (14 days — MagicBlock SDK is fast-moving; re-verify if planning is delayed more than 2 weeks)
