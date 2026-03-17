# Phase 2: Menu & Network Architecture - Research

**Researched:** 2026-03-17
**Domain:** Vanilla TypeScript SPA screen routing, Solana wallet integration (Phantom + Backpack), MagicBlock ephemeral rollups
**Confidence:** MEDIUM (wallet APIs verified via official docs; MagicBlock integration patterns partially verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Маршрутизация экранов**
- State machine: `currentScreen = 'wallet' | 'menu' | 'game'`
- Переключение без перезагрузки страницы — DOM показывается/скрывается по состоянию
- Кнопка «назад» браузера не нужна — навигация только через кнопки в игре
- Каждый экран — отдельный модуль TS

**Экран подключения кошелька (wallet splash)**
- Полноэкранная заставка при старте — логотип игры + кнопки Phantom и Backpack
- Кошелёк обязателен: без подключения игра недоступна
- После успешного подключения → автоматически переход в главное меню

**Главное меню**
- Две кнопки: Играть и Лидерборд
- «Играть» → сразу в игру (без лобби, без выбора карты)
- «Лидерборд» → экран топа игроков (данные из блокчейна)
- Выбор карты — отложено на будущее

**Внутриигровое меню (ESC)**
- Оверлей поверх игры — игра не останавливается (real-time)
- Содержимое: настройки музыки + кнопка «Выйти в меню»
- «Выйти в меню» показывает предупреждение: прогресс текущей игры будет потерян
- HUD (постоянный) — снизу экрана во время игры

**Блокчейн — MagicBlock + Solana**
- Сеть: Solana devnet сейчас, mainnet — при переходе в Phase 5
- Кошельки: Phantom и Backpack (два отдельных провайдера)
- Каждый убитый юнит = on-chain транзакция через MagicBlock
- Игрок платит газ из своего кошелька за каждую транзакцию
- Подключение к MagicBlock происходит при нажатии «Играть» (не при открытии меню)

### Claude's Discretion
- Точный дизайн wallet splash экрана
- Анимации переходов между экранами
- Обработка ошибок при отказе кошелька подписать транзакцию
- Структура TS-модулей для каждого экрана

### Deferred Ideas (OUT OF SCOPE)
- Выбор карты в меню — будущая фаза
- Мультиплеер / лобби — Phase 5
- Переход на Solana mainnet — Phase 5
- Настройки графики (не только музыка) — можно добавить позже в ESC-меню
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Игрок видит главное меню при старте и может начать игру | State machine screen manager pattern; ScreenManager class wraps DOM show/hide |
| UI-02 | Экраны маршрутизируются без перезагрузки страницы (лобби, игра, меню) | Covered by state machine approach — no router library needed |
| NET-01 | Задокументирована схема сети (протокол, транспорт, сервер/P2P) | MagicBlock devnet endpoints; architecture diagram in Code Examples |
| NET-02 | Меню подключается к игровой сессии через задокументированный слой | SessionLayer interface defined; MagicBlock connection triggered on "Play" |
| NET-03 | Лобби/комнаты — игроки могут создавать и вступать в сессии | NOTE: CONTEXT.md deferred true multiplayer lobby to Phase 5 — this phase documents the architecture and stubs the interface only |
</phase_requirements>

---

## Summary

This phase builds three things: (1) a vanilla TypeScript screen router using a simple state machine, (2) wallet connection screens for Phantom and Backpack browser extensions, and (3) the documented architecture and thin connection layer for MagicBlock/Solana devnet. No framework, no third-party router — existing DOM manipulation patterns from Phase 1 (`main.ts`, `ensureRuntimeStyle()`) apply directly.

The wallet integration uses the browser extension injection pattern: `window.phantom?.solana` and `window.backpack` are the provider objects injected by the extensions when installed. The `@phantom/browser-sdk` package provides a more structured API that wraps both injected and embedded wallet scenarios, but for this project's two-wallet requirement the direct `window` injection approach is simpler and has zero runtime overhead. Both providers expose identical connection APIs.

MagicBlock integration for "kill = on-chain transaction" is the most technically uncertain part of this phase. MagicBlock's Ephemeral Rollup SDK (`@magicblock-labs/ephemeral-rollups-sdk`) is a helper over `@solana/web3.js` that routes transactions through the MagicBlock devnet router. The actual on-chain program for recording kills must already exist (or be deployed) before the frontend can call it — this phase documents the architecture and wires the connection layer, but kill-recording transactions belong to Phase 3 (units/combat) when kills actually happen.

**Primary recommendation:** Implement ScreenManager as a class with a typed state machine, use `window.phantom.solana` / `window.backpack` direct injection pattern (no SDK overhead), add `@solana/web3.js` + `@magicblock-labs/ephemeral-rollups-sdk` for the session layer stub.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.7.2 (already installed) | Screen modules, type-safe wallet provider types | Already in project |
| Vite | ^6.3.1 (already installed) | Build tool | Already in project |
| @solana/web3.js | 1.98.4 | Solana RPC connection, Transaction, PublicKey | The standard Solana JS SDK; required by MagicBlock SDK as peer dep |
| @magicblock-labs/ephemeral-rollups-sdk | 0.8.8 | Convenience wrapper for MagicBlock devnet transactions | Official MagicBlock SDK for web3.js integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @phantom/browser-sdk | 1.0.7 | Structured Phantom + embedded wallet SDK | Use if social-login wallets are needed in future; NOT needed for extension-only flow this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct window.phantom injection | @phantom/browser-sdk | SDK adds OAuth/embedded wallets but 10+ KB overhead; extension-only is simpler |
| @solana/web3.js 1.x | @solana/kit (2.x) | kit is the successor but API is very different and MagicBlock SDK targets web3.js 1.x |
| Simple state machine | XState | XState is powerful but 15 KB+ overhead; simple variable + render() is sufficient here |

**Installation:**
```bash
npm install @solana/web3.js @magicblock-labs/ephemeral-rollups-sdk
```

**Version verification (performed 2026-03-17):**
- `@magicblock-labs/ephemeral-rollups-sdk`: 0.8.8 (npm registry)
- `@phantom/browser-sdk`: 1.0.7 (npm registry)
- `@solana/web3.js`: 1.98.4 (npm registry)
- `vitest`: 4.1.0 (npm registry, for test setup)

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── screens/
│   ├── ScreenManager.ts      # State machine; owns currentScreen + render dispatch
│   ├── WalletSplashScreen.ts # Wallet connect UI; calls WalletService
│   ├── MainMenuScreen.ts     # "Play" + "Leaderboard" buttons
│   └── EscMenuOverlay.ts     # ESC overlay; rendered on top of game canvas
├── wallet/
│   ├── WalletService.ts      # Phantom + Backpack detection, connect, disconnect
│   └── wallet.types.ts       # WalletProvider interface, WalletState type
├── session/
│   └── SessionLayer.ts       # MagicBlock connection stub; exposes connect() + sendKill()
└── main.ts                   # Entry point; initializes ScreenManager
```

### Pattern 1: State Machine Screen Router
**What:** A single exported `currentScreen` variable + `setScreen(name)` function. Each screen module exports `mount(container)` and `unmount()`. ScreenManager calls unmount on old screen, mount on new.
**When to use:** Always — this is the locked decision from CONTEXT.md.
**Example:**
```typescript
// src/screens/ScreenManager.ts
// Source: pattern derived from CONTEXT.md locked decisions + existing main.ts style

type Screen = 'wallet' | 'menu' | 'game';

interface ScreenModule {
  mount(container: HTMLElement): void;
  unmount(): void;
}

export class ScreenManager {
  private current: Screen | null = null;
  private modules: Record<Screen, ScreenModule>;
  private container: HTMLElement;

  constructor(container: HTMLElement, modules: Record<Screen, ScreenModule>) {
    this.container = container;
    this.modules = modules;
  }

  navigateTo(screen: Screen): void {
    if (this.current) {
      this.modules[this.current].unmount();
    }
    this.current = screen;
    this.modules[screen].mount(this.container);
  }
}
```

### Pattern 2: Wallet Provider Detection
**What:** Check `window.phantom?.solana` and `window.backpack` at runtime. Both are injected by browser extensions. Both expose the same connect/disconnect/on API surface.
**When to use:** On WalletSplashScreen mount. Show buttons only for installed wallets; grey out or link to install page for missing ones.
**Example:**
```typescript
// src/wallet/WalletService.ts
// Source: https://docs.phantom.com/solana/detecting-the-provider

export type WalletType = 'phantom' | 'backpack';

export interface SolanaProvider {
  isPhantom?: boolean;
  isBackpack?: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (arg?: unknown) => void): void;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
}

