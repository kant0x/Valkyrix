import type { ScreenModule, ScreenManager } from './ScreenManager';
import { connectWallet } from '../wallet/WalletService';
import { t } from '../i18n/localization';

const STYLE_ID = 'vk-wallet-splash-03-style';

export class ValkyrixWalletSplashScreen implements ScreenModule {
  private el: HTMLElement | null = null;

  constructor(private readonly manager: ScreenManager) {}

  mount(container: HTMLElement): void {
    this.ensureStyle();
    const el = document.createElement('div');
    el.id = 'vk-wallet-root';
    el.innerHTML = this.buildHTML();
    container.appendChild(el);
    this.el = el;
    this.spawnEmbers(el);
    this.bindButtons(el);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  private spawnEmbers(el: HTMLElement): void {
    const layer = el.querySelector('.vk-embers') as HTMLElement;
    if (!layer) return;
    for (let i = 0; i < 28; i++) {
      const e = document.createElement('div');
      e.className = 'vk-ember';
      e.style.left = Math.random() * 100 + '%';
      e.style.bottom = '-6px';
      e.style.animationDelay = (Math.random() * 8) + 's';
      e.style.animationDuration = (10 + Math.random() * 12) + 's';
      const sz = 1 + Math.random() * 2.5;
      e.style.width = sz + 'px';
      e.style.height = sz + 'px';
      layer.appendChild(e);
    }
  }

  private buildHTML(): string {
    return `
      <div class="vk-embers"></div>
      <div class="vk-fog"></div>

      <div class="vk-frame">
        <div class="vk-frame-corner tl"></div>
        <div class="vk-frame-corner tr"></div>
        <div class="vk-frame-corner bl"></div>
        <div class="vk-frame-corner br"></div>
        <div class="vk-frame-rune r1">ᚠ</div>
        <div class="vk-frame-rune r2">ᚢ</div>
        <div class="vk-frame-rune r3">ᚦ</div>
        <div class="vk-frame-rune r4">ᚨ</div>
      </div>

      <div class="vk-panel">
        <div class="vk-emblem">
          <svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg">
            <polygon points="40,4 72,22 72,58 40,86 8,58 8,22" fill="none" stroke="rgba(160,200,255,0.25)" stroke-width="1"/>
            <polygon points="40,12 64,26 64,56 40,78 16,56 16,26" fill="none" stroke="rgba(120,180,255,0.18)" stroke-width="0.8"/>
            <line x1="40" y1="4" x2="40" y2="86" stroke="rgba(120,180,255,0.15)" stroke-width="0.8"/>
            <line x1="8" y1="22" x2="72" y2="58" stroke="rgba(120,180,255,0.15)" stroke-width="0.8"/>
            <line x1="72" y1="22" x2="8" y2="58" stroke="rgba(120,180,255,0.15)" stroke-width="0.8"/>
            <circle cx="40" cy="45" r="8" fill="none" stroke="rgba(140,210,255,0.5)" stroke-width="1.2"/>
            <circle cx="40" cy="45" r="3" fill="rgba(140,210,255,0.6)"/>
          </svg>
        </div>

        <p class="vk-eyebrow">${t('wallet.eyebrow')}</p>
        <h1 class="vk-title">VALKYRIX</h1>
        <div class="vk-divider"><span></span><span class="vk-div-rune">ᛉ</span><span></span></div>
        <p class="vk-lore">${t('wallet.lore')}</p>

        <div class="vk-oath-grid">
          <div class="vk-oath-stone">
            <div class="vk-stone-glow glow-phantom"></div>
            <div class="vk-stone-icon">
              <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                <polygon points="18,3 30,10 30,26 18,33 6,26 6,10" fill="none" stroke="rgba(160,120,255,0.7)" stroke-width="1.4"/>
                <circle cx="18" cy="18" r="5" fill="rgba(150,110,255,0.5)" stroke="rgba(180,140,255,0.8)" stroke-width="1"/>
              </svg>
            </div>
            <p class="vk-stone-label">${t('wallet.primaryRune')}</p>
            <h2 class="vk-stone-name">Phantom</h2>
            <p class="vk-stone-desc">${t('wallet.phantomDesc')}</p>
            <button id="btn-phantom" class="vk-oath-btn phantom">${t('wallet.bindPhantom')}</button>
          </div>

          <div class="vk-oath-stone">
            <div class="vk-stone-glow glow-backpack"></div>
            <div class="vk-stone-icon">
              <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="6" width="20" height="24" rx="3" fill="none" stroke="rgba(220,120,80,0.7)" stroke-width="1.4"/>
                <rect x="13" y="3" width="10" height="5" rx="2" fill="none" stroke="rgba(220,120,80,0.6)" stroke-width="1.2"/>
                <line x1="18" y1="13" x2="18" y2="23" stroke="rgba(220,140,100,0.6)" stroke-width="1"/>
                <line x1="13" y1="18" x2="23" y2="18" stroke="rgba(220,140,100,0.6)" stroke-width="1"/>
              </svg>
            </div>
            <p class="vk-stone-label">${t('wallet.fieldPack')}</p>
            <h2 class="vk-stone-name">Backpack</h2>
            <p class="vk-stone-desc">${t('wallet.backpackDesc')}</p>
            <button id="btn-backpack" class="vk-oath-btn backpack">${t('wallet.bindBackpack')}</button>
          </div>
        </div>

        <p id="vk-wallet-error" class="vk-error" style="display:none"></p>

        <p class="vk-footnote">${t('wallet.footnote')}</p>
      </div>
    `;
  }

  private bindButtons(el: HTMLElement): void {
    const phantomBtn = el.querySelector<HTMLButtonElement>('#btn-phantom');
    const backpackBtn = el.querySelector<HTMLButtonElement>('#btn-backpack');
    const errorEl = el.querySelector<HTMLElement>('#vk-wallet-error');

    const labels: Record<string, string> = { phantom: t('wallet.bindPhantom'), backpack: t('wallet.bindBackpack') };

    const handleConnect = async (type: 'phantom' | 'backpack', btn: HTMLButtonElement) => {
      btn.disabled = true;
      btn.textContent = t('wallet.binding');
      try {
        await connectWallet(type);
        this.manager.navigateTo('menu');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = labels[type];
        if (errorEl) {
          errorEl.textContent = err instanceof Error ? err.message : t('wallet.failed');
          errorEl.style.display = 'block';
        }
      }
    };

    phantomBtn?.addEventListener('click', () => handleConnect('phantom', phantomBtn));
    backpackBtn?.addEventListener('click', () => handleConnect('backpack', backpackBtn));
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Inter:wght@400;500;600&display=swap');

      #vk-wallet-root {
        position: fixed; inset: 0; z-index: 10;
        display: grid; place-items: center; padding: 24px;
        background:
          radial-gradient(ellipse 70% 50% at 50% -10%, rgba(30,60,90,0.5) 0%, transparent 60%),
          radial-gradient(ellipse 100% 60% at 50% 110%, rgba(10,20,40,0.8) 0%, transparent 60%),
          #05080e;
        font-family: 'Inter', sans-serif;
        color: #c8dff0;
        overflow: hidden;
      }

      /* Embers */
      .vk-embers {
        position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden;
      }
      .vk-ember {
        position: absolute;
        background: rgba(180, 120, 60, 0.7);
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(200, 140, 60, 0.5);
        animation: emberRise linear infinite;
      }
      @keyframes emberRise {
        0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
        10%  { opacity: 0.6; }
        80%  { opacity: 0.3; }
        100% { transform: translateY(-80vh) translateX(calc(40px * var(--drift, 1))) scale(0.3); opacity: 0; }
      }

      /* Fog layer */
      .vk-fog {
        position: absolute; inset: 0; pointer-events: none; z-index: 2;
        background: radial-gradient(ellipse 120% 40% at 50% 100%, rgba(15,30,50,0.6), transparent 60%);
      }

      /* Carved corner frame */
      .vk-frame {
        position: absolute; inset: 20px; pointer-events: none; z-index: 3;
      }
      .vk-frame-corner {
        position: absolute; width: 48px; height: 48px;
      }
      .vk-frame-corner::before,
      .vk-frame-corner::after {
        content: ''; position: absolute; background: rgba(100,160,220,0.35);
      }
      .vk-frame-corner::before { width: 100%; height: 2px; top: 0; left: 0; }
      .vk-frame-corner::after  { width: 2px; height: 100%; top: 0; left: 0; }
      .vk-frame-corner.tr { top: 0; right: 0; transform: scaleX(-1); }
      .vk-frame-corner.bl { bottom: 0; left: 0; transform: scaleY(-1); }
      .vk-frame-corner.br { bottom: 0; right: 0; transform: scale(-1); }
      .vk-frame-corner.tl { top: 0; left: 0; }

      .vk-frame-rune {
        position: absolute; font-size: 1.1rem; color: rgba(100,160,220,0.3);
        letter-spacing: 0; line-height: 1;
      }
      .vk-frame-rune.r1 { top: 10px; left: 60px; }
      .vk-frame-rune.r2 { top: 10px; right: 60px; }
      .vk-frame-rune.r3 { bottom: 10px; left: 60px; }
      .vk-frame-rune.r4 { bottom: 10px; right: 60px; }

      /* Main panel */
      .vk-panel {
        position: relative; z-index: 10;
        width: min(860px, 100%);
        background:
          linear-gradient(175deg, rgba(12,22,36,0.97) 0%, rgba(6,12,22,0.99) 100%);
        border: 1px solid rgba(80,130,190,0.22);
        border-radius: 4px;
        padding: 48px 44px 40px;
        box-shadow:
          0 0 0 1px rgba(40,80,120,0.15),
          0 40px 100px rgba(0,0,0,0.85),
          inset 0 1px 0 rgba(100,160,220,0.08);
        display: flex; flex-direction: column; align-items: center; text-align: center;
      }

      /* Emblem */
      .vk-emblem {
        width: 72px; height: 80px; margin-bottom: 24px;
        filter: drop-shadow(0 0 12px rgba(100,160,255,0.3));
      }
      .vk-emblem svg { width: 100%; height: 100%; }

      /* Eyebrow */
      .vk-eyebrow {
        font-size: 0.72rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.28em;
        color: rgba(100,160,220,0.7); margin: 0 0 14px;
      }

      /* Title */
      .vk-title {
        font-family: 'Cinzel', serif; font-size: clamp(2.8rem, 5vw, 4.8rem);
        font-weight: 800; margin: 0 0 20px; line-height: 1; letter-spacing: 0.18em;
        color: #ddeeff;
        text-shadow:
          0 0 30px rgba(100,180,255,0.2),
          0 2px 4px rgba(0,0,0,0.8);
      }

      /* Divider */
      .vk-divider {
        display: flex; align-items: center; gap: 16px;
        width: 100%; max-width: 400px; margin-bottom: 22px;
      }
      .vk-divider span:not(.vk-div-rune) {
        flex: 1; height: 1px; background: rgba(80,130,190,0.3);
      }
      .vk-div-rune {
        color: rgba(100,160,220,0.5); font-size: 1rem; line-height: 1;
      }

      /* Lore */
      .vk-lore {
        max-width: 520px; color: rgba(180,210,235,0.7);
        font-size: 0.95rem; line-height: 1.7; margin: 0 0 36px;
      }

      /* Oath grid */
      .vk-oath-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        width: 100%; margin-bottom: 24px;
      }

