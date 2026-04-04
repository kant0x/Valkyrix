import type { ScreenModule, ScreenManager } from './ScreenManager';
import { requestBattleSessionMode } from '../blockchain/BattleSessionState';
import { getCurrentState, disconnectWallet } from '../wallet/WalletService';
import { getLanguage, setLanguage, t } from '../i18n/localization';
import bgImage from '../assets/valkyrix-menu-bg.jpg';

const STYLE_ID = 'vk-main-menu-02-1-style';
type SessionConnectLike = { connect(): Promise<void> };

export class ValkyrixMainMenuScreen implements ScreenModule {
  private el: HTMLElement | null = null;
  private animationFrameId: number = 0;

  constructor(
    private readonly manager: ScreenManager,
    private readonly session: SessionConnectLike | null = null,
  ) { }

  mount(container: HTMLElement): void {
    this.ensureStyle();

    const el = document.createElement('div');
    el.id = 'vk-main-menu-v2';
    container.appendChild(el);
    this.el = el;
    this.render();
    this.initCanvas(el);
  }

  unmount(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.el?.remove();
    this.el = null;
  }

  private render(): void {
    if (!this.el) return;
    const wallet = getCurrentState();
    const walletName = wallet.walletType ? wallet.walletType[0].toUpperCase() + wallet.walletType.slice(1) : t('common.disconnected');
    const walletKey = wallet.publicKey ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}` : t('common.noSignature');
    const language = getLanguage();
    this.el.innerHTML = `
      <div id="menu-root">
        <canvas class="vk-bg-canvas"></canvas>
        <div class="vk-bg-overlay"></div>

        <div id="v-menu-center">
          <div class="vk-language-switch" aria-label="${t('common.language')}">
            <button id="btn-lang-en" class="vk-lang-btn ${language === 'en' ? 'is-active' : ''}" type="button">${t('common.english')}</button>
            <button id="btn-lang-ru" class="vk-lang-btn ${language === 'ru' ? 'is-active' : ''}" type="button">${t('common.russian')}</button>
          </div>
          <div id="logo-wrap">
            <h1 id="logo">VALKYRIX</h1>
            <div id="tagline">${t('menu.tagline')}</div>
          </div>

          <div class="vk-chips-row">
            <div class="vk-chip">${t('menu.chipHold')}</div>
            <div class="vk-chip">${t('menu.chipBreak')}</div>
            <div class="vk-chip warning">${t('menu.chipPush')}</div>
          </div>

          <div class="vk-menu-actions">
            <button id="btn-play" class="vk-play-btn">
              <span>${t('menu.play')}</span>
            </button>
            <div class="vk-secondary-row">
              <button id="btn-leaderboard" class="vk-sec-btn">${t('menu.leaderboard')}</button>
              <button id="btn-stats" class="vk-sec-btn">${t('menu.stats')}</button>
            </div>
          </div>
          <p id="vk-menu-status-v2" class="vk-menu-status" style="display:none"></p>

        </div>

        <div class="vk-bottom-panels">
          <div class="vk-panel">
            <div class="vk-panel-hdr">— WALLET IDENTITY —</div>
            <div class="vk-panel-body">
              <div class="vk-wallet-name">${walletName}</div>
              <div class="vk-wallet-addr">${walletKey}</div>
              <button id="btn-disconnect" class="vk-disconnect-btn">Disconnect</button>
            </div>
          </div>
          
          <div class="vk-panel">
            <div class="vk-panel-hdr">— RUNE SPINE —</div>
            <div class="rune-row top-runes vk-panel-body">
              <span>ᚠ</span><span class="active">ᚢ</span><span>ᚱ</span><span>ᛉ</span>
            </div>
          </div>