export function getProvider(type: WalletType): SolanaProvider | null {
  if (type === 'phantom') {
    const p = (window as unknown as { phantom?: { solana?: SolanaProvider } }).phantom?.solana;
    return p?.isPhantom ? p : null;
  }
  if (type === 'backpack') {
    const p = (window as unknown as { backpack?: SolanaProvider }).backpack;
    return p ?? null;
  }
  return null;
}

export async function connectWallet(type: WalletType): Promise<string> {
  const provider = getProvider(type);
  if (!provider) throw new Error(`${type} extension not installed`);
  const { publicKey } = await provider.connect();
  return publicKey.toString();
}
```

### Pattern 3: MagicBlock Session Layer Stub
**What:** Thin module that creates a `Connection` to MagicBlock devnet router and exposes `sendKillTransaction(killedUnit, signer)`. In Phase 2 this is documented + connected but NOT called (kills happen in Phase 3).
**When to use:** Instantiate when player presses "Play" (locked decision).
**Example:**
```typescript
// src/session/SessionLayer.ts
// Source: https://docs.magicblock.gg, MagicBlock devnet endpoints

import { Connection } from '@solana/web3.js';

const MAGICBLOCK_DEVNET_RPC = 'https://devnet.magicblock.app/';

export class SessionLayer {
  private connection: Connection | null = null;

