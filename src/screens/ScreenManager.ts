// src/screens/ScreenManager.ts
// State machine screen router. Locked design from CONTEXT.md.
// Each screen is a TS module implementing ScreenModule.
// navigateTo() unmounts old screen and mounts new one — no page reload.

export type Screen = 'wallet' | 'menu' | 'game';

export interface ScreenModule {
  mount(container: HTMLElement): void;
  unmount(): void;
}

export class ScreenManager {
  private current: Screen | null = null;
  private readonly modules: Record<Screen, ScreenModule>;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, modules: Record<Screen, ScreenModule>) {
    this.container = container;
    this.modules = modules;
  }

  navigateTo(screen: Screen): void {
    if (this.current === screen) return;
    if (this.current !== null) {
      this.modules[this.current].unmount();
    }
    this.current = screen;
    this.modules[screen].mount(this.container);
  }

  currentScreen(): Screen | null {
    return this.current;
  }
}
