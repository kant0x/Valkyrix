# Phase 5: Multiplayer & Blockchain Leaderboard - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning (partial — transactions decided, leaderboard/failover to discuss later)

<domain>
## Phase Boundary

Настоящий мультиплеер: несколько игроков в одной сессии, каждый убитый юнит = on-chain транзакция через MagicBlock, лидерборд хранится на блокчейне и отображается в игре.

Контракт данных, UI лидерборда и сетевые сбои — уточнить перед планированием соответствующих планов.

</domain>

<decisions>
## Implementation Decisions

### Транзакции убийств
- Каждый убитый юнит = отдельная on-chain транзакция (не батч, не агрегация по волне)
- Сеть: Solana **devnet** на фазе 5 (mainnet — отдельный шаг)
- Payload транзакции: `wallet + unit_type + timestamp`
- Газ платит **игрок из своего кошелька** (Phantom/Backpack, уже подключены через WalletService)
- MagicBlock ephemeral rollup держит скорость даже при высоком темпе kills

### Лидерборд — UI и данные
- Уточнить отдельно (где показывается, что хранится on-chain, как выглядит экран)

### Сетевые сбои и fallback
- Уточнить отдельно (disconnects, blockchain lag, offline поведение)

### Claude's Discretion
- Структура Anchor/MagicBlock программы (program ID, accounts layout)
- Retry-логика при failed TX
- Оптимистичный vs подтверждённый UI (показать kill сразу или ждать подтверждения)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WalletService.ts` — Phantom/Backpack подключение, `publicKey` доступен, уже стабилен
- `SessionLayer.ts` — MagicBlock devnet заглушка, точка интеграции для реального подключения
- `CombatSystem.ts` — источник kill-событий, сюда подключается TX-хук

### Established Patterns
- TypeScript strict mode, Vitest TDD, jsdom для unit-тестов
- Экраны — классы-синглтоны через ScreenManager
- Состояние игры через `GameState` / системы (ECS-like)

### Integration Points
- `CombatSystem` → kill event → `BlockchainService.recordKill(unitType, walletPubkey)`
- `SessionLayer` → заменить stub на реальный MagicBlock ephemeral session
- `MainMenuScreen` / результирующий оверлей → показ лидерборда (точка интеграции TBD)

</code_context>

<specifics>
## Specific Ideas

- Kill TX должна отправляться **fire-and-forget** — игра не ждёт подтверждения транзакции, чтобы не лагать

</specifics>

<deferred>
## Deferred Ideas

- Mainnet деплой — после отдельного аудита и балансировки газа
- Multiplayer session model (сколько игроков, P2P vs сервер) — не обсуждалось, можно в 05-01

</deferred>

---

*Phase: 05-multiplayer-blockchain-leaderboard*
*Context gathered: 2026-03-26*