  async connect(): Promise<void> {
    // Phase 2: establish connection, verify reachable
    this.connection = new Connection(MAGICBLOCK_DEVNET_RPC, 'confirmed');
    // Verify: fetch slot to confirm connectivity
    await this.connection.getSlot();
  }

  getConnection(): Connection {
    if (!this.connection) throw new Error('SessionLayer not connected');
    return this.connection;
  }

  // Phase 3 will implement the actual kill transaction
  async sendKill(_unitId: string): Promise<string> {
    throw new Error('sendKill: not implemented until Phase 3');
  }
}
```

### Pattern 4: ESC Overlay (No Pause)
**What:** A fixed-position DOM overlay rendered on top of the canvas. The game loop continues — overlay does NOT touch the game's `requestAnimationFrame`. Toggled by `keydown` event on Escape key.
**When to use:** During game screen only.
**Example:**
```typescript
// src/screens/EscMenuOverlay.ts
export class EscMenuOverlay {
  private el: HTMLElement | null = null;
  private visible = false;

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.id = 'esc-overlay';
    // overlay styling via ensureRuntimeStyle() pattern from main.ts
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(7,17,29,0.85)',
      display: 'none', zIndex: '100'
    });
    container.appendChild(this.el);
    document.addEventListener('keydown', this.onKey);
  }

  unmount(): void {
    this.el?.remove();
    document.removeEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.toggle();
  };

  toggle(): void {
    this.visible = !this.visible;
    if (this.el) this.el.style.display = this.visible ? 'flex' : 'none';
  }
}
```

### Anti-Patterns to Avoid
- **Storing provider reference globally and assuming it is still valid:** Phantom fires `disconnect` and `accountChanged` events asynchronously. Always re-check `provider.isConnected` before sending a transaction.
- **Calling `connect()` without a user gesture:** Browsers block wallet popups triggered without a click/keydown event. Always call `connect()` inside a button click handler.
- **Mounting multiple screens at once:** ScreenManager must call `unmount()` on the previous screen before mounting the next. Forgetting to unmount leaves orphaned event listeners.
- **Importing wallet SDK in a module loaded before user interaction:** `@solana/web3.js` is large (~1 MB unminified). Use dynamic `import()` or delay import until Play is pressed to keep initial load fast.
- **Waiting for `window.onload` to check for Phantom:** The extension injects `window.phantom` asynchronously after page load. Use a short poll or `waitForPhantomExtension` from `@phantom/browser-sdk` if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Solana transaction construction | Custom binary serialization | `@solana/web3.js` Transaction + Connection | Transaction format, blockhash management, signature encoding are all spec-critical edge cases |
| Wallet detection polling | `setInterval` loop checking `window.phantom` | `waitForPhantomExtension(timeout)` from `@phantom/browser-sdk` OR simple 100 ms setTimeout check after DOMContentLoaded | Race conditions with extension injection timing |
| MagicBlock RPC routing | Direct RPC calls to devnet | `@magicblock-labs/ephemeral-rollups-sdk` | SDK handles delegation, routing to correct shard, transaction preparation |
| Confirmation waiting | Poll `getTransaction()` in loop | `connection.confirmTransaction()` with AbortSignal | Handles retry, timeout, commitment level correctly |

**Key insight:** The wallet injection and Solana transaction API surface are small and stable — minimal dependencies. The value of MagicBlock SDK is in routing complexity, not in API convenience.

---

## Common Pitfalls

### Pitfall 1: Phantom / Backpack Extension Not Installed
**What goes wrong:** `window.phantom` or `window.backpack` is `undefined` when extension is not installed or disabled. Accessing `.solana` on undefined throws.
**Why it happens:** Extensions inject the object after page load; mobile browsers never inject it.
**How to avoid:** Always null-check: `window.phantom?.solana?.isPhantom`. Show a "Install Phantom" link rather than crashing.
**Warning signs:** `TypeError: Cannot read properties of undefined` in console on wallet splash screen.

### Pitfall 2: `connect()` Called Outside User Gesture
**What goes wrong:** Browser blocks the popup; Phantom throws `User rejected the request` or popup never appears.
**Why it happens:** Browser security policy — wallet popups must be user-initiated.
**How to avoid:** Call `provider.connect()` only inside click event handlers. Never call on mount.
**Warning signs:** Connect silently fails on page load or DOMContentLoaded.

### Pitfall 3: Stale Provider After Account Switch
**What goes wrong:** User switches accounts inside Phantom; `provider.publicKey` still shows old key; transactions fail signature verification.
**Why it happens:** `accountChanged` event is not listened to.
**How to avoid:** Listen to `provider.on('accountChanged', handler)` and update stored public key. If new key is null, re-prompt connection.
**Warning signs:** Transactions succeed locally but fail on-chain with signer mismatch.

### Pitfall 4: MagicBlock Devnet Cold Start Latency
**What goes wrong:** First `getSlot()` call to `https://devnet.magicblock.app/` takes 3–10 seconds.
**Why it happens:** MagicBlock devnet spins up ephemeral validators on demand.
**How to avoid:** Show a loading indicator when player presses "Play". Don't block UI thread.
**Warning signs:** Game appears frozen for several seconds after pressing Play.

