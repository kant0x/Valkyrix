---
phase: 2
slug: menu-network-architecture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 (not yet installed in project) |
| **Config file** | `vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/screens/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | UI-02 | unit | `npx vitest run src/screens/ScreenManager.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | UI-01 | unit | `npx vitest run src/screens/WalletSplashScreen.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | UI-01 | unit | `npx vitest run src/screens/MainMenuScreen.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | NET-03 | unit | `npx vitest run src/session/SessionLayer.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | UI-01 | unit | `npx tsc --noEmit 2>&1 && echo 'TYPE CHECK PASSED'` | ✅ | ⬜ pending |
| 02-05-02 | 05 | 2 | UI-01 | unit | `npx tsc --noEmit 2>&1 && echo 'TYPE CHECK PASSED'` | ✅ | ⬜ pending |
| 02-06-01 | 06 | 3 | NET-02 | integration (manual) | Manual — see manual-only section | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest not installed; run `npm install -D vitest jsdom @vitest/ui`
- [ ] `src/screens/ScreenManager.test.ts` — covers UI-02 (screen transition logic)
- [ ] `src/screens/WalletSplashScreen.test.ts` — covers UI-01 (wallet buttons render)
- [ ] `src/screens/MainMenuScreen.test.ts` — covers UI-01 (menu buttons render)
- [ ] `src/session/SessionLayer.test.ts` — covers NET-03 (interface contract)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SessionLayer.connect() resolves without error on devnet | NET-02 | Network-dependent; fragile in CI | Run smoke test script against `devnet.magicblock.app`; verify `getSlot()` returns a number without throwing |
| Network architecture documented in SessionLayer.ts JSDoc | NET-01 | Documentation is the artifact | Open `src/session/SessionLayer.ts` and review JSDoc for documented interface rationale |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
