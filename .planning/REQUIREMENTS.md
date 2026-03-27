# Requirements: Valkyrix

**Defined:** 2026-03-17
**Core Value:** An edited map must load in the game and behave exactly as designed: same isometric structure, same layer meaning, same movement logic, and the same camera behavior after every save.

## v1 Requirements

### Map Contract

- [x] **MAP-01**: User can save a map from the editor to a stable JSON structure used by the runtime
- [x] **MAP-02**: User can activate a saved map so the game runtime loads it through `active-map.json`
- [x] **MAP-03**: Runtime can load an exported map without requiring the editor to be present on the server
- [x] **MAP-04**: Re-saving a map in the editor updates runtime behavior without manual code edits

### Isometric Runtime

- [x] **ISO-01**: Runtime renders the map in the same isometric orientation used in the editor
- [x] **ISO-02**: Runtime uses exported map width, height, tile width, and tile height as the source of truth
- [x] **ISO-03**: Runtime preserves correct world positioning for tiles and gameplay anchors on the isometric grid

### Layers

- [x] **LAYR-01**: `ground` acts as the base visual and structural map layer in runtime
- [x] **LAYR-02**: `paths` defines gameplay movement routes and route-related map meaning
- [x] **LAYR-03**: `cam` defines camera-rail behavior when present, with stable fallback rules when absent
- [x] **LAYR-04**: `spawn` defines enemy or unit entry points in the runtime map
- [x] **LAYR-05**: `citadel` defines the main base/goal location in the runtime map
- [x] **LAYR-06**: `zones` defines gameplay zones such as restricted, buildable, or trigger areas
- [x] **LAYR-07**: `decor` remains visual-only and does not silently affect gameplay logic

### Camera

- [x] **CAM-01**: Runtime applies exported camera zoom, start position, road offset, and movement mode
- [x] **CAM-02**: Runtime applies exported camera bounds and camera rail behavior exactly as saved by the editor
- [x] **CAM-03**: Editor game-mode preview matches runtime camera behavior closely enough for map tuning to be trustworthy

### Runtime Interpretation

- [x] **RUN-01**: Runtime interprets gameplay-relevant layers consistently from one map load to the next
- [x] **RUN-02**: Runtime exposes spawn, citadel, path, and camera information from map data instead of hardcoded values
- [x] **RUN-03**: Runtime renders or represents exported entities in a way that preserves their gameplay meaning

## v2 Requirements

### Phase 2 — Menu & Network

- [x] **UI-01**: Игрок видит главное меню при старте и может начать игру
- [x] **UI-02**: Экраны маршрутизируются без перезагрузки страницы (лобби, игра, меню)
- [x] **NET-01**: Задокументирована схема сети (протокол, транспорт, сервер/P2P)
- [x] **NET-02**: Меню подключается к игровой сессии через задокументированный слой
- [x] **NET-03**: Лобби/комнаты — игроки могут создавать и вступать в сессии

### Phase 3 — Units, Buildings & Combat

- [x] **UNIT-01**: Каждый тип юнита имеет здоровье, скорость, роль (задокументировано)
- [x] **UNIT-02**: Юниты спавнятся на `spawn`, движутся по `paths`, атакуют цитадель
- [x] **BLDG-01**: Здания размещаются в `zones`, каждое имеет механику баффа или атаки
- [x] **BLDG-02**: Волны врагов запускаются по таймеру/триггеру
- [x] **GAME-01**: Игрок может проиграть (цитадель захвачена) или выиграть раунд
- [x] **GAME-02**: In-game HUD показывает состояние игры (волны, здоровье, ресурсы)

### Phase 4 — Boss Negotiation

- [x] **BOSS-01**: Босс появляется на карте по триггеру (событие волны или условие)
- [x] **BOSS-02**: Игроку показывается диалог-переговоры с вариантами ответа
- [x] **BOSS-03**: Успешные переговоры: босс уходит, игрок получает баффы
- [x] **BOSS-04**: Провал переговоров: босс злой, призывает орду, боёвка усиливается

### Phase 5 — Multiplayer & Blockchain

- [x] **NET-04**: Несколько игроков играют в одной сессии в реальном времени
- [x] **CHAIN-01**: Каждый убитый юнит записывается как on-chain транзакция через MagicBlock
- [x] **CHAIN-02**: Лидерборд хранится на блокчейне
- [x] **CHAIN-03**: Лидерборд читается из блокчейна и отображается в игре

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full combat and progression systems in v1 | The current project focus is the map runtime and layer behavior foundation |
| Server-hosted editor runtime dependency | The game must depend on exported map data, not editor presence |
| A second runtime-only map format | A single map contract is required to keep editor/runtime parity trustworthy |
| Premature migration to a heavier game engine | Current priority is stabilizing map semantics and runtime behavior |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAP-01 | Phase 1 | Complete |
| MAP-02 | Phase 1 | Complete |
| MAP-03 | Phase 1 | Complete |
| MAP-04 | Phase 1 | Complete |
| ISO-01 | Phase 1 | Complete |
| ISO-02 | Phase 1 | Complete |
| ISO-03 | Phase 1 | Complete |
| LAYR-01 | Phase 1 | Complete |
| LAYR-02 | Phase 1 | Complete |
| LAYR-03 | Phase 1 | Complete |
| LAYR-04 | Phase 1 | Complete |
| LAYR-05 | Phase 1 | Complete |
| LAYR-06 | Phase 1 | Complete |
| LAYR-07 | Phase 1 | Complete |
| CAM-01 | Phase 1 | Complete |
| CAM-02 | Phase 1 | Complete |
| CAM-03 | Phase 1 | Complete |
| RUN-01 | Phase 1 | Complete |
| RUN-02 | Phase 3 | Complete |
| RUN-03 | Phase 3 | Complete |
| UI-01 | Phase 2 | Complete |
| UI-02 | Phase 2 | Complete |
| NET-01 | Phase 2 | Complete |
| NET-02 | Phase 2 | Complete |
| NET-03 | Phase 2 | Complete |
| UNIT-01 | Phase 3 | Complete |
| UNIT-02 | Phase 3 | Complete |
| BLDG-01 | Phase 3 | Complete |
| BLDG-02 | Phase 3 | Complete |
| GAME-01 | Phase 3 | Complete |
| GAME-02 | Phase 3 | Complete |
| BOSS-01 | Phase 4 | Complete |
| BOSS-02 | Phase 4 | Complete |
| BOSS-03 | Phase 4 | Complete |
| BOSS-04 | Phase 4 | Complete |
| NET-04 | Phase 5 | Complete |
| CHAIN-01 | Phase 5 | Complete |
| CHAIN-02 | Phase 5 | Complete |
| CHAIN-03 | Phase 5 | Complete |

**Coverage:**
- Phase 1 complete: 18 requirements
- Phase 2–5 pending: 21 requirements

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 — Phase 1 complete, all map/iso/camera/layer requirements satisfied*