### Pitfall 5: @solana/web3.js Bundle Size
**What goes wrong:** Adding `@solana/web3.js` increases bundle by ~400 KB gzipped, causing slow initial load.
**Why it happens:** The library is comprehensive and tree-shaking is limited.
**How to avoid:** Use dynamic `import('@solana/web3.js')` in SessionLayer.connect() — loads only when user presses "Play", not on wallet splash screen.
**Warning signs:** Lighthouse shows Time-to-Interactive regression after adding the dependency.

### Pitfall 6: Gas Payment UX Surprise
**What goes wrong:** Players do not expect to pay gas on every kill. Transaction approval popups interrupt gameplay.
**Why it happens:** `signAndSendTransaction` shows Phantom's approval popup every time unless `trusted` mode is used.
**Why it matters:** CONTEXT.md specifies "игрок платит газ". This is the intended behavior, but the UX needs to communicate it clearly on the wallet splash / Play button.
**How to avoid:** Add a visible notice on the wallet splash screen explaining gas costs. Consider `autoApprove` settings if Phantom supports them for devnet.

---

## Code Examples

Verified patterns from official sources:

### Phantom Detection + Connect
```typescript
// Source: https://docs.phantom.com/solana/detecting-the-provider
//         https://docs.phantom.com/solana/establishing-a-connection

const provider = window.phantom?.solana;
if (!provider?.isPhantom) {
  // Not installed — show install link
  return;
}

// Eager connect (silent, for returning users)
try {
  const { publicKey } = await provider.connect({ onlyIfTrusted: true });
  console.log('Auto-reconnected:', publicKey.toString());
} catch {
  // Not trusted yet — user must click "Connect Phantom" button
}

// Manual connect (must be inside click handler)
const { publicKey } = await provider.connect();
```

