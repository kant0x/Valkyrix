import { describe, it, expect, beforeEach } from 'vitest';

describe('WalletSplashScreen', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('mounts without throwing', async () => {
    const { WalletSplashScreen } = await import('./WalletSplashScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new WalletSplashScreen(mockManager);
    expect(() => screen.mount(container)).not.toThrow();
  });

  it('renders a Connect Phantom button', async () => {
    const { WalletSplashScreen } = await import('./WalletSplashScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new WalletSplashScreen(mockManager);
    screen.mount(container);
    expect(container.innerHTML.toLowerCase()).toContain('phantom');
  });

  it('renders a Connect Backpack button', async () => {
    const { WalletSplashScreen } = await import('./WalletSplashScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new WalletSplashScreen(mockManager);
    screen.mount(container);
    expect(container.innerHTML.toLowerCase()).toContain('backpack');
  });

  it('cleans up DOM on unmount', async () => {
    const { WalletSplashScreen } = await import('./WalletSplashScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new WalletSplashScreen(mockManager);
    screen.mount(container);
    screen.unmount();
    expect(container.innerHTML).toBe('');
  });
});
