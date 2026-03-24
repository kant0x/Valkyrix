import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NegotiationOverlay } from './NegotiationOverlay';

// Helper: build a mock fetch that returns the given outcome text
function makeFetchMock(outcomeText: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        candidates: [
          { content: { parts: [{ text: outcomeText }] } },
        ],
      }),
  });
}

describe('NegotiationOverlay', () => {
  let overlay: NegotiationOverlay;
  let onSuccess: ReturnType<typeof vi.fn>;
  let onFailure: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    overlay = new NegotiationOverlay();
    onSuccess = vi.fn();
    onFailure = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // ─── 1. Mount: DOM structure ───────────────────────────────────────────────

  it('mount renders scale bar and attempts counter', () => {
    overlay.mount(document.body, { onSuccess, onFailure });

    // Overlay root
    expect(document.getElementById('vk-neg-overlay')).not.toBeNull();

    // Scale bar fill element
    expect(document.getElementById('vk-neg-scale-fill')).not.toBeNull();

    // Attempts counter shows initial value
    const attemptsEl = document.getElementById('vk-neg-attempts');
    expect(attemptsEl).not.toBeNull();
    expect(attemptsEl?.textContent).toContain('3');
  });

  // ─── 2. Good outcome: scale += 4 ──────────────────────────────────────────

  it('good outcome: scale increases by 4', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock('Ты посмел...\n{"outcome":"good"}'),
    );

    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'Я предлагаю золото';

    sendBtn.click();
    await vi.runAllTicks();

    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toContain('4');
    expect(labelEl?.textContent).toContain('12');
  });

  // ─── 3. Neutral outcome: scale += 2, attemptsLeft += 2 ───────────────────

  it('neutral outcome: scale increases by 2 and attemptsLeft increases by 2', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock('Интересно...\n{"outcome":"neutral"}'),
    );

    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'Может договоримся?';

    sendBtn.click();
    await vi.runAllTicks();

    // scale 0+2=2
    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toContain('2');

    // attempts 3+2=5
    const attemptsEl = document.getElementById('vk-neg-attempts');
    expect(attemptsEl?.textContent).toContain('5');
  });

  // ─── 4. Bad outcome: attemptsLeft -= 1, scale unchanged ──────────────────

  it('bad outcome: attemptsLeft decreases by 1, scale unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock('Молчи, смертный!\n{"outcome":"bad"}'),
    );

    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'Ты проиграешь!';

    sendBtn.click();
    await vi.runAllTicks();

    // scale stays 0
    const labelEl = document.getElementById('vk-neg-scale-label');
    expect(labelEl?.textContent).toContain('0');
    expect(labelEl?.textContent).toContain('12');

    // attempts 3-1=2
    const attemptsEl = document.getElementById('vk-neg-attempts');
    expect(attemptsEl?.textContent).toContain('2');
  });

  // ─── 5. Success terminal: scale >= 12 calls onSuccess after 2800ms ────────

  it('success terminal: scale >= 12 calls onSuccess after 2800ms delay', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock('Хорошо...\n{"outcome":"good"}'),
    );

    overlay.mount(document.body, { onSuccess, onFailure, initialScale: 8 });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'Мы заключим союз';

    sendBtn.click();
    await vi.runAllTicks(); // resolve fetch promises

    // Should NOT have called onSuccess yet (waiting for 2800ms)
    expect(onSuccess).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2800);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();

    // Overlay should be removed
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });

  // ─── 6. Failure terminal: attemptsLeft = 0 calls onFailure ───────────────

  it('failure terminal: attemptsLeft = 0 calls onFailure after 2800ms delay', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock('Ничтожество!\n{"outcome":"bad"}'),
    );

    // 1 attempt left, scale < 12
    overlay.mount(document.body, {
      onSuccess,
      onFailure,
      initialAttempts: 1,
      initialScale: 0,
    });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'Ты проиграешь!';

    sendBtn.click();
    await vi.runAllTicks();

    expect(onFailure).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2800);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();

    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });

  // ─── 7. Pending guard ─────────────────────────────────────────────────────

  it('pending guard prevents double-submit', async () => {
    const fetchMock = makeFetchMock('Ты посмел...\n{"outcome":"good"}');
    vi.stubGlobal('fetch', fetchMock);

    overlay.mount(document.body, { onSuccess, onFailure });

    const input = document.querySelector<HTMLInputElement>('input')!;
    const sendBtn = document.querySelector<HTMLButtonElement>('button')!;
    input.value = 'Тест';

    // First click — starts pending
    sendBtn.click();

    // Second click while still pending — should be ignored
    sendBtn.click();

    await vi.runAllTicks();

    // fetch should have been called only once
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ─── 8. Unmount removes overlay ──────────────────────────────────────────

  it('unmount removes overlay from DOM', () => {
    overlay.mount(document.body, { onSuccess, onFailure });
    expect(document.getElementById('vk-neg-overlay')).not.toBeNull();

    overlay.unmount();
    expect(document.getElementById('vk-neg-overlay')).toBeNull();
  });
});
