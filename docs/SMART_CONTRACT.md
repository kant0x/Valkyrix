# Valkyrix Smart Contract

Deprecated note:

- This file contains stale historical notes with broken encoding below.
- Use `docs/SMART_CONTRACT_CURRENT.md` for the current contract spec.
- Use `docs/SMART_CONTRACT_BIBLE.md` for the issue register and fix roadmap.

See also:

- [SMART_CONTRACT_BIBLE.md](/e:/py_scrypt/карта валкирикс/docs/SMART_CONTRACT_BIBLE.md) — full problem register, security gaps, and fix roadmap

## Что это

`Valkyrix Ledger` — это Anchor-программа для Solana, которая хранит on-chain след игровых событий и итогов матчей.

Она нужна для того, чтобы:
- записывать `kill` как on-chain событие
- записывать создание башен и воинов как on-chain событие
- фиксировать исход босса
- собирать честный session score из уже записанных событий
- хранить `best_score` и `games_played` игрока в одном on-chain аккаунте

Важно:
- это не “вся игра на блокчейне”
- это не замена `MagicBlock`
- это контракт, который исполняется через Solana / MagicBlock

`MagicBlock Ephemeral Rollup` нужен сверху, чтобы эти вызовы исполнялись быстро, а не как обычный медленный L1-only flow.

## Где лежит

- Workspace: [anchor/Anchor.toml](/e:/py_scrypt/карта%20валкирикс/anchor/Anchor.toml)
- Program crate: [anchor/programs/valkyrix_ledger/Cargo.toml](/e:/py_scrypt/карта%20валкирикс/anchor/programs/valkyrix_ledger/Cargo.toml)
- Program code: [anchor/programs/valkyrix_ledger/src/lib.rs](/e:/py_scrypt/карта%20валкирикс/anchor/programs/valkyrix_ledger/src/lib.rs)

## On-chain модель

### PDA аккаунты

`GameConfig`
- seeds: `["game-config"]`
- хранит authority игры
- создаётся один раз

`PlayerLedger`
- seeds: `["player-ledger", player_pubkey]`
- один аккаунт на игрока
- хранит:
  - `best_score`
  - `last_session_score`
  - `games_played`
  - `total_kills`
  - `total_creates`
  - `boss_kills`
  - `boss_negotiations`
  - текущие счётчики активной сессии

### Счёт

Контракт считает score так же, как текущая игра:
- `kill` = `+10`
- `create` = `+1`
- `boss killed` = `+1000`
- `boss negotiated` = `+1000`

Это убирает рассинхрон, когда клиент мог бы послать произвольный final score отдельно от event-истории.

## Инструкции

### `initialize_game`

Создаёт глобальный `GameConfig`.

Когда вызывать:
- один раз после деплоя

### `initialize_player`

Создаёт `PlayerLedger` для конкретного кошелька.

Когда вызывать:
- при первом входе игрока в on-chain режим

### `start_session(session_nonce)`

Открывает активную игровую сессию для игрока и сбрасывает session counters.

Когда вызывать:
- в начале матча

### `record_kill(unit_type, timestamp)`

Пишет on-chain событие убийства.

Что обновляет:
- `total_kills`
- `current_session_kills`
- `current_session_score`

### `record_create(unit_type, timestamp)`

Пишет on-chain событие создания юнита или башни.

Что обновляет:
- `total_creates`
- `current_session_creates`
- `current_session_score`

### `record_boss_outcome(outcome, timestamp)`

Пишет исход встречи с боссом.

Ограничение:
- только один раз за активную сессию

### `finalize_session(timestamp)`

Закрывает сессию и фиксирует:
- `last_session_score`
- `best_score`
- `games_played`

## Как это связано с текущим клиентом

