import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SessionLayer', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

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

  it('isConnected is false before connect() is called', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const layer = new SessionLayer();
    expect(layer.isConnected).toBe(false);
  });

  it('isConnected is true after successful connect()', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const getSlot = vi.fn(async () => 1);
    const layer = new SessionLayer(async () => ({ getSlot }));

    await layer.connect();

    expect(layer.isConnected).toBe(true);
  });

  it('isConnected remains false when connect() throws ChainUnavailableError', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const layer = new SessionLayer(async () => ({
      getSlot: vi.fn(async () => {
        throw new Error('offline');
      }),
    }));

    await expect(layer.connect()).rejects.toThrow();
    expect(layer.isConnected).toBe(false);
  });

  it('connect warms up the router through getSlot', async () => {
    const { SessionLayer } = await import('./SessionLayer');
    const getSlot = vi.fn(async () => 1);
    const layer = new SessionLayer(async () => ({ getSlot }));

    await layer.connect();

    expect(getSlot).toHaveBeenCalledTimes(1);
  });

  it('connect throws ChainUnavailableError when getSlot rejects', async () => {
    const { SessionLayer, ChainUnavailableError } = await import('./SessionLayer');
    const layer = new SessionLayer(async () => ({
      getSlot: vi.fn(async () => {
        throw new Error('offline');
      }),
    }));

    await expect(layer.connect()).rejects.toBeInstanceOf(ChainUnavailableError);
  });

  it('connect throws ChainUnavailableError when getSlot hangs too long', async () => {
    vi.useFakeTimers();
    const { SessionLayer, ChainUnavailableError } = await import('./SessionLayer');
    const layer = new SessionLayer(async () => ({
      getSlot: vi.fn(() => new Promise<number>(() => undefined)),
    }));

    const pending = expect(layer.connect()).rejects.toBeInstanceOf(ChainUnavailableError);
    await vi.advanceTimersByTimeAsync(5000);

    await pending;
  });
});
