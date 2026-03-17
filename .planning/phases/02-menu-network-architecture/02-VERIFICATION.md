---
phase: 02-menu-network-architecture
verified: 2026-03-17T17:22:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Visual wallet splash screen appearance and wallet connect flow"
    expected: "VALKYRIX heading, Phantom and Backpack buttons (or install links), gas notice visible; clicking a wallet button triggers extension popup then transitions to main menu without page reload"
    why_human: "Requires browser extension presence or mock; DOM appearance and transition feel cannot be verified in jsdom"
  - test: "Play button MagicBlock connect loading state then game canvas"
    expected: "Button shows 'Connecting...' text, status shows 'Connecting to MagicBlock devnet', then game canvas appears with isometric map rendering"
    why_human: "Requires live devnet connectivity and visual canvas verification; network latency and cold-start behavior need human observation"
  - test: "ESC overlay toggling while game continues animating"
    expected: "ESC keypress shows overlay without freezing canvas; canvas continues rendering underneath; second ESC closes overlay"
    why_human: "Real-time canvas animation behavior and overlay layering cannot be verified programmatically"
  - test: "Exit to Menu confirmation flow"
    expected: "Exit to Menu button shows confirmation warning; confirm exits to main menu without page reload; cancel restores overlay"
    why_human: "Multi-step UI interaction flow with confirmation dialog requires browser interaction"
---

# Phase 02: Menu & Network Architecture Verification Report