### Backpack Detection + Connect
```typescript
// Source: https://docs.backpack.app/deeplinks/provider-methods/connect
// Backpack injects window.backpack for its browser extension (different from deep-link mobile API)

const backpack = (window as unknown as { backpack?: { connect(): Promise<{ publicKey: { toString(): string } }> } }).backpack;
if (!backpack) {
  // Not installed
  return;
}
const { publicKey } = await backpack.connect();
```

### MagicBlock Devnet Connection
```typescript
// Source: https://docs.magicblock.gg
// @magicblock-labs/ephemeral-rollups-sdk wraps @solana/web3.js Connection

import { Connection } from '@solana/web3.js';

// MagicBlock devnet public RPC endpoints (2026-03-17 verified)
const MAGICBLOCK_DEVNET = 'https://devnet.magicblock.app/';
const SOLANA_DEVNET = 'https://api.devnet.solana.com';

// Two connections: one to Solana devnet (base layer), one to MagicBlock ER
const baseConnection = new Connection(SOLANA_DEVNET, 'confirmed');
const erConnection = new Connection(MAGICBLOCK_DEVNET, 'confirmed');

// Verify connectivity
const slot = await erConnection.getSlot();
console.log('MagicBlock devnet slot:', slot);
```

### Screen State Machine Initialization
```typescript
// src/main.ts integration point
import { ScreenManager } from './screens/ScreenManager';
import { WalletSplashScreen } from './screens/WalletSplashScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';

const container = document.getElementById('game-container')!;
const manager = new ScreenManager(container, {
  wallet: new WalletSplashScreen(manager),  // passes manager reference for navigation
  menu: new MainMenuScreen(manager),
  game: existingGameModule,
});
manager.navigateTo('wallet');
```

---

## Network Architecture Documentation

### Network Diagram (for NET-01)

```
Browser                 Solana Devnet              MagicBlock Devnet
  |                    api.devnet.solana.com        devnet.magicblock.app
  |                           |                           |
  |-- Wallet connect -------->|                           |
  |   (window.phantom)        |                           |
  |                           |                           |
  |-- "Play" pressed ---------|-------------------------->|
  |   SessionLayer.connect()  |         getSlot()         |
  |                           |                           |
  |-- [Phase 3] Kill event -->|  <--- ER Transaction ---->|
  |   signAndSendTransaction  |   (via MagicBlock router) |
```

**Protocol:** HTTPS/WSS
**Transport:** JSON-RPC (Solana standard)
**Mode:** Client-to-server (not P2P) — both devnet and MagicBlock ER are server endpoints
**Auth:** Wallet signature (ed25519)
**Multiplayer (real-time):** Deferred to Phase 5

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.solana` (legacy) | `window.phantom.solana` (preferred) | ~2022 | Multiple wallets can coexist; `window.solana` is still supported but ambiguous |
| `@solana/web3.js` 1.x as primary | `@solana/kit` (formerly web3.js 2.x) as successor | 2024 | MagicBlock SDK still targets 1.x; use 1.x for this project |
| MagicBlock required Discord access | Public devnet RPC available | 2024–2025 | `https://devnet.magicblock.app/` is now publicly accessible |
| Wallet popup for every tx | `autoApprove` / session keys (experimental) | 2025 | Session keys API in MagicBlock could reduce per-tx popups in Phase 5 |

**Deprecated/outdated:**
- `window.solana` as universal Solana provider: Replaced by wallet-specific injection (`window.phantom.solana`, `window.backpack`). Still works but should not be primary detection method.
- `@solana/web3.js` 1.x deep internals: The 1.x line is in maintenance mode. For this project it is the correct choice due to MagicBlock SDK peer dependency.

---

## Open Questions

1. **Backpack `window.backpack` exact API surface**
   - What we know: Backpack injects `window.backpack` for browser extension; deep-link API is mobile-only
   - What's unclear: Whether `window.backpack` exposes the same `.connect()/.on()` interface as `window.solana`; official extension docs were not found during research
   - Recommendation: Test empirically in Wave 0; fall back to the standard Solana provider interface shape which both wallets share; add `window.backpack.isConnected` guard

2. **MagicBlock kill transaction program address**
   - What we know: `@magicblock-labs/ephemeral-rollups-sdk` 0.8.8 provides routing helpers; BOLT ECS is the on-chain framework
   - What's unclear: Whether a kill-recording program is already deployed on devnet or needs to be deployed in Phase 3
   - Recommendation: SessionLayer stub in Phase 2 does not call any program; Phase 3 research will discover/deploy the program

