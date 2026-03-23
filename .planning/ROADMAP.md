# Roadmap: Valkyrix

## Overview

Valkyrix v1 строится поэтапно: сначала фундамент карты (уже готов), затем меню и сеть-подключение, геймплей с юнитами и зданиями, уникальная механика переговоров с боссом, и наконец — настоящий мультиплеер с блокчейн-лидербордом через MagicBlock.

## Phases

- [x] **Phase 1: Map & Runtime Foundation** — Редактор карт, изометрический рендерер, экспорт/активация карты, система слоёв, камера. Всё готово.
- [x] **Phase 2: Menu & Network Architecture** — Главное меню, как оно устроено, через что подключается, на какой сети работает. Лобби, комнаты, маршрутизация экранов. (completed 2026-03-17)
- [x] **Phase 3: Units, Buildings & Combat** — Юниты (здоровье, движение по path, кто за что отвечает), здания и их баффы, базовая боёвка, волны врагов.
- [ ] **Phase 4: Boss — Negotiation Mechanic** — Босс выходит на поле; игрок может договориться с ним (он уходит → баффы) или провалить переговоры (он остаётся злой → призывает орду своих юнитов). Диалог, ИИ-мозг босса, реакции.
- [ ] **Phase 5: Multiplayer & Blockchain Leaderboard** — Настоящий мультиплеер подключается, каждый убитый юнит = транзакция через MagicBlock, лидерборд привязан к блокчейну.

## Phase Details

### Phase 1: Map & Runtime Foundation
**Goal**: Полная система изометрической карты — редактор, стабильный JSON-контракт, runtime-рендерер, камера, все 7 слоёв.
**Depends on**: Nothing (first phase)
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, ISO-01, ISO-02, ISO-03, LAYR-01, LAYR-02, LAYR-03, LAYR-04, LAYR-05, LAYR-06, LAYR-07, CAM-01, CAM-02, CAM-03, RUN-01
**Status**: Complete
**Plans**: 1 complete

### Phase 2: Menu & Network Architecture
**Goal**: Главное меню с маршрутизацией экранов, лобби/комнаты, понятная схема подключения (какой протокол, какая сеть, как меню стыкуется с геймплеем).
**Depends on**: Phase 1
**Requirements**: UI-01, NET-01, NET-02, NET-03
**Success Criteria** (what must be TRUE):
  1. Игрок видит главное меню при старте и может перейти к игре.
  2. Определена и задокументирована схема сети: протокол, транспорт, сервер/P2P.
  3. Меню подключается к игровой сессии через задокументированный слой.
  4. Экраны маршрутизируются без перезагрузки страницы.
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Install deps (@solana/web3.js, MagicBlock SDK, vitest) + test scaffolds
- [ ] 02-02-PLAN.md — Type contracts (wallet.types.ts) + ScreenManager state machine
- [ ] 02-03-PLAN.md — WalletService + WalletSplashScreen (Phantom + Backpack gate)
- [ ] 02-04-PLAN.md — MainMenuScreen + SessionLayer (MagicBlock devnet stub, NET-01 docs)
- [ ] 02-05-PLAN.md — EscMenuOverlay (no-pause) + HudOverlay
- [ ] 02-06-PLAN.md — Wire ScreenManager into main.ts + human verification checkpoint

### Phase 02.1: Menu and UX refresh (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 2
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 02.1 to break down)

### Phase 02.2: In-game menu and overlay UX (INSERTED)

**Goal:** Turn the current passive HUD and emergency build buttons into a real in-match command layer: persistent bottom battle bar, compact ESC system overlay, and visually aligned result overlays.
**Requirements**: GAME-02, BLDG-01, UI-02
**Depends on:** Phase 2
**Status**: Complete
**Plans:** 3 complete

Plans:
- [x] 02.2-01-PLAN.md - Refactor HudOverlay into a bottom command bar with explicit battle-control APIs
- [x] 02.2-02-PLAN.md - Wire main.ts to HUD-driven tower commands and remove floating build buttons
- [x] 02.2-03-PLAN.md - Refresh EscMenuOverlay as a compact system overlay and run human verification

