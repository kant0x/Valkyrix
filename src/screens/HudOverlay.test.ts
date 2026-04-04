import { beforeEach, describe, expect, it } from 'vitest';

describe('HudOverlay', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('mounts command controls', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();

    hud.mount(container);

    expect(container.querySelector('#vk-hud-health')).not.toBeNull();
    expect(container.querySelector('#vk-hud-oracle-resource')).not.toBeNull();
    expect(container.querySelector('#vk-hud-build-attack')).not.toBeNull();
    expect(container.querySelector('#vk-hud-build-buff')).not.toBeNull();
    expect(container.querySelector('#vk-hud-build-sell')).not.toBeNull();
    expect(container.querySelector('#vk-hud-unit-a')).not.toBeNull();
    expect(container.querySelector('#vk-hud-unit-b')).not.toBeNull();
    expect(container.querySelector('#vk-support-overdrive')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('#vk-hud-unit-b')?.disabled).toBe(false);
  });

  it('marks selected build action through data-selected', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();
    hud.mount(container);

    hud.setBuildSelection('attack');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-attack')?.dataset.selected).toBe('true');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-buff')?.dataset.selected).toBe('false');

    hud.setBuildSelection('buff');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-attack')?.dataset.selected).toBe('false');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-buff')?.dataset.selected).toBe('true');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-sell')?.dataset.selected).toBe('false');

    hud.setBuildSelection('sell');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-attack')?.dataset.selected).toBe('false');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-buff')?.dataset.selected).toBe('false');
    expect(container.querySelector<HTMLElement>('#vk-hud-build-sell')?.dataset.selected).toBe('true');
  });

  it('updates availability state for build actions', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();
    hud.mount(container);

    hud.setActionAvailability({ attack: false, buff: false, sell: false });

    expect(container.querySelector<HTMLButtonElement>('#vk-hud-build-attack')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('#vk-hud-build-buff')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('#vk-hud-build-sell')?.disabled).toBe(true);
  });

  it('writes citadel health values into the lower panel', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();
    hud.mount(container);

    hud.update({ wave: 2, health: 450, citadelMaxHp: 500, resources: 120 });

    expect(container.querySelector('#vk-hud-health')?.textContent).toBe('450 / 500');
    expect(container.querySelector('#vk-hud-wave')?.textContent).toBe('2');
    expect(container.querySelector('#vk-hud-resources')?.textContent).toBe('E 120');
  });

  it('renders crystal values in the lower deck', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();
    hud.mount(container);

    hud.update({ crystals: 14 });

    expect(container.textContent).toContain('C 14');
  });

  it('renders the exact command message', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();
    hud.mount(container);

    hud.setCommandMessage('Action unavailable - not enough resources or invalid placement.');

    expect(container.querySelector('#vk-hud-command-message')?.textContent).toBe(
      'Action unavailable - not enough resources or invalid placement.',
    );
  });

  it('keeps oracle briefing informative instead of duplicating the command message', async () => {
    const { HudOverlay } = await import('./HudOverlay');
    const hud = new HudOverlay();
    hud.mount(container);

    hud.update({ resources: 120, crystals: 14, enemiesAlive: 3, enemiesQueued: 2, alliesAlive: 5, towerCount: 4 });
    hud.setBuildSelection('attack');
    hud.setCommandMessage('Attack Tower selected. Now click a highlighted build tile on the map.');

    expect(container.querySelector('#vk-hud-command-message')?.textContent).toBe(
      'Attack Tower selected. Now click a highlighted build tile on the map.',
    );
    expect(container.querySelector('#vk-hud-focus-label')?.textContent).toContain('Attack Tower armed');
    expect(container.querySelector('#vk-hud-focus-label')?.textContent).not.toBe(
      'Attack Tower selected. Now click a highlighted build tile on the map.',
    );
    expect(container.querySelector('#vk-hud-oracle-resource')?.textContent).toContain('Orbital reserve: S 0.');
  });
});
