# Valkyrix

Valkyrix is a browser-based strategy action game built with TypeScript and integrated with MagicBlock. Players connect a wallet, start a battle session, and generate on-chain gameplay events such as unit creation, kills, boss outcomes, session finalization, and leaderboard score submission.

The project integrates MagicBlock Ephemeral Rollup through `@magicblock-labs/ephemeral-rollups-sdk` and `ConnectionMagicRouter`. When a battle starts, Valkyrix opens a temporary on-chain session and routes frequent gameplay transactions through MagicBlock infrastructure for faster, lower-latency processing than a base-chain-only flow.

## MagicBlock integration

- `src/session/SessionLayer.ts` establishes the MagicBlock session connection.
- `src/blockchain/BlockchainService.ts` manages session lifecycle and submits gameplay events.
- `src/blockchain/ValkyrixLedgerClient.ts` builds the on-chain instructions used by the game.
- `src/blockchain/LeaderboardService.ts` submits final scores to the leaderboard.
- `anchor/programs/valkyrix_ledger/src/lib.rs` contains the Anchor program used by the game ledger.

## Smart Contract and MagicBlock folders

- `anchor/programs/valkyrix_ledger/` smart contract source code for the Valkyrix on-chain ledger
- `src/blockchain/` MagicBlock transaction flow, ledger client, session writes, and leaderboard submission
- `src/session/` MagicBlock connection and Ephemeral Rollup session layer
- `scripts/` helper scripts for contract deploy and SOAR / leaderboard initialization

## Project structure

- `src/game/` core gameplay systems
- `src/screens/` UI screens and overlays
- `src/blockchain/` MagicBlock, leaderboard, and on-chain client logic
- `src/session/` session connection layer
- `src/wallet/` wallet detection and connection flow
- `anchor/` on-chain Anchor program
- `public/` runtime assets
- `scripts/` deployment and initialization scripts
- `docs/` smart-contract and implementation notes

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment

Use `.env.example` as the template for local configuration. Do not commit `.env.local`, private keys, wallet secrets, or any personal deployment credentials.

## Public repo note

If this repository is used for a MagicBlock submission, the integration surface should remain public at minimum:

- `src/session/`
- `src/blockchain/`
- `src/wallet/`
- `anchor/`
- `scripts/`

## Russian summary

Valkyrix — браузерная strategy-action игра на TypeScript с интеграцией MagicBlock. Игрок подключает кошелёк, запускает боевую сессию и создаёт on-chain игровые события. MagicBlock Ephemeral Rollup используется для быстрой обработки частых игровых транзакций во время боя, а итоговые данные сессии и результаты отправляются через блокчейн-слой проекта.