      .vk-oath-stone {
        position: relative; overflow: hidden;
        padding: 28px 22px 26px;
        background: rgba(8,16,28,0.75);
        border: 1px solid rgba(70,120,180,0.2);
        border-top-color: rgba(80,140,200,0.3);
        border-radius: 3px;
        display: flex; flex-direction: column; align-items: center;
        box-shadow: inset 0 1px 0 rgba(80,140,200,0.08), 0 8px 24px rgba(0,0,0,0.4);
        transition: border-color 0.25s;
      }
      .vk-oath-stone:hover {
        border-color: rgba(100,160,220,0.35);
        border-top-color: rgba(120,180,240,0.5);
      }

      .vk-stone-glow {
        position: absolute; inset: 0; z-index: 0; pointer-events: none;
        opacity: 0.12;
      }
      .glow-phantom { background: radial-gradient(ellipse 80% 60% at 50% 0%, #9a70ff, transparent 70%); }
      .glow-backpack { background: radial-gradient(ellipse 80% 60% at 50% 0%, #d97040, transparent 70%); }

      .vk-stone-icon {
        position: relative; z-index: 2;
        width: 44px; height: 44px; margin-bottom: 14px;
      }
      .vk-stone-icon svg { width: 100%; height: 100%; }

      .vk-stone-label {
        position: relative; z-index: 2;
        font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.2em; color: rgba(120,170,210,0.6); margin: 0 0 6px;
      }

      .vk-stone-name {
        position: relative; z-index: 2;
        font-family: 'Cinzel', serif; font-size: 1.55rem; font-weight: 700;
        color: #d4e8ff; margin: 0 0 10px;
        text-shadow: 0 0 12px rgba(100,160,255,0.15);
      }

      .vk-stone-desc {
        position: relative; z-index: 2;
        font-size: 0.85rem; color: rgba(140,180,215,0.65);
        line-height: 1.5; margin: 0 0 22px;
      }

      /* Buttons */
      .vk-oath-btn {
        position: relative; z-index: 2;
        width: 100%; padding: 14px 20px;
        border: none; border-radius: 2px;
        font-family: 'Inter', sans-serif; font-size: 0.82rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.14em; color: #fff;
        cursor: pointer; transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        min-height: 48px;
      }
      .vk-oath-btn:disabled { opacity: 0.5; cursor: wait; }
      .vk-oath-btn:not(:disabled):hover { transform: translateY(-1px); }
      .vk-oath-btn:not(:disabled):active { transform: translateY(0); }

      .vk-oath-btn.phantom {
        background: linear-gradient(160deg, #6b45d4 0%, #4a2fa8 100%);
        box-shadow: 0 4px 18px rgba(80,50,180,0.35), inset 0 1px 0 rgba(160,130,255,0.2);
      }
      .vk-oath-btn.phantom:not(:disabled):hover {
        box-shadow: 0 6px 24px rgba(90,60,200,0.55), inset 0 1px 0 rgba(160,130,255,0.25);
      }

      .vk-oath-btn.backpack {
        background: linear-gradient(160deg, #c05030 0%, #8a2a10 100%);
        box-shadow: 0 4px 18px rgba(160,60,30,0.35), inset 0 1px 0 rgba(240,160,120,0.15);
      }
      .vk-oath-btn.backpack:not(:disabled):hover {
        box-shadow: 0 6px 24px rgba(180,70,40,0.55), inset 0 1px 0 rgba(240,160,120,0.2);
      }

      /* Error */
      .vk-error {
        color: #d96060; font-size: 0.88rem; font-weight: 600;
        margin: 0 0 16px; padding: 10px 16px;
        background: rgba(100,20,20,0.3); border: 1px solid rgba(180,60,60,0.3);
        border-radius: 2px; width: 100%;
      }

      /* Footnote */
      .vk-footnote {
        font-size: 0.78rem; color: rgba(100,150,190,0.45);
        line-height: 1.6; max-width: 480px; margin: 0;
      }

      @media (max-width: 760px) {
        .vk-oath-grid { grid-template-columns: 1fr; }
        .vk-panel { padding: 32px 20px 28px; }
        .vk-frame-rune { display: none; }
      }
    `;
    document.head.appendChild(style);
  }
}
