import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NegotiationOverlay } from './NegotiationOverlay';
import { getResponse } from '../game/BossDialog';

// Helper: submit a message and advance past the 600ms thinking delay
function submit(input: HTMLInputElement, sendBtn: HTMLButtonElement, text: string) {
  input.value = text;
  sendBtn.click();
  vi.advanceTimersByTime(600); // thinking delay → reply + UI update
}

describe('BossDialog classification', () => {
  it('1 word → bad', () => {
    expect(getResponse('нет').outcome).toBe('bad');
  });

  it('2-4 words → neutral', () => {
    expect(getResponse('мир или война').outcome).toBe('neutral');
  });

  it('5+ words → good', () => {
    expect(getResponse('мы защищаем данные всего человечества').outcome).toBe('good');
  });

  it('returns a non-empty reply string', () => {
    const { reply } = getResponse('Аполлон — последняя надежда людей');
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(10);
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

  it('mount renders scale bar, attempts counter, and boss opening line', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    expect(document.getElementById('vk-neg-overlay')).not.toBeNull();
    expect(document.getElementById('vk-neg-scale-fill')).not.toBeNull();

    const attemptsEl = document.getElementById('vk-neg-attempts');
    expect(attemptsEl?.textContent).toContain('3');

    // Opening line is rendered (non-empty boss reply)
    const replyEl = document.getElementById('vk-neg-reply');
    expect(replyEl?.textContent?.length).toBeGreaterThan(5);
  });

  // ─── 2. Good outcome (5+ words → scale +4) ───────────────────────────────

  it('good outcome: 5+ word reply increases scale by 4', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;

    // 5 words → good
    submit(input, sendBtn, 'мы защищаем данные всего человечества');

    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toContain('4');
    expect(labelEl?.textContent).toContain('12');
  });

  // ─── 3. Neutral outcome (2-4 words → scale +2, attempts +2) ──────────────

  it('neutral outcome: 2-4 word reply increases scale by 2 and attempts by 2', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;

    // 3 words → neutral
    submit(input, sendBtn, 'мир или война');

    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toContain('2');

    // attempts 3+2=5
    const attemptsEl = document.getElementById('vk-neg-attempts');
    expect(attemptsEl?.textContent).toContain('5');
  });

  // ─── 4. Bad outcome (1 word → attempts -1, scale 0) ──────────────────────

  it('bad outcome: 1 word reply decreases attempts by 1, scale unchanged', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;

    // 1 word → bad
    submit(input, sendBtn, 'нет');

    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toContain('0');
    expect(labelEl?.textContent).toContain('12');

    // attempts 3-1=2
    const attemptsEl = document.getElementById('vk-neg-attempts');
    expect(attemptsEl?.textContent).toContain('2');
  });

  // ─── 5. Success terminal: scale >= 12 calls onSuccess ────────────────────

  it('success terminal: scale >= 12 calls onSuccess after delay', () => {
    // Start at 8 so one good reply (5+ words, +4) reaches 12
    overlay.mount(document.body, { onSuccess, onFailure, initialScale: 8 });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;

    submit(input, sendBtn, 'мы защищаем данные всего человечества');

    // onSuccess not called yet (waiting for 2000ms read delay)
    expect(onSuccess).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });

  // ─── 6. Failure terminal: attempts = 0 calls onFailure ───────────────────

  it('failure terminal: attempts = 0 calls onFailure after delay', () => {
    // 1 attempt, 1 word → bad → attempts = 0
    overlay.mount(document.body, {
      onSuccess,
      onFailure,
      initialAttempts: 1,
      initialScale: 0,
    });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;

    submit(input, sendBtn, 'нет');

    expect(onFailure).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });

  // ─── 7. Pending guard ─────────────────────────────────────────────────────

  it('pending guard: double-click processes only once', () => {
    overlay.mount(document.body, { onSuccess, onFailure, initialScale: 8 });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'мы защищаем данные всего человечества';

    // Two clicks before thinking delay expires
    sendBtn.click();
    sendBtn.click();

    vi.advanceTimersByTime(600);

    // Scale should be 8+4=12, not 8+8=16
    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toBe('12 / 12');
  });

  // ─── 8. Unmount ───────────────────────────────────────────────────────────

  it('unmount removes overlay from DOM', () => {
    overlay.mount(document.body, { onSuccess, onFailure });
    expect(document.getElementById('vk-neg-overlay')).not.toBeNull();

    overlay.unmount();
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });
});
