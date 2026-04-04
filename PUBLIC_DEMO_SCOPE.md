# Объём Публичного Демо-Репозитория

Используй этот файл как чеклист при упаковке публичного репозитория для GitHub Pages.

## Оставить в публичном demo repo

- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite/`
- `vitest.config.ts`
- `src/blockchain/`
- `src/session/`
- `src/wallet/`
- `src/screens/`
- `src/game/`
- `src/rendering/`
- `src/shared/`
- `src/i18n/`
- `src/assets/`
- `src/main.ts`
- `src/game-tick.worker.ts`
- `src/vite-env.d.ts`
- `public/assets/`
- `anchor/`
- `scripts/deploy-valkyrix-recorder.sh`
- `scripts/init-soar-devnet.mjs`
- `README.md`
- `.env.example`

## Не включать в публичный demo repo

- `.agent/`
- `.claude/`
- `.codex/`
- `.gemini/`
- `.planning/`
- `backups/`
- `dist/`
- `node_modules/`
- `prefinal.zip`
- `prefinal.tar.gz`
- `promoi.md`
- `docs/`
- `editor/`
- `src/debug/`
- `.env`
- `.env.local`
- `.env.*.local`

## Примечания

- Полную версию проекта лучше держать в приватном репозитории.
- В отдельный публичный репозиторий публикуй только подмножество, готовое для демо.
- Не коммить секреты, приватные ключи, wallet keypair-файлы и персональные API-токены.