3. **Gas UX with per-kill transactions**
   - What we know: Every Phantom `signAndSendTransaction` shows an approval popup by default
   - What's unclear: Whether Phantom's "trusted app" mode or MagicBlock session keys can batch/auto-approve
   - Recommendation: Document the UX reality clearly in wallet splash screen copy; investigate auto-approve in Phase 3 when kills are implemented

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 (not yet installed in project) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | WalletSplashScreen mounts and shows wallet buttons | unit | `npx vitest run src/screens/WalletSplashScreen.test.ts` | ❌ Wave 0 |
| UI-01 | MainMenuScreen shows "Play" and "Leaderboard" buttons | unit | `npx vitest run src/screens/MainMenuScreen.test.ts` | ❌ Wave 0 |
| UI-02 | ScreenManager.navigateTo transitions between screens without reload | unit | `npx vitest run src/screens/ScreenManager.test.ts` | ❌ Wave 0 |
| NET-01 | Network architecture documented in SessionLayer.ts JSDoc | manual-only | Review `src/session/SessionLayer.ts` — documentation is the artifact | n/a |
| NET-02 | SessionLayer.connect() resolves without error on devnet | integration (manual) | Manual — requires live devnet; smoke test connects and calls getSlot() | ❌ Wave 0 |
| NET-03 | SessionLayer stub exposes documented interface | unit | `npx vitest run src/session/SessionLayer.test.ts` | ❌ Wave 0 |

**Note on NET-02:** Automated integration tests against live devnet are fragile (network-dependent). Recommend a smoke test script that is run manually, not in CI.

### Sampling Rate
- **Per task commit:** `npx vitest run src/screens/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — vitest not installed; run `npm install -D vitest jsdom @vitest/ui`
- [ ] `src/screens/ScreenManager.test.ts` — covers UI-02 (screen transition logic)
- [ ] `src/screens/WalletSplashScreen.test.ts` — covers UI-01 (wallet buttons render)
- [ ] `src/screens/MainMenuScreen.test.ts` — covers UI-01 (menu buttons render)
- [ ] `src/session/SessionLayer.test.ts` — covers NET-03 (interface contract)

---

## Sources

### Primary (HIGH confidence)
- https://docs.phantom.com/solana/detecting-the-provider — `window.phantom?.solana?.isPhantom` detection pattern
- https://docs.phantom.com/solana/establishing-a-connection — `provider.connect()`, events, eager connect
- https://docs.phantom.com/llms.txt — documentation index, confirmed vanilla JS quickstart exists
- npm registry (live query 2026-03-17) — confirmed package versions: web3.js 1.98.4, ephemeral-rollups-sdk 0.8.8, browser-sdk 1.0.7, vitest 4.1.0

### Secondary (MEDIUM confidence)
- https://docs.magicblock.gg/llms.txt — MagicBlock devnet RPC endpoints confirmed (`devnet.magicblock.app`, `devnet-router.magicblock.app`)
- https://github.com/magicblock-labs/ephemeral-rollups-sdk — two SDKs: `ephemeral-rollups-sdk` (web3.js) and `ephemeral-rollups-kit` (@solana/kit); Phase 2 uses the web3.js variant
- https://docs.phantom.com/sdks/browser-sdk — `@phantom/browser-sdk` API, `waitForPhantomExtension()` utility

### Tertiary (LOW confidence)
- Backpack browser extension `window.backpack` API — not found in official docs; inferred from community patterns. Validate empirically in Wave 0.
- MagicBlock session keys / auto-approve for devnet — referenced in docs but experimental status unknown.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions live-verified via npm registry
- Architecture (screen routing): HIGH — locked in CONTEXT.md, consistent with existing main.ts patterns
- Architecture (wallet): HIGH — Phantom APIs verified via official docs
- Architecture (MagicBlock): MEDIUM — devnet endpoints confirmed; on-chain program for kills is Phase 3 concern
- Pitfalls: MEDIUM — wallet pitfalls from official docs; MagicBlock pitfalls from single blog source

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days) — Phantom and web3.js APIs are stable; MagicBlock devnet URLs may change (7-day risk for MagicBlock specifically)