### Phase 3: Units, Buildings & Combat
**Goal**: Юниты ходят по authored paths, здания размещаются на карте и дают баффы, базовая боёвка работает, волны врагов запускаются.
**Depends on**: Phase 2
**Requirements**: GAME-01, GAME-02, UNIT-01, UNIT-02, BLDG-01, BLDG-02
**Success Criteria** (what must be TRUE):
  1. Юниты спавнятся на `spawn`, движутся по `paths`, атакуют цитадель.
  2. Каждый тип юнита имеет определённое здоровье, скорость, роль.
  3. Здания размещаются в `zones`, у каждого есть механика баффа/атаки.
  4. Волны запускаются по таймеру/триггеру, игрок может проиграть или выиграть раунд.
**Status**: In Progress
**Plans**: 6 implemented, human verification and acceptance pending

Plans:
- [ ] 03-01-PLAN.md — Type contracts (game.types.ts) + PathExtractor (wave 1)
- [ ] 03-02-PLAN.md — GameState factory + UnitSystem + WaveController (wave 2)
- [ ] 03-03-PLAN.md — BuildingSystem + ProjectileSystem + ResourceSystem (wave 2, parallel)
- [ ] 03-04-PLAN.md — CombatSystem + win/loss conditions (wave 3)
- [ ] 03-05-PLAN.md — GameRenderer + HudOverlay extensions (wave 3, parallel)
- [ ] 03-06-PLAN.md — Wire all systems into main.ts + human verification checkpoint (wave 4)

### Phase 4: Boss — Negotiation Mechanic
**Goal**: Босс появляется на поле как особый юнит. Игрок видит диалог-переговоры. Два исхода: договорились (босс уходит, игрок получает баффы) или провал (босс злой, призывает орду юнитов).
**Depends on**: Phase 3
**Requirements**: BOSS-01, BOSS-02, BOSS-03, BOSS-04
**Success Criteria** (what must be TRUE):
  1. Босс появляется на карте по условию (триггер волны / событие).
  2. Игроку показывается диалог-переговоры с несколькими вариантами ответа.
  3. Успешные переговоры: босс уходит, игрок получает конкретные баффы.
  4. Провал: босс остаётся злым, вызывает орду своих юнитов, боёвка усиливается.
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Extend game.types.ts (negotiation phase, UnitDef.enraged, BossNegotiationState) + UnitSystem boss-freeze guard (wave 1)
- [ ] 04-02-PLAN.md — BossSystem: detection, success/failure outcomes, horde enqueue, forceReset (wave 2, TDD)
- [ ] 04-03-PLAN.md — NegotiationOverlay: modal DOM class with two choice buttons (wave 2, TDD, parallel)
- [ ] 04-04-PLAN.md — Wire BossSystem into main.ts rAF loop + human verification checkpoint (wave 3)

### Phase 5: Multiplayer & Blockchain Leaderboard
**Goal**: Настоящий мультиплеер запущен, каждый убитый юнит — транзакция через MagicBlock, лидерборд хранится на блокчейне и отображается в игре.
**Depends on**: Phase 4
**Requirements**: NET-04, CHAIN-01, CHAIN-02, CHAIN-03
**Success Criteria** (what must be TRUE):
  1. Несколько игроков играют в одной сессии в реальном времени.
  2. Каждый убитый юнит записывается как on-chain транзакция через MagicBlock.
  3. Лидерборд читается из блокчейна и отображается в игре.
  4. Сеть стабильно работает под нагрузкой нескольких одновременных сессий.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Map & Runtime Foundation | 1/1 | Complete | 2026-03-17 |
| 2. Menu & Network Architecture | 6/6 | Complete   | 2026-03-17 |
| 02.1. Menu and UX refresh | 0/0 | Planning | - |
| 02.2. In-game menu and overlay UX | 3/3 | Complete | 2026-03-21 |
| 3. Units, Buildings & Combat | 6/6 implemented | In Progress | - |
| 4. Boss — Negotiation Mechanic | 0/4 | Planned | - |
| 5. Multiplayer & Blockchain Leaderboard | 0/TBD | Not started | - |