**Phase Goal:** Игрок видит главное меню при старте и может перейти к игре. Определена и задокументирована схема сети: протокол, транспорт, сервер/P2P. Меню подключается к игровой сессии через задокументированный слой. Экраны маршрутизируются без перезагрузки страницы.
**Verified:** 2026-03-17T17:22:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player sees wallet splash screen on app start | VERIFIED | `src/main.ts:270` calls `screenManager.navigateTo('wallet')` as the first navigation; `WalletSplashScreen` renders VALKYRIX heading + Phantom/Backpack buttons |
| 2 | Player can transition from wallet to main menu without page reload | VERIFIED | `WalletSplashScreen` calls `this.manager.navigateTo('menu')` on successful connect (line 69); ScreenManager uses DOM mount/unmount, not location.reload |
| 3 | Main menu shows Play and Leaderboard buttons | VERIFIED | `MainMenuScreen.ts:26-27` renders `<button id="btn-play">Play</button>` and `<button id="btn-leaderboard">Leaderboard</button>`; test `MainMenuScreen.test.ts` passes (4/4) |
| 4 | Network architecture is documented (protocol, transport, server/P2P mode) | VERIFIED | `SessionLayer.ts:3-29` JSDoc contains complete network diagram with Protocol: HTTPS/WSS, Transport: JSON-RPC, Mode: Client-to-server, Auth: ed25519 |
| 5 | Menu (Play button) connects to game session through documented layer | VERIFIED | `MainMenuScreen.ts:56` calls `await this.session.connect()` before `this.manager.navigateTo('game')`; SessionLayer is the documented connection layer |
| 6 | Screens route without page reload | VERIFIED | `ScreenManager.navigateTo()` calls `unmount()` then `mount()` on DOM elements; ScreenManager test verifies `window.location.reload` is never called (test 3 passes) |
| 7 | All automated tests pass (29/29) | VERIFIED | `npx vitest run` output: 29 passed, 0 failed across 6 test files |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | vitest configuration with jsdom environment | VERIFIED | Exists, contains `environment: 'jsdom'`, `include: ['src/**/*.test.ts']` |
| `src/screens/ScreenManager.ts` | State machine screen router | VERIFIED | Exports `ScreenManager`, `Screen`, `ScreenModule`; `navigateTo()` implemented with mount/unmount lifecycle |
| `src/wallet/wallet.types.ts` | WalletProvider, WalletState, SolanaProvider type definitions | VERIFIED | Exports `WalletType`, `SolanaProvider`, `WalletState` with correct shapes |
| `src/wallet/WalletService.ts` | Phantom + Backpack detection and connect/disconnect logic | VERIFIED | Exports `getProvider`, `connectWallet`, `disconnectWallet`, `getCurrentState`; JSDoc documents user-gesture requirement |
| `src/screens/WalletSplashScreen.ts` | Full-screen wallet connection UI | VERIFIED | Exports `WalletSplashScreen`; renders Phantom and Backpack buttons; connect() only in click handlers |
| `src/screens/MainMenuScreen.ts` | Main menu UI with Play and Leaderboard buttons | VERIFIED | Exports `MainMenuScreen`; Play calls `session.connect()` then `navigateTo('game')` |
| `src/session/SessionLayer.ts` | MagicBlock devnet connection stub and network architecture documentation | VERIFIED | Exports `SessionLayer`, `MAGICBLOCK_DEVNET_RPC`, `SOLANA_DEVNET_RPC`; JSDoc contains NET-01 architecture diagram |
| `src/screens/EscMenuOverlay.ts` | ESC key overlay with music settings and exit confirmation | VERIFIED | Exports `EscMenuOverlay`; keydown listener for Escape; `navigateTo('menu')` on confirm; does not reference requestAnimationFrame or canvas |
| `src/screens/HudOverlay.ts` | Persistent in-game HUD at bottom of screen | VERIFIED | Exports `HudOverlay`, `HudState`; `mount()`, `unmount()`, `update(HudState)` all implemented |
| `src/main.ts` | Rewired entry point using ScreenManager | VERIFIED | Imports all screen modules; creates `GameScreen` class wrapping existing game loop; `animating` guard prevents duplicate RAF; starts on `wallet` screen |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.ts` | `src/screens/ScreenManager.ts` | `new ScreenManager(appContainer, {...})` | WIRED | Line 264: `screenManager = new ScreenManager(appContainer, { wallet, menu, game })` |
| `src/main.ts` | `src/screens/WalletSplashScreen.ts` | imported and passed as 'wallet' module | WIRED | Lines 13, 260: `import { WalletSplashScreen }`, `new WalletSplashScreen(...)` |
| `src/main.ts` | `src/screens/EscMenuOverlay.ts` | mounted when game screen is mounted | WIRED | Lines 15, 234-235: `import { EscMenuOverlay }`, mounted inside `GameScreen.mount()` |
| `src/screens/WalletSplashScreen.ts` | `src/wallet/WalletService.ts` | `connectWallet()` called on button click | WIRED | Line 68: `await connectWallet(type)` inside async click handler |
| `src/screens/WalletSplashScreen.ts` | `src/screens/ScreenManager.ts` | `manager.navigateTo('menu')` after connect | WIRED | Line 69: `this.manager.navigateTo('menu')` in try block after successful connect |
| `src/screens/MainMenuScreen.ts` | `src/session/SessionLayer.ts` | `SessionLayer.connect()` called when Play is pressed | WIRED | Line 56: `await this.session.connect()` in Play button click handler |
| `src/screens/MainMenuScreen.ts` | navigateTo('game') | after session.connect() resolves | WIRED | Line 57: `this.manager.navigateTo('game')` immediately after connect |
| `src/session/SessionLayer.ts` | `https://devnet.magicblock.app/` | `Connection` RPC endpoint | WIRED | Line 48: `new Connection(MAGICBLOCK_DEVNET_RPC, 'confirmed')` using dynamic import |
| `src/screens/EscMenuOverlay.ts` | `document` keydown | Escape key listener | WIRED | Line 48: `document.addEventListener('keydown', this.onKey)` in `mount()`; removed in `unmount()` |
| `src/screens/EscMenuOverlay.ts` | `src/screens/ScreenManager.ts` | `manager.navigateTo('menu')` on exit confirm | WIRED | Line 94: `this.manager.navigateTo('menu')` in confirm-exit click handler |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 02-01, 02-03, 02-04, 02-05, 02-06 | Player sees main menu at start and can begin a game | SATISFIED | WalletSplashScreen → MainMenuScreen (Play/Leaderboard) → game canvas; all tests passing; human verified per 02-06 summary |
| UI-02 | 02-01, 02-02, 02-06 | Screens route without page reload (lobby, game, menu) | SATISFIED | ScreenManager uses DOM mount/unmount; test explicitly verifies `window.location.reload` is never called |
| NET-01 | 02-04, 02-06 | Network schema documented (protocol, transport, server/P2P) | SATISFIED | `SessionLayer.ts` JSDoc lines 3-29: HTTPS/WSS protocol, JSON-RPC transport, client-to-server mode, ed25519 auth |
| NET-02 | 02-01, 02-04, 02-06 | Menu connects to game session through documented layer | SATISFIED | `MainMenuScreen` calls `SessionLayer.connect()` on Play; SessionLayer creates `Connection` to `devnet.magicblock.app` |
| NET-03 | 02-01, 02-04, 02-06 | Lobby/rooms — players can create and join sessions | PARTIAL (by design) | RESEARCH.md explicitly defers true multiplayer lobby to Phase 5; Phase 2 delivers `SessionLayer` with documented interface contract (`sendKill` stub) and SessionLayer tests (3/3 pass). REQUIREMENTS.md marks this as Complete for Phase 2 with the understanding that the contract is established here. |

