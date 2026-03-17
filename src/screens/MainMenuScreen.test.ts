import { describe, it, expect, beforeEach } from 'vitest';

describe('MainMenuScreen', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('mounts without throwing', async () => {
    const { MainMenuScreen } = await import('./MainMenuScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new MainMenuScreen(mockManager);
    expect(() => screen.mount(container)).not.toThrow();
  });

  it('renders a Play button', async () => {
    const { MainMenuScreen } = await import('./MainMenuScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new MainMenuScreen(mockManager);
    screen.mount(container);
    const text = container.innerHTML.toLowerCase();
    expect(text).toMatch(/play|играть/);
  });

  it('renders a Leaderboard button', async () => {
    const { MainMenuScreen } = await import('./MainMenuScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new MainMenuScreen(mockManager);
    screen.mount(container);
    const text = container.innerHTML.toLowerCase();
    expect(text).toMatch(/leaderboard|лидерборд/);
  });

  it('cleans up DOM on unmount', async () => {
    const { MainMenuScreen } = await import('./MainMenuScreen');
    const mockManager = { navigateTo: () => {} } as never;
    const screen = new MainMenuScreen(mockManager);
    screen.mount(container);
    screen.unmount();
    expect(container.innerHTML).toBe('');
  });
});
