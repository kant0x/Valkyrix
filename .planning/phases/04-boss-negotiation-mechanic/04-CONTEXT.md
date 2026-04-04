---
name: Phase 4 Boss Negotiation Context
description: Locked design decisions for boss-robot + Gemini AI negotiation mechanic
type: project
---

# Phase 4: Boss — Negotiation Mechanic — Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Source:** Direct user discussion

---

<domain>
## Phase Boundary

Большой босс-робот появляется через 5 минут от старта игры. Все юниты на поле замирают. Открывается окно переговоров: игрок пишет свободный текст, пытаясь убедить босса не забирать Священный Грааль. Gemini AI отвечает в образе босса и оценивает каждый ответ. Система шкалы убеждения и попыток определяет исход — договорились или огромная орда.

</domain>

<decisions>
## Implementation Decisions

### Босс — триггер появления
- Босс появляется ровно через **5 минут (300 секунд)** от старта игры (`state.elapsed >= 300`)
- НЕ через волны — отдельный таймер в GameState
- При появлении: phase → 'negotiation', все юниты замирают (UnitSystem guard)

### Босс — характеристики
- Большой робот: высокий HP (~500), поддержка союзников, лечение, высокий урон
- Спрайт: отдельный (большой), пока можно использовать увеличенный boits как placeholder
- Роль: 'boss', faction: 'enemy'

### Переговоры — система попыток и шкалы
- **Шкала успеха**: 0 → 12 (визуальная полоска в UI)
- **Старт**: 3 попытки
- **Хороший ответ** (Gemini: good): +4 к шкале
- **Нейтральный ответ** (Gemini: neutral): +2 к шкале, +2 бонусных попытки
- **Плохой ответ** (Gemini: bad): +0 к шкале, попытка сгорает
- Шкала ≥ 12 → **успех**
- Попытки = 0 и шкала < 12 → **провал**

### Gemini AI интеграция
- Модель: `gemini-2.0-flash`
- Ключ: через `import.meta.env.VITE_GEMINI_KEY` (.env.local)
- Системный промпт: Пожиратель Миров, древний босс-робот, величественный, угрожающий
- Нарратив: игрок убеждает босса не забирать Священный Грааль, чтобы люди могли существовать
- Gemini возвращает: ответ босса (1-2 предложения) + JSON `{"outcome":"good"|"neutral"|"bad"}`
- Три оценки вместо двух: good / neutral / bad

### Исходы
- **Успех**: босс уходит с поля, начисляются очки (Phase 5 blockchain), game → 'playing'
- **Провал**: огромная орда сильных врагов (heavy + ranged, НЕ light), boss остаётся на поле enraged

### UI диалога
- Полноэкранный overlay поверх body
- Показывает: портрет/имя босса, его реплику, шкалу успеха, счётчик попыток, текстовый ввод
- Тёмная тема, стиль как у существующих оверлеев

### Claude's Discretion
- Точный внешний вид шкалы (цвет, анимация заполнения)
- Точный состав орды провала
- Анимация появления/исчезновения оверлея
- Точный системный промпт для Gemini

</decisions>

<specifics>
## Specific Requirements

- Gemini API уже настроен: `.env.local` с `VITE_GEMINI_KEY`
- NegotiationOverlay.ts уже существует (старая версия с 2 кнопками) — нужно переписать
- BossSystem.ts уже существует — нужно переписать (триггер по таймеру вместо волны)
- game.types.ts уже имеет 'negotiation' в phase union и BossNegotiationState — можно расширить
- UnitSystem boss-freeze guard уже есть в UnitSystemRuntime.ts
- Blockchain запись очков — Phase 5, в этой фазе только готовим хук/колбэк

</specifics>

<deferred>
## Deferred

- Blockchain транзакция при успехе — Phase 5
- Настоящий спрайт босса-робота — можно добавить позже
- Звуковые эффекты переговоров

</deferred>

---
*Phase: 04-boss-negotiation-mechanic*
*Context gathered: 2026-03-23 via direct user discussion*
