# Phase 5: Multiplayer & Blockchain Leaderboard - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning (full context — all areas discussed)

<domain>
## Phase Boundary

Каждый убитый юнит и каждый созданный юнит = on-chain транзакция через MagicBlock.
Лидерборд хранится на блокчейне — каждый игрок видит чужой score.
Игра однопользовательская — мультиплеер означает общий on-chain лидерборд, не синхронизацию сессий.

</domain>

<decisions>
## Implementation Decisions

### Транзакции (kill + create)
- Каждый убитый вражеский юнит = отдельная on-chain TX (+10 очков)
- Каждый созданный свой юнит = отдельная on-chain TX (+1 очко)
- Payload: `wallet + unit_type + timestamp`
- Газ платит игрок из своего кошелька (Phantom/Backpack)
- Сеть: Solana **devnet** на фазе 5
- Fire-and-forget: игра не ждёт подтверждения TX
- Kill TX: **1 retry** при неудаче, потом молча теряем

### Система очков
- Создание своего юнита = **1 очко**
- Убийство вражеского юнита = **10 очков**
- Убийство босса = **10 очков**
- Договорился с боссом = **10 000 очков**
- Не договорился → бесконечная орда, за kills можно набрать 20-30k+

### Лидерборд — данные (on-chain)
- On-chain per wallet: `best_score` (лучшая сессия) + `games_played` (кол-во боёв)
- Score сабмитится один раз в конце сессии (не накопительно)
- SOAR SDK для хранения и чтения лидерборда

### Лидерборд — UI
- Находится в **главном меню** (отдельный пункт/кнопка)
- Показывает **Top 100 + моя позиция** (если игрок за пределами топ-100)
- Каждая строка: `rank + wallet (abc...xyz) + score + kills`

### Мультиплеер (уточнение)
- Игра однопользовательская — нет real-time синхронизации, нет Colyseus, нет комнат
- "Мультиплеер" = общий on-chain лидерборд где каждый видит чужой score
- **Plan 05-05 (Colyseus) должен быть удалён**

### Сетевые сбои и fallback
- Kill TX упала → 1 retry в фоне, потом молча теряем (игра не прерывается)
- Chain недоступна **в начале сессии** → показать "помехи", закрыть сессию
- Score TX упала в конце сессии из-за нехватки SOL → показать "пополните баланс"
- Score TX упала по другой причине → 3 retry, потом показать ошибку (сессия не попадает в лидерборд)

### Claude's Discretion
- Структура Anchor программы (program ID, accounts layout)
- Анимация/стиль экрана лидерборда (цвета, типографика)
- Точный формат адреса кошелька (abc...xyz — сколько символов)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WalletService.ts` — Phantom/Backpack подключение, `publicKey` доступен
- `SessionLayer.ts` — MagicBlock devnet заглушка → заменить на реальный ConnectionMagicRouter
- `CombatSystem.ts` — источник kill-событий (хук для TX)
- `ValkyrixMainMenuScreen.ts` — главное меню, сюда добавить кнопку лидерборда
- `NegotiationOverlay.ts` — источник boss outcome (договорился/не договорился → score bonus)

### Established Patterns
- TypeScript strict mode, Vitest TDD, jsdom для unit-тестов
- Экраны — классы-синглтоны через ScreenManager
- Состояние игры через GameState / ECS-like системы

### Integration Points
- `CombatSystem` → kill → `BlockchainService.recordKill(unitType, pubkey)` (fire-and-forget, 1 retry)
- `BuildingSystem` / `RecruitmentSystem` → unit created → `BlockchainService.recordCreate(unitType, pubkey)`
- `NegotiationOverlay` outcome → `BlockchainService.recordBossOutcome(outcome, pubkey)`
- `SessionLayer` → реальный devnet MagicBlock
- `ValkyrixMainMenuScreen` → новая кнопка → `LeaderboardScreen`
- Session end → `LeaderboardService.submitScore(score, kills, pubkey)` с 3 retry

</code_context>

<specifics>
## Specific Ideas

- Лидерборд в главном меню — отдельный экран, не оверлей
- "Помехи" при недоступности chain в начале — короткое сообщение, закрывает сессию
- "Пополните баланс" — отдельное сообщение при insufficient funds на score TX
- Бесконечная орда после провала переговоров — механика уже есть в Phase 4

</specifics>

<deferred>
## Deferred Ideas

- Mainnet деплой — после отдельного аудита
- Real-time multiplayer / co-op сессии — не планируется в этой игре
- Анимированный лидерборд (highlight новой записи) — после MVP

</deferred>

---

*Phase: 05-multiplayer-blockchain-leaderboard*
*Context gathered: 2026-03-26 (updated — full discussion)*