**Note on NET-03:** The requirement description in REQUIREMENTS.md ("players can create and join sessions") is scoped further by RESEARCH.md which explicitly states: "CONTEXT.md deferred true multiplayer lobby to Phase 5 — this phase documents the architecture and stubs the interface only." The REQUIREMENTS.md traceability table marks NET-03 Phase 2 as Complete. The SessionLayer interface contract and its tests are the Phase 2 deliverable for NET-03.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/screens/MainMenuScreen.ts` | 67 | `// TODO Phase 5: navigate to leaderboard screen` | Info | Expected — Leaderboard routes to game screen as placeholder; explicitly deferred per CONTEXT.md |
| `src/screens/HudOverlay.ts` | 3-4 | "Phase 2: structural placeholder with stub values" | Info | Expected — HUD update() API is fully implemented; stub values are intentional for Phase 3 data binding |

No blocker or warning anti-patterns found. All TODOs are documented design deferrals, not incomplete implementations.

---

## Human Verification Required

### 1. Wallet Splash Visual and Connect Flow

**Test:** Run `npm run dev`, open the app, observe the initial screen.
**Expected:** VALKYRIX heading, two wallet buttons ("Connect Phantom" / "Connect Backpack" if extensions installed, or "Install Phantom" / "Install Backpack" links otherwise), gas cost notice visible at bottom. Clicking a wallet button triggers the extension popup; after connecting, the app transitions to the main menu without a page reload (verify in browser Network tab — no full document request).
**Why human:** Browser extension presence required; visual appearance and page-reload absence need browser-level observation.

### 2. Play Button Loading State and Game Canvas

**Test:** From main menu, click Play.
**Expected:** Button text changes to "Connecting...", status text "Connecting to MagicBlock devnet…" appears. After 3-10 seconds (devnet cold start), the isometric game canvas loads and the HUD bar is visible at the bottom with Wave, Citadel HP, Resources labels.
**Why human:** Requires live devnet connectivity; loading state timing and canvas rendering need visual confirmation.

### 3. ESC Overlay Non-Pause Behavior

**Test:** From game canvas, press Escape.
**Expected:** Dark overlay appears with "Menu" title, music checkbox, "Exit to Menu" button. The isometric map canvas continues to render underneath (no freeze). Press Escape again — overlay closes. Game continues.
**Why human:** Real-time canvas animation verification requires visual observation; cannot programmatically assert animation continues.

### 4. Exit to Menu Confirmation and Navigation

**Test:** Press ESC, then click "Exit to Menu".
**Expected:** Confirmation message "Progress will be lost. Exit?" appears with Exit and Stay buttons. Click Exit — navigates back to main menu without page reload. Click Stay instead — confirmation hides, Exit to Menu button reappears.
**Why human:** Multi-step UI interaction sequence with conditional rendering flow requires manual browser interaction.

---

## Gaps Summary

No gaps found. All automated must-haves are verified. The phase goal is fully achieved at the code level:

- Player sees wallet splash on app start and can reach the game via wallet connect + Play button
- Network architecture is documented in code (SessionLayer JSDoc) with protocol, transport, and server mode
- Menu connects to game session through SessionLayer (the documented layer)
- All screen transitions use ScreenManager's DOM mount/unmount — no page reloads
- 29/29 automated tests pass
- Human verification was performed and approved during Plan 06 execution (per 02-06-SUMMARY.md: "all 8 checkpoint steps passing")

The 4 human verification items above are listed for completeness and re-validation purposes; the original human verification was already approved by the user during Phase 2 execution.

---

_Verified: 2026-03-17T17:22:00Z_
_Verifier: Claude (gsd-verifier)_
