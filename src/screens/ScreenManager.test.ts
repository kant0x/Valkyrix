import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ScreenManager', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('navigates to wallet screen on init', async () => {
    const { ScreenManager } = await import('./ScreenManager');
    const mockWallet = { mount: vi.fn(), unmount: vi.fn() };
    const mockMenu = { mount: vi.fn(), unmount: vi.fn() };
    const mockGame = { mount: vi.fn(), unmount: vi.fn() };
    const mgr = new ScreenManager(container, { wallet: mockWallet, menu: mockMenu, game: mockGame });
    mgr.navigateTo('wallet');
    expect(mockWallet.mount).toHaveBeenCalledWith(container);
    expect(mockMenu.mount).not.toHaveBeenCalled();
  });

  it('unmounts previous screen before mounting next', async () => {
    const { ScreenManager } = await import('./ScreenManager');
    const mockWallet = { mount: vi.fn(), unmount: vi.fn() };
    const mockMenu = { mount: vi.fn(), unmount: vi.fn() };
    const mockGame = { mount: vi.fn(), unmount: vi.fn() };
    const mgr = new ScreenManager(container, { wallet: mockWallet, menu: mockMenu, game: mockGame });
    mgr.navigateTo('wallet');
    mgr.navigateTo('menu');
    expect(mockWallet.unmount).toHaveBeenCalled();
    expect(mockMenu.mount).toHaveBeenCalledWith(container);
  });

  it('does not reload the page on screen transition', async () => {
    const { ScreenManager } = await import('./ScreenManager');
    // jsdom does not allow vi.spyOn on window.location.reload directly;
    // redefine it as configurable so we can spy on it.
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });
    const mockWallet = { mount: vi.fn(), unmount: vi.fn() };
    const mockMenu = { mount: vi.fn(), unmount: vi.fn() };
    const mockGame = { mount: vi.fn(), unmount: vi.fn() };
    const mgr = new ScreenManager(container, { wallet: mockWallet, menu: mockMenu, game: mockGame });
    mgr.navigateTo('wallet');
    mgr.navigateTo('menu');
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
