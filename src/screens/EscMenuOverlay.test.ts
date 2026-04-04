import type { ScreenManager } from './ScreenManager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('EscMenuOverlay', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('toggles visibility with Escape', async () => {
    const { EscMenuOverlay } = await import('./EscMenuOverlay');
    const manager = { navigateTo: vi.fn() } as unknown as ScreenManager;
    const overlay = new EscMenuOverlay(manager);
    overlay.mount(container);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(container.querySelector<HTMLElement>('#vk-esc-overlay')?.style.display).toBe('flex');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(container.querySelector<HTMLElement>('#vk-esc-overlay')?.style.display).toBe('none');
  });

  it('closes when Return to Battle is clicked', async () => {
    const { EscMenuOverlay } = await import('./EscMenuOverlay');
    const manager = { navigateTo: vi.fn() } as unknown as ScreenManager;
    const overlay = new EscMenuOverlay(manager);
    overlay.mount(container);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    container.querySelector<HTMLButtonElement>('#btn-resume-battle')?.click();

    expect(container.querySelector<HTMLElement>('#vk-esc-overlay')?.style.display).toBe('none');
  });

  it('reveals destructive confirmation copy for exit', async () => {
    const { EscMenuOverlay } = await import('./EscMenuOverlay');
    const manager = { navigateTo: vi.fn() } as unknown as ScreenManager;
    const overlay = new EscMenuOverlay(manager);
    overlay.mount(container);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    container.querySelector<HTMLButtonElement>('#btn-exit-menu')?.click();

    expect(container.textContent).toContain('Progress from this battle will be lost. Leave the field?');
  });

  it('navigates to menu only after confirmed exit', async () => {
    const { EscMenuOverlay } = await import('./EscMenuOverlay');
    const manager = { navigateTo: vi.fn() } as unknown as ScreenManager;
    const overlay = new EscMenuOverlay(manager);
    overlay.mount(container);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    container.querySelector<HTMLButtonElement>('#btn-exit-menu')?.click();
    container.querySelector<HTMLButtonElement>('#btn-confirm-exit')?.click();

    expect(manager.navigateTo).toHaveBeenCalledWith('menu');
  });

  it('does not expose build labels inside the ESC overlay', async () => {
    const { EscMenuOverlay } = await import('./EscMenuOverlay');
    const manager = { navigateTo: vi.fn() } as unknown as ScreenManager;
    const overlay = new EscMenuOverlay(manager);
    overlay.mount(container);

    expect(container.textContent).not.toContain('Attack Tower');
    expect(container.textContent).not.toContain('Buff Tower');
  });
});
