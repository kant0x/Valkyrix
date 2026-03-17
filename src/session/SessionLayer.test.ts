import { describe, it, expect } from 'vitest';

describe('SessionLayer', () => {
  it('exposes connect(), getConnection(), and sendKill() methods', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const layer = new SessionLayer();
    expect(typeof layer.connect).toBe('function');
    expect(typeof layer.getConnection).toBe('function');
    expect(typeof layer.sendKill).toBe('function');
  });

  it('getConnection() throws before connect() is called', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const layer = new SessionLayer();
    expect(() => layer.getConnection()).toThrow();
  });

  it('sendKill() throws with "not implemented" until Phase 3', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const layer = new SessionLayer();
    await expect(layer.sendKill('unit-1')).rejects.toThrow(/not implemented/i);
  });
});
