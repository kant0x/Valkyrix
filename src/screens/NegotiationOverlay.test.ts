import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NegotiationOverlay } from './NegotiationOverlay';

describe('NegotiationOverlay', () => {
  let overlay: NegotiationOverlay;
  let container: HTMLElement;

  beforeEach(() => {
    overlay = new NegotiationOverlay();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up any mounted overlay
    document.getElementById('vk-negotiation-overlay')?.remove();
    document.getElementById('vk-neg-style')?.remove();
    container.remove();
  });

  it('mount creates a DOM element with id vk-negotiation-overlay in document.body', () => {
    overlay.mount(container, { onSuccess: vi.fn(), onFailure: vi.fn() });
    const el = document.getElementById('vk-negotiation-overlay');
    expect(el).not.toBeNull();
    expect(document.body.contains(el)).toBe(true);
  });

  it('mount renders exactly two choice buttons: "Offer tribute" and "Defy it"', () => {
    overlay.mount(container, { onSuccess: vi.fn(), onFailure: vi.fn() });
    const offerBtn = document.getElementById('vk-neg-offer');
    const defyBtn = document.getElementById('vk-neg-defy');
    expect(offerBtn).not.toBeNull();
    expect(defyBtn).not.toBeNull();
    expect(offerBtn?.textContent?.trim()).toBe('Offer tribute');
    expect(defyBtn?.textContent?.trim()).toBe('Defy it');
  });

  it('clicking "Offer tribute" calls onSuccess callback', () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    overlay.mount(container, { onSuccess, onFailure });
    const offerBtn = document.getElementById('vk-neg-offer') as HTMLButtonElement;
    offerBtn.click();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('clicking "Offer tribute" unmounts the overlay', () => {
    overlay.mount(container, { onSuccess: vi.fn(), onFailure: vi.fn() });
    const offerBtn = document.getElementById('vk-neg-offer') as HTMLButtonElement;
    offerBtn.click();
    expect(document.getElementById('vk-negotiation-overlay')).toBeNull();
  });

  it('clicking "Defy it" calls onFailure callback', () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    overlay.mount(container, { onSuccess, onFailure });
    const defyBtn = document.getElementById('vk-neg-defy') as HTMLButtonElement;
    defyBtn.click();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('clicking "Defy it" unmounts the overlay', () => {
    overlay.mount(container, { onSuccess: vi.fn(), onFailure: vi.fn() });
    const defyBtn = document.getElementById('vk-neg-defy') as HTMLButtonElement;
    defyBtn.click();
    expect(document.getElementById('vk-negotiation-overlay')).toBeNull();
  });

  it('unmount() removes the DOM element', () => {
    overlay.mount(container, { onSuccess: vi.fn(), onFailure: vi.fn() });
    expect(document.getElementById('vk-negotiation-overlay')).not.toBeNull();
    overlay.unmount();
    expect(document.getElementById('vk-negotiation-overlay')).toBeNull();
  });

  it('calling mount() twice does not create duplicate overlays', () => {
    const cbs = { onSuccess: vi.fn(), onFailure: vi.fn() };
    overlay.mount(container, cbs);
    overlay.mount(container, cbs);
    const all = document.querySelectorAll('#vk-negotiation-overlay');
    expect(all.length).toBe(1);
  });
});