          <div class="vk-panel">
            <div class="vk-panel-hdr">— VOID RIFT ACTIVITY —</div>
            <div class="vk-panel-body">
              <div class="vk-threat-bars">
                <div class="vk-threat-bar" style="--h:55%;--delay:0s"></div>
                <div class="vk-threat-bar" style="--h:80%;--delay:0.3s"></div>
                <div class="vk-threat-bar" style="--h:40%;--delay:0.6s"></div>
                <div class="vk-threat-bar" style="--h:90%;--delay:0.1s"></div>
                <div class="vk-threat-bar" style="--h:65%;--delay:0.8s"></div>
                <div class="vk-threat-bar" style="--h:35%;--delay:0.4s"></div>
                <div class="vk-threat-bar" style="--h:75%;--delay:0.9s"></div>
                <div class="vk-threat-bar" style="--h:50%;--delay:0.2s"></div>
              </div>
              <div class="vk-threat-label">PORTALS STIRRING</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const panelHeaders = this.el.querySelectorAll<HTMLElement>('.vk-panel-hdr');
    if (panelHeaders[0]) panelHeaders[0].textContent = `- ${t('menu.walletIdentity')} -`;
    if (panelHeaders[1]) panelHeaders[1].textContent = `- ${t('menu.runeSpine')} -`;
    if (panelHeaders[2]) panelHeaders[2].textContent = `- ${t('menu.voidRift')} -`;
    const disconnectBtn = this.el.querySelector<HTMLButtonElement>('#btn-disconnect');
    if (disconnectBtn) disconnectBtn.textContent = t('menu.disconnect');
    const threatLabel = this.el.querySelector<HTMLElement>('.vk-threat-label');
    if (threatLabel) threatLabel.textContent = t('menu.portals');
    this.bindButtons(this.el);
  }

  private initCanvas(el: HTMLElement): void {
    const canvas = el.querySelector('.vk-bg-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Fast render
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    const img = new Image();
    // Import handles the actual served path through Vite
    img.src = bgImage;

    img.onload = () => console.log('✅ Valkyrix Background active');
    img.onerror = () => console.error('❌ Background asset not found:', bgImage);

    // 1. Pre-generate patterned noise for that living static feel
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 120;
    noiseCanvas.height = 120;
    const nCtx = noiseCanvas.getContext('2d');
    if (nCtx) {
      const idata = nCtx.createImageData(120, 120);
      for (let i = 0; i < idata.data.length; i += 4) {
        const val = Math.random() * 255;
        idata.data[i] = val * 0.1;   // R
        idata.data[i + 1] = val * 0.4; // G
        idata.data[i + 2] = val * 0.9; // B (icy tone)
        idata.data[i + 3] = Math.random() * 22 + 8; // Opacity layer
      }
      nCtx.putImageData(idata, 0, 0);
    }

    let time = 0;
    let localGlitches: { y: number, h: number, xOff: number, timer: number, type: 'shift' | 'rgb' }[] = [];

    const render = () => {
      time += 0.05;

      // Always clear to cold base first
      ctx.fillStyle = '#010308';
      ctx.fillRect(0, 0, w, h);

      // Base Image Render
      let iw = w, ih = h, ix = 0, iy = 0;
      const isLoaded = img.complete && img.width > 0;
      if (isLoaded) {
        const scale = Math.max(w / img.width, h / img.height);
        iw = img.width * scale;
        ih = img.height * scale;
        ix = (w - iw) / 2;
        iy = (h - ih) / 2;
        ctx.drawImage(img, ix, iy, iw, ih);
      }

      // 2. Glitch logic (even works on black background for cool silhouettes)
      if (Math.random() > 0.96) {
        localGlitches.push({
          y: Math.random() * h,
          h: 5 + Math.random() * 40,
          xOff: (Math.random() - 0.5) * 60,
          timer: 3 + Math.random() * 5,
          type: Math.random() > 0.7 ? 'rgb' : 'shift'
        });
      }

      localGlitches.forEach(g => g.timer--);
      localGlitches = localGlitches.filter(g => g.timer > 0);

      localGlitches.forEach(g => {
        if (isLoaded) {
          const scale = iw / img.width;
          const sy = (g.y - iy) / scale;
          const sh = g.h / scale;
          if (sy >= 0 && sy + sh <= img.height) {
            if (g.type === 'rgb') {
              ctx.globalCompositeOperation = 'screen';
              ctx.drawImage(img, 0, sy, img.width, sh, ix - 6, g.y, iw, g.h);
              ctx.fillStyle = 'rgba(0, 180, 255, 0.1)';
              ctx.fillRect(0, g.y, w, g.h);
              ctx.globalCompositeOperation = 'source-over';
            } else {
              ctx.drawImage(img, 0, sy, img.width, sh, ix + g.xOff, g.y, iw, g.h);
            }
          }
        } else {
          // Fallback glitch: just highlight areas of noise/static
          ctx.fillStyle = 'rgba(20, 50, 100, 0.2)';
          ctx.fillRect(0, g.y, w, g.h);
        }
      });

      // 3. Cyber-Noise / Machine static blocks
      if (Math.random() > 0.98) {
        ctx.fillStyle = 'rgba(100, 180, 255, 0.05)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 200, 2);
      }

      // 4. Radar Scanlines
      ctx.fillStyle = 'rgba(0, 15, 30, 0.15)';
      for (let y = (time * 10) % 8; y < h; y += 8) {
        ctx.fillRect(0, y, w, 1);
      }

      // 5. Living Particle Noise (Grain)
      if (nCtx) {
        ctx.globalCompositeOperation = 'screen';
        const pat = ctx.createPattern(noiseCanvas, 'repeat');
        if (pat) {
          ctx.fillStyle = pat;
          ctx.save();
          ctx.translate(Math.floor(Math.random() * 120), Math.floor(Math.random() * 120));
          ctx.fillRect(-120, -120, w + 120, h + 120);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      requestAnimationFrame(render);
    };

    render();
  }

  private bindButtons(el: HTMLElement): void {
    el.querySelector<HTMLButtonElement>('#btn-lang-en')?.addEventListener('click', () => {
      setLanguage('en');
      this.render();
      if (this.el) this.initCanvas(this.el);
    });
    el.querySelector<HTMLButtonElement>('#btn-lang-ru')?.addEventListener('click', () => {
      setLanguage('ru');
      this.render();
      if (this.el) this.initCanvas(this.el);
    });
    const playBtn = el.querySelector<HTMLButtonElement>('#btn-play');
    const leaderboardBtn = el.querySelector<HTMLButtonElement>('#btn-leaderboard');
    const statsBtn = el.querySelector<HTMLButtonElement>('#btn-stats');
    const statusEl = el.querySelector<HTMLElement>('#vk-menu-status-v2');

    playBtn?.addEventListener('click', () => {
      void (async () => {
        try {
          if (statusEl) {
            statusEl.textContent = t('menu.statusConnect');
            statusEl.style.display = 'block';
          }
          const wallet = getCurrentState();
          if (!wallet.connected || !wallet.publicKey) {
            throw new Error(t('game.connectWalletFirst'));
          }
          const mode = requestBattleSessionMode();
          if (mode === 'cheap-tx') {
            if (this.session) {
              await this.session.connect();
            } else {
              const { SessionLayer } = await import('../session/SessionLayer');
              await new SessionLayer().connect();
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'ChainUnavailableError') {
            if (statusEl) {
              statusEl.textContent = err.message;
              statusEl.style.display = 'block';
            }
            return;
          }
          if (statusEl) {
            statusEl.textContent = err instanceof Error ? err.message : t('menu.statusConnectFailed');
            statusEl.style.display = 'block';
          }
          console.warn('[SessionLayer] connect failed:', err instanceof Error ? err.message : err);
          return;
        }
        this.manager.navigateTo('game');
      })();
    });

    leaderboardBtn?.addEventListener('click', () => {
      void (async () => {
        if (!leaderboardBtn) return;
        leaderboardBtn.disabled = true;
        leaderboardBtn.textContent = t('menu.loading');
        if (statusEl) {
          statusEl.textContent = t('menu.statusLeaderboard');
          statusEl.style.display = 'block';
        }
        try {
          const { publicKey } = getCurrentState();
          const [{ LeaderboardService }, { LeaderboardOverlay }] = await Promise.all([
            import('../blockchain/LeaderboardService'),
            import('./LeaderboardOverlay'),
          ]);
          const overlay = new LeaderboardOverlay();
          overlay.setCurrentWallet(publicKey);
          const entries = publicKey
            ? await new LeaderboardService().fetchLeaderboard(publicKey)
            : [];
          overlay.show(entries);
          if (statusEl) statusEl.style.display = 'none';
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error instanceof Error ? error.message : t('menu.statusLeaderboardFailed');
            statusEl.style.display = 'block';
          }
        } finally {
          leaderboardBtn.disabled = false;
          leaderboardBtn.textContent = t('menu.leaderboard');
        }
      })();
    });

    statsBtn?.addEventListener('click', () => {
      if (!statusEl) return;
      statusEl.textContent = t('menu.statusStatsSoon');
      statusEl.style.display = 'block';
    });

    const disconnectBtn = el.querySelector<HTMLButtonElement>('#btn-disconnect');
    disconnectBtn?.addEventListener('click', async () => {
      if (disconnectBtn) disconnectBtn.disabled = true;
      await disconnectWallet();
      this.manager.navigateTo('wallet');
    });
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800;900&family=Inter:wght@400;500;600;700&display=swap');
      
      * { box-sizing: border-box; }

      #vk-main-menu-v2 {
        position: fixed; inset: 0; z-index: 10;
        font-family: 'Inter', sans-serif;
      }

      #menu-root {
        width: 100vw; height: 100vh; position: relative; overflow: hidden; background: #010308;
        display: flex; flex-direction: column; align-items: center; justify-content: space-between;
      }

      .vk-bg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
      .vk-bg-overlay {
        position: absolute; inset: 0; z-index: 1; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, transparent 10%, rgba(2, 4, 8, 0.4) 100%),
                    linear-gradient(180deg, rgba(2, 4, 8, 0.2) 0%, rgba(2, 4, 8, 0.6) 100%);
      }
      .vk-language-switch {
        display:flex; gap:8px; align-self:flex-end;
        background:rgba(5,12,22,.62); border:1px solid rgba(80,140,200,.28);
        padding:6px; border-radius:999px; backdrop-filter:blur(5px);
      }
      .vk-lang-btn {
        border:0; border-radius:999px; padding:8px 12px; cursor:pointer;
        background:transparent; color:#9ac2e6; font-size:10px; font-weight:700;
        letter-spacing:.16em; text-transform:uppercase;
      }
      .vk-lang-btn.is-active {
        background:linear-gradient(180deg,#184474,#0b1f38);
        color:#fff; box-shadow:0 0 0 1px rgba(90,165,255,.45) inset;
      }

      #v-menu-center {
        position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center;
        gap: 20px; margin-top: 8vh; padding: 20px;
        min-width: 600px;
      }

      .diamond-icon {
        margin-bottom: 0px;
        filter: drop-shadow(0 0 10px rgba(42, 96, 144, 0.8));
      }

      #logo-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
      #logo-sub { font-size: 11px; font-weight: 700; letter-spacing: 4px; color: #4a9eff; text-transform: uppercase; }
      #logo {
        font-family: 'Cinzel', serif; font-size: 80px; font-weight: 900; letter-spacing: 12px; color: #c8d8e8; text-transform: uppercase; line-height: 1;
        text-shadow: 0 0 20px rgba(60,120,200,0.4), 0 0 60px rgba(30,80,160,0.2), 0 2px 4px rgba(0,0,0,0.8);
        animation: logo-glow 4s ease-in-out infinite;
        margin: 0; padding-left: 12px;
      }
      
      @keyframes logo-glow {
        0%, 100% { text-shadow: 0 0 20px rgba(60,120,200,0.3), 0 0 60px rgba(30,80,160,0.15); color: #b8ccd8; }
        50% { text-shadow: 0 0 30px rgba(80,150,220,0.5), 0 0 80px rgba(40,100,180,0.3), 0 0 120px rgba(20,60,140,0.15); color: #eaf4fc; }
      }

      #tagline { font-size: 14px; letter-spacing: 0.5px; color: #bedaf3; line-height: 1.6; margin-top: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); max-width: 600px;}

      .vk-chips-row { display: flex; gap: 12px; margin-top: 10px; }
      .vk-chip { padding: 6px 16px; border-radius: 20px; background: rgba(5, 12, 22, 0.8); border: 1px solid rgba(40, 80, 120, 0.4); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #709bc0; box-shadow: 0 4px 6px rgba(0,0,0,0.4); }
      .vk-chip.warning { color: #f0c05a; border-color: rgba(240, 192, 90, 0.3); }

      .vk-menu-actions { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 10px; width: 100%; max-width: 440px; }
      .vk-play-btn {
        width: 100%; position: relative; background: linear-gradient(180deg, #184474, #0b1f38); border: 2px solid #5aa5ff; border-radius: 8px; padding: 22px; cursor: pointer; transition: transform 0.2s, border-color 0.2s; box-shadow: 0 10px 30px rgba(20, 90, 180, 0.4), inset 0 2px 5px rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
      }
      .vk-play-btn:hover { transform: scale(1.02); border-color: #8ed2ff; box-shadow: 0 15px 40px rgba(30, 120, 255, 0.6), inset 0 2px 10px rgba(255,255,255,0.4); }
      .vk-play-btn > span { font-family: 'Cinzel', serif; font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.8); }
      
      .vk-secondary-row { display: flex; gap: 16px; width: 100%; }
      .vk-sec-btn {
        flex: 1; background: rgba(15, 30, 50, 0.6); border: 1px solid rgba(80, 140, 200, 0.3); border-radius: 6px; padding: 14px; color: #9ac2e6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(5px);
      }
      .vk-sec-btn:hover { background: rgba(30, 60, 90, 0.8); color: #fff; border-color: rgba(100, 180, 255, 0.6); }

      /* Bottom Panels */
      .vk-bottom-panels {
        position: relative; z-index: 2; width: 100%; max-width: 1100px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 60px; padding: 0 20px;
      }
      .vk-panel {
        background: rgba(4, 10, 18, 0.7); border: 1px solid rgba(40, 80, 120, 0.4); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; backdrop-filter: blur(4px); box-shadow: inset 0 0 20px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.6);
      }
      .vk-panel-hdr { font-size: 10px; font-weight: 700; color: #4a9eff; letter-spacing: 3px; margin-bottom: 20px; text-transform: uppercase; }
      
      .vk-wallet-name { font-weight: 700; color: #eaf4fc; font-size: 18px; margin-bottom: 4px; }
      .vk-wallet-addr { font-family: monospace; color: #6a9ac0; font-size: 12px; margin-bottom: 14px; }
      .vk-disconnect-btn {
        background: transparent; border: 1px solid rgba(180,60,60,0.35); border-radius: 4px;
        color: rgba(200,100,100,0.7); font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.15em; padding: 6px 16px;
        cursor: pointer; transition: all 0.2s;
      }
      .vk-disconnect-btn:hover { background: rgba(120,30,30,0.3); border-color: rgba(220,80,80,0.6); color: #e08080; }
      .vk-disconnect-btn:disabled { opacity: 0.4; cursor: wait; }

      .rune-row { display: flex; gap: 24px; color: #2a4060; font-size: 32px; letter-spacing: 4px; }
      .rune-row span { animation: rune-pulse 3s ease-in-out infinite; }
      .rune-row span.active { color: #aadcff; animation: none; text-shadow: 0 0 10px #4aaeff, 0 0 20px #4aaeff; }
      @keyframes rune-pulse {
        0%, 100% { color: #1a3050; text-shadow: none; }
        50% { color: #4488aa; text-shadow: 0 0 8px rgba(40,120,180,0.6); }
      }

      .vk-threat-bars {
        display: flex; align-items: flex-end; gap: 5px; height: 40px; margin-bottom: 10px;
      }
      .vk-threat-bar {
        flex: 1; height: var(--h); border-radius: 2px 2px 0 0;
        background: linear-gradient(180deg, rgba(80,160,255,0.8), rgba(40,80,180,0.4));
        animation: threatPulse 1.8s ease-in-out var(--delay) infinite;
      }
      @keyframes threatPulse {
        0%, 100% { opacity: 0.4; transform: scaleY(0.7); }
        50%       { opacity: 1;   transform: scaleY(1); }
      }
      .vk-threat-label {
        font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
        color: rgba(100,160,220,0.6); text-transform: uppercase;
      }

      .vk-menu-status { font-size: 11px; margin-top:10px; color: #b0e0ff; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }

    `;
    document.head.appendChild(style);
  }
}