Сейчас клиентская часть уже знает, где брать события:
- убийства: [CombatSystem.ts](/e:/py_scrypt/карта%20валкирикс/src/game/CombatSystem.ts)
- создание башен: [BuildingSystem.ts](/e:/py_scrypt/карта%20валкирикс/src/game/BuildingSystem.ts)
- создание воинов: [RecruitmentSystem.ts](/e:/py_scrypt/карта%20валкирикс/src/game/RecruitmentSystem.ts)
- исход босса: [BossSystem.ts](/e:/py_scrypt/карта%20валкирикс/src/game/BossSystem.ts)
- session итог: [main.ts](/e:/py_scrypt/карта%20валкирикс/src/main.ts)

Сейчас [BlockchainService.ts](/e:/py_scrypt/карта%20валкирикс/src/blockchain/BlockchainService.ts) ещё шлёт memo-based placeholder TX.

Следующий шаг интеграции:
1. заменить memo instruction на Anchor program calls
2. добавить PDA derivation для `GameConfig` и `PlayerLedger`
3. вызывать `start_session` в начале боя
4. вызывать `finalize_session` в конце боя
5. leaderboard продолжать хранить через SOAR или перевести на чтение из `PlayerLedger` + отдельный индексатор

## Где здесь MagicBlock

Правильный flow такой:

1. Деплоим Solana Anchor program `valkyrix_ledger`
2. Инициализируем `GameConfig`
3. Перед матчем делегируем игровые аккаунты в `MagicBlock ER`
4. Во время матча клиент шлёт `record_kill`, `record_create`, `record_boss_outcome`
5. В конце матча шлёт `finalize_session`
6. Состояние потом коммитится обратно в Solana

То есть:
- `smart contract` хранит правила и state
- `MagicBlock` даёт быстрый runtime для этих инструкций

## Что контракт сейчас гарантирует

- единый on-chain ledger на игрока
- единый session score rule-set
- защита от повторной записи boss outcome в одной сессии
- невозможность писать event до `start_session`
- `best_score` и `games_played` считаются на chain

## Что контракт пока не гарантирует

Поскольку боевая логика пока не исполняется целиком on-chain, контракт пока не может сам доказать, что:
- kill действительно произошёл в реальном бою
- игрок не вызвал `record_kill` вручную

Сейчас это event ledger контракт, а не fully authoritative combat contract.

Это нормальный промежуточный этап для Phase 5.

Если позже захотим полный trust-minimized режим, следующий уровень — перенос критической match-логики в отдельный on-chain / server-authoritative execution layer.

## Деплой

Минимальная последовательность:

1. Установить Solana CLI
2. Установить Anchor CLI
3. Создать или указать devnet wallet
4. Перейти в [anchor](/e:/py_scrypt/карта%20валкирикс/anchor)
5. Выполнить:

```bash
anchor build
anchor deploy --provider.cluster devnet
```

После деплоя:
- актуальный devnet `program id`: `NkxXENw6u1jWc8iUo28M9NiDVEcoUdqGiGZ3TyNf9Xn`
- добавить этот `program id` в клиентский blockchain-слой

## Следующий практический шаг

Следующий технический шаг для проекта:
- научить [BlockchainService.ts](/e:/py_scrypt/карта%20валкирикс/src/blockchain/BlockchainService.ts) вызывать этот Anchor-контракт вместо memo TX

После этого уже можно подключать `MagicBlock delegation` не абстрактно, а к реальным PDA этого контракта.

## Источники архитектуры

Основано на:
- MagicBlock ER quickstart: https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart
- Anchor program structure: https://www.anchor-lang.com/docs/basics/program-structure

## Update 2026-03-27

Current client status:
- `BlockchainService` no longer uses memo placeholder transactions.
- Match start now initializes `GameConfig` and `PlayerLedger` PDAs when needed.
- Battle session sends real `initialize_game`, `initialize_player`, `start_session`, `record_kill`, `record_create`, `record_boss_outcome`, and `finalize_session` instructions to `Valkyrix Ledger`.
- If session initialization fails before battle start, the match falls back to offline mode instead of breaking the game flow.

Still pending for full MagicBlock production flow:
- deploy the Anchor program to devnet/mainnet target
- wire real delegation / undelegation around the session PDAs
- run live browser verification with a funded wallet and inspect devnet signatures
