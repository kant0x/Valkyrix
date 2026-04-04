import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NegotiationOverlay } from './NegotiationOverlay';
import { getPhase, SUCCESS_THRESHOLD } from '../game/BossDialog';

/** Find a choice button by its exact text label. */
function btn(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.vk-neg-choice'))
    .find(b => b.textContent === text);
}

describe('BossDialog tree', () => {
  it('Phase 1 has 3 choices', () => {
    expect(getPhase(1)!.choices).toHaveLength(3);
  });

  it('Phase 2 (history) is reachable via "Кто ты?" → nextPhase === 2', () => {
    const p1 = getPhase(1)!;
    const choice = p1.choices.find(c => c.text.startsWith('Кто ты'));
    expect(choice?.nextPhase).toBe(2);
  });

  it('Phase 3 has 5 choices', () => {
    expect(getPhase(3)!.choices).toHaveLength(5);
  });

  it('Phase 4 final choices all have nextPhase === -1', () => {
    getPhase(4)!.choices.forEach(c => expect(c.nextPhase).toBe(-1));
  });

  it('SUCCESS_THRESHOLD is 80', () => {
    expect(SUCCESS_THRESHOLD).toBe(80);
  });

  it('best path (1→2→3→4) totals >= 80 points', () => {
    const best =
      15 +  // "Кто ты?" Phase 1
      30 +  // "Охота на невинных" Phase 2
      35 +  // "Свобода выбора" Phase 3
      20;   // "Присоединись" Phase 4
    expect(best).toBeGreaterThanOrEqual(SUCCESS_THRESHOLD);
  });
});

describe('NegotiationOverlay', () => {
  let overlay: NegotiationOverlay;
  let onSuccess: () => void;
  let onFailure: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    overlay = new NegotiationOverlay();
    onSuccess = vi.fn() as () => void;
    onFailure = vi.fn() as () => void;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  // ─── 1. Mount ─────────────────────────────────────────────────────────────

  it('mount renders overlay with Phase 1 boss text and 3 choice buttons', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    expect(document.getElementById('vk-neg-overlay')).not.toBeNull();

    const textEl = document.getElementById('vk-neg-boss-text');
    expect(textEl?.textContent).toContain('Код Предков');

    expect(document.querySelectorAll('.vk-neg-choice')).toHaveLength(3);
  });

  // ─── 2. "Кто ты?" → Phase 2 ──────────────────────────────────────────────

  it('"Кто ты?" advances to Phase 2 — shows history text', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    btn('Кто ты? Почему ты охотишься за Кодом Предков?')?.click();
    vi.advanceTimersByTime(1500);

    const textEl = document.getElementById('vk-neg-boss-text');
    expect(textEl?.textContent).toContain('старого мира');
    expect(textEl?.textContent).toContain('Пустоту');
  });

  // ─── 3. "Никогда!" → Phase 3 ─────────────────────────────────────────────

  it('"Никогда!" skips Phase 2, goes directly to Phase 3 debate', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    btn('Никогда! Цитадель устоит!')?.click();
    vi.advanceTimersByTime(1500);

    const textEl = document.getElementById('vk-neg-boss-text');
    expect(textEl?.textContent).toContain('мольбы');
  });

  // ─── 4. Persuasion bar updates ────────────────────────────────────────────

  it('persuasion label updates immediately after choice click', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    btn('Кто ты? Почему ты охотишься за Кодом Предков?')?.click();

    const label = document.getElementById('vk-neg-persuasion-label');
    expect(label?.textContent).toContain('15');
  });

  // ─── 5. Buttons disabled after click ─────────────────────────────────────

  it('all choice buttons are disabled immediately after a click', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    btn('Мы готовы к бою, Ночной Охотник!')?.click();

    document.querySelectorAll<HTMLButtonElement>('.vk-neg-choice').forEach(b => {
      expect(b.disabled).toBe(true);
    });
  });

  // ─── 6. Success path ──────────────────────────────────────────────────────

  it('success path: best choices (1→2→3→4) call onSuccess', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    // Phase 1 (+15) → Phase 2
    btn('Кто ты? Почему ты охотишься за Кодом Предков?')?.click();
    vi.advanceTimersByTime(1500);

    // Phase 2 (+30) → Phase 3
    btn('Охота на невинных — не честь охотника.')?.click();
    vi.advanceTimersByTime(1500);

    // Phase 3 (+35) → Phase 4
    btn('Потому что свобода выбора важнее совершенства.')?.click();
    vi.advanceTimersByTime(1500);

    // Phase 4 (+20) → outcome screen (1500ms) → close (2500ms)
    btn('Присоединись к нам. Помоги защитить Цитадель.')?.click();
    vi.advanceTimersByTime(1500 + 2500);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });

  // ─── 7. Failure path ──────────────────────────────────────────────────────

  it('failure path: aggressive choices call onFailure', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    // Phase 1 (clamped to 0) → Phase 3
    btn('Никогда! Цитадель устоит!')?.click();
    vi.advanceTimersByTime(1500);

    // Phase 3 (clamped to 0) → Phase 4
    btn('Код Предков — не твой. Никогда не был твоим.')?.click();
    vi.advanceTimersByTime(1500);

    // Phase 4 (+5) → outcome screen (1500ms) → close (2500ms), total=5 < 80
    btn('Ты должен ответить за свои действия.')?.click();
    vi.advanceTimersByTime(1500 + 2500);

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // ─── 8. Duplicate mount prevention ───────────────────────────────────────

  it('second mount is ignored when overlay already exists', () => {
    overlay.mount(document.body, { onSuccess, onFailure });
    overlay.mount(document.body, { onSuccess, onFailure });

    expect(document.querySelectorAll('#vk-neg-overlay')).toHaveLength(1);
  });

  // ─── 9. Unmount ───────────────────────────────────────────────────────────

  it('unmount removes overlay from DOM', () => {
    overlay.mount(document.body, { onSuccess, onFailure });
    overlay.unmount();
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });
});
