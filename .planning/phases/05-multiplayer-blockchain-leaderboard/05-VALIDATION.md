---
phase: 5
slug: multiplayer-blockchain-leaderboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite/vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CHAIN-01 | unit | `npx vitest run src/game/BlockchainService.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CHAIN-01 | unit | `npx vitest run src/game/BlockchainService.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CHAIN-02 | unit | `npx vitest run src/game/LeaderboardService.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | CHAIN-02 | unit | `npx vitest run src/game/LeaderboardService.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | CHAIN-03 | unit | `npx vitest run src/screens/LeaderboardOverlay.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | NET-04 | manual | see manual table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/game/BlockchainService.test.ts` — stubs for CHAIN-01
- [ ] `src/game/LeaderboardService.test.ts` — stubs for CHAIN-02
- [ ] `src/screens/LeaderboardOverlay.test.ts` — stubs for CHAIN-03

*Existing vitest infrastructure covers testing framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multiple players in same real-time session | NET-04 | Requires live network, multiple browser tabs | Open 2 tabs, join same room, verify units sync |
| Kill TX confirmed on Solana devnet | CHAIN-01 | Real blockchain confirmation loop | Check Solana Explorer devnet for wallet TX after in-game kill |
| Leaderboard reads from chain on session end | CHAIN-02 | Requires devnet state | Complete a game session, check leaderboard screen shows on-chain data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
