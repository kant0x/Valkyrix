/**
 * HudOverlay — Full Game HUD (Canvas-rendered)
 * All slots are drawn from day 1. Unavailable features show as LOCKED.
 * Activation: flip a flag when backend system is ready.
 */

const STYLE_ID = 'vk-hud-style';
const OVERLAY_ID = 'vk-win-loss-overlay';
const CITADEL_ICON_SRC = '/assets/build/citadel/citadel.png';
const ATTACK_ICON_SRC = '/assets/build/port/port.png';
const BUFF_ICON_SRC = '/assets/build/citadel/citadel.png';
const ENERGY_ICON_SRC = '/assets/pers/collector/resource collection/split/collect_06.png';
const LIGHT_UNIT_ICON_SRC = '/assets/pers/viking/rotations/south.png';
const COLLECTOR_UNIT_ICON_SRC = '/assets/pers/collector/direction/south.png';
const HEAVY_UNIT_ICON_SRC = '/assets/pers/viking/rotations/east.png';
const RANGED_UNIT_ICON_SRC = '/assets/pers/viking/rotations/north.png';

type BuildAction = 'attack' | 'buff';
type CommandCallbacks = {
  attack?: () => void;
  buff?: () => void;
  stagedUnitA?: () => void;
  stagedUnitB?: () => void;
  stagedUnitC?: () => void;
  stagedUnitD?: () => void;
};

export interface HudState {
  wave?: number | string;
  health?: number | string;
  citadelMaxHp?: number;
  resources?: number | string;
  won?: boolean;
  armedAction?: BuildAction | null;
  message?: string;
  canAffordAttack?: boolean;
  canAffordBuff?: boolean;
  // Extended fields (activate when ready)
  waveTimer?: number;
  enemiesAlive?: number;
  enemiesQueued?: number;
  alliesAlive?: number;
  crystals?: number;
  towerCount?: number;
  alert?: string;
  enemiesKilled?: number;
  totalDamage?: number;
}

interface RS {
  wave: string; hp: number; maxHp: number; resources: number;
  armedAction: BuildAction | null; message: string;
  attackAvail: boolean; buffAvail: boolean;
  t: number; hpSmooth: number;
  // Extended
  waveTimer: number; enemiesAlive: number; enemiesQueued: number;
  alliesAlive: number; crystals: number; towerCount: number;
  alert: string; alertTimer: number;
  enemiesKilled: number; totalDamage: number;
}

function mkImg(src: string) { const i = new Image(); i.src = src; return i; }

// ── Color palette (our cold blue) ──
const C = {
  accent:     '#4a9ed0',
  accentL:    '#8cc8f0',
  accentD:    '#2a6090',
  text:       '#c0ddf0',
  textDim:    '#4a7090',
  textMid:    '#7aadcc',
  bg1:        '#0c1828',
  bg2:        '#060e1a',
  bg3:        '#040a14',
  border:     'rgba(40,100,200,0.35)',
  borderL:    'rgba(74,174,255,0.5)',
  glow:       'rgba(74,174,255,0.08)',
  locked:     'rgba(74,174,255,0.12)',
  lockedText: '#2a4a6a',
  red:        '#ff5a5a',
  green:      '#5aff8a',
  yellow:     '#ffd84a',
};

export class HudOverlay {
  private el: HTMLElement | null = null;
  private cvs: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private cbs: CommandCallbacks = {};
  private resizeObs: ResizeObserver | null = null;

  private imgs = {
    citadel: mkImg(CITADEL_ICON_SRC), attack: mkImg(ATTACK_ICON_SRC),
    buff: mkImg(BUFF_ICON_SRC), energy: mkImg(ENERGY_ICON_SRC),
    unitA: mkImg(LIGHT_UNIT_ICON_SRC), unitB: mkImg(COLLECTOR_UNIT_ICON_SRC),
    unitC: mkImg(HEAVY_UNIT_ICON_SRC), unitD: mkImg(RANGED_UNIT_ICON_SRC),
  };

  private s: RS = {
    wave: '—', hp: 100, maxHp: 100, resources: 0,
    armedAction: null, message: 'Select a tower, then click a tile.',
    attackAvail: true, buffAvail: true, t: 0, hpSmooth: 1,
    waveTimer: 0, enemiesAlive: 0, enemiesQueued: 0,
    alliesAlive: 0, crystals: -1, towerCount: 0,
    alert: '', alertTimer: 0, enemiesKilled: 0, totalDamage: 0,
  };

  // Feature flags — flip to true when backend is ready
  private features = {
    crystals: false,      // 💎 second resource
    berserk: false,       // unit C
    guard: false,         // unit D
    towerUpgrade: false,  // tower levels
    abilities: false,     // active abilities
    minimap: false,       // minimap canvas
    stats: false,         // kill/damage counters
  };

  // ── Public API ──

  mount(container: HTMLElement): void {
    this.ensureStyle();
    const el = document.createElement('div');
    el.id = 'vk-hud';
    container.appendChild(el);
    this.el = el;

    const cvs = document.createElement('canvas');
    cvs.id = 'vk-hud-canvas';
    el.appendChild(cvs);
    this.cvs = cvs;
    this.ctx = cvs.getContext('2d');

    const hit = document.createElement('div');
    hit.id = 'vk-hud-hit';
    hit.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    el.appendChild(hit);
    const btnStyle = 'position:absolute;background:transparent;border:none;cursor:pointer;pointer-events:all;padding:0;margin:0;outline:none;appearance:none;-webkit-appearance:none;opacity:0;';
    hit.innerHTML = `
      <button id="vk-hud-build-attack" class="vk-hit" type="button" style="${btnStyle}"></button>
      <button id="vk-hud-build-buff"   class="vk-hit" type="button" style="${btnStyle}"></button>
      <button id="vk-hud-unit-a" class="vk-hit" type="button" style="${btnStyle}"></button>
      <button id="vk-hud-unit-b" class="vk-hit" type="button" style="${btnStyle}opacity:0;pointer-events:none;" disabled></button>
      <button id="vk-hud-unit-c" class="vk-hit" type="button" style="${btnStyle}opacity:0;pointer-events:none;" disabled></button>
      <button id="vk-hud-unit-d" class="vk-hit" type="button" style="${btnStyle}opacity:0;pointer-events:none;" disabled></button>
    `;
    this.bindEv(el);
    this.resizeObs = new ResizeObserver(() => this.syncSize());
    this.resizeObs.observe(el);
    this.syncSize();
    this.startLoop();
  }

  unmount(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    this.el?.remove(); this.el = null; this.cvs = null; this.ctx = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }

  setCommandCallbacks(c: CommandCallbacks): void { this.cbs = { ...c }; }
  setBuildSelection(s: BuildAction | null): void { this.s.armedAction = s; }
  setCommandMessage(m: string): void { this.s.message = m; }

  setActionAvailability(a: { attack: boolean; buff: boolean }): void {
    this.s.attackAvail = a.attack; this.s.buffAvail = a.buff;
    const ab = this.el?.querySelector<HTMLButtonElement>('#vk-hud-build-attack');
    const bb = this.el?.querySelector<HTMLButtonElement>('#vk-hud-build-buff');
    if (ab) ab.disabled = !a.attack; if (bb) bb.disabled = !a.buff;
  }

  update(state: HudState): void {
    if (state.wave !== undefined) this.s.wave = `Wave ${state.wave}`;
    if (state.health !== undefined) {
      this.s.hp = Math.max(0, Number(state.health));
      if (state.citadelMaxHp) this.s.maxHp = state.citadelMaxHp;
    }
    if (state.resources !== undefined) this.s.resources = Math.floor(Number(state.resources));
    if (state.armedAction !== undefined) this.setBuildSelection(state.armedAction);
    if (state.message !== undefined) this.s.message = state.message;
    if (state.canAffordAttack !== undefined || state.canAffordBuff !== undefined) {
      const ab = this.el?.querySelector<HTMLButtonElement>('#vk-hud-build-attack');
      const bb = this.el?.querySelector<HTMLButtonElement>('#vk-hud-build-buff');
      this.setActionAvailability({
        attack: state.canAffordAttack ?? !(ab?.disabled ?? false),
        buff: state.canAffordBuff ?? !(bb?.disabled ?? false),
      });
    }
    // Extended
    if (state.waveTimer !== undefined) this.s.waveTimer = state.waveTimer;
    if (state.enemiesAlive !== undefined) this.s.enemiesAlive = state.enemiesAlive;
    if (state.enemiesQueued !== undefined) this.s.enemiesQueued = state.enemiesQueued;
    if (state.alliesAlive !== undefined) this.s.alliesAlive = state.alliesAlive;
    if (state.crystals !== undefined) { this.s.crystals = state.crystals; this.features.crystals = true; }
    if (state.towerCount !== undefined) this.s.towerCount = state.towerCount;
    if (state.alert !== undefined && state.alert) {
      this.s.alert = state.alert; this.s.alertTimer = 4;
    }
    if (state.enemiesKilled !== undefined) { this.s.enemiesKilled = state.enemiesKilled; this.features.stats = true; }
    if (state.totalDamage !== undefined) this.s.totalDamage = state.totalDamage;

    if (this.s.hp <= 0) this.showWinLossOverlay('lost');
    if (state.won === true) this.showWinLossOverlay('won');
  }

  showWinLossOverlay(result: 'won' | 'lost'): void {
    document.getElementById(OVERLAY_ID)?.remove();
    const v = result === 'won';
    const ov = document.createElement('div'); ov.id = OVERLAY_ID;
    ov.innerHTML = `<div class="vk-res-panel" data-r="${result}">
      <div class="vk-res-rune">${v ? 'ᚢ' : 'ᚱ'}</div>
      <p class="vk-res-k">Battle Resolution</p>
      <h2 class="vk-res-t">${v ? 'Victory' : 'Defeat'}</h2>
      <p class="vk-res-d">${v ? 'The citadel holds!' : 'The citadel has fallen.'}</p>
      <button id="vk-play-again" class="vk-res-btn" type="button">Play Again</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector<HTMLButtonElement>('#vk-play-again')?.addEventListener('click', () => window.location.reload());
  }

  // ── Layout ──

  private syncSize(): void {
    if (!this.cvs || !this.el) return;
    const r = this.el.getBoundingClientRect();
    this.cvs.width = Math.round(r.width);
    this.cvs.height = Math.round(r.height);
    this.posHits();
  }

  private lay() {
    const W = this.cvs?.width ?? 800;
    const H = this.cvs?.height ?? 180;
    const p = 4;
    const gap = 4;
    const alertH = 18;
    const topBarH = 38;
    const botBarH = 214;
    const mainH = botBarH - alertH - p;
    const topY = H - botBarH + p;

    // 3 columns at bottom: Citadel(30%) | Defenses(35%) | Warband(35%)
    const cols = [0.30, 0.35, 0.35];
    const totalGap = gap * 2;
    const usable = W - p * 2 - totalGap;
    const cw = cols.map(r => usable * r);
    const cx = [p];
    for (let i = 1; i < 3; i++) cx.push(cx[i - 1] + cw[i - 1] + gap);

    // Tower buttons in Defenses col
    const bGap = 4;
    const bw = (cw[1] - bGap) / 2;
    const bh = mainH * 0.48;
    const atkBtn = { x: cx[1], y: topY + 20, w: bw, h: bh };
    const bufBtn = { x: cx[1] + bw + bGap, y: topY + 20, w: bw, h: bh };

    // Unit buttons 2×2 in Warband col
    const uGap = 4;
    const uw = (cw[2] - uGap) / 2;
    const uh = (mainH - 20 - uGap) / 2;
    const units = [
      { x: cx[2], y: topY + 20, w: uw, h: uh },
      { x: cx[2] + uw + uGap, y: topY + 20, w: uw, h: uh },
      { x: cx[2], y: topY + 20 + uh + uGap, w: uw, h: uh },
      { x: cx[2] + uw + uGap, y: topY + 20 + uh + uGap, w: uw, h: uh },
    ];

    return { W, H, p, topBarH, botBarH, mainH, alertH, cx, cw, topY, atkBtn, bufBtn, units };
  }

  private posHits(): void {
    if (!this.el) return;
    const L = this.lay();
    const set = (sel: string, r: { x: number; y: number; w: number; h: number }) => {
      const b = this.el!.querySelector<HTMLElement>(sel);
      if (!b) return;
      b.style.left = r.x + 'px'; b.style.top = r.y + 'px';
      b.style.width = r.w + 'px'; b.style.height = r.h + 'px';
    };
    set('#vk-hud-build-attack', L.atkBtn);
    set('#vk-hud-build-buff', L.bufBtn);
    L.units.forEach((u, i) => set(`#vk-hud-unit-${'abcd'[i]}`, u));
  }

  // ── Render ──

  private startLoop(): void {
    const loop = () => {
      this.s.t += 0.016;
      const tr = this.s.maxHp > 0 ? this.s.hp / this.s.maxHp : 1;
      this.s.hpSmooth += (tr - this.s.hpSmooth) * 0.08;
      if (this.s.alertTimer > 0) this.s.alertTimer -= 0.016;
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private render(): void {
    const c = this.ctx; if (!c || !this.cvs || this.cvs.width === 0) return;
    const L = this.lay();
    c.clearRect(0, 0, L.W, L.H);

    this.drawBg(c, L);
    this.drawTopBar(c, L);
    this.drawCitadel(c, L);
    this.drawDefenses(c, L);
    this.drawWarband(c, L);
    this.drawAlertBar(c, L);
  }

  // ── Background ──

  private drawBg(c: CanvasRenderingContext2D, L: ReturnType<typeof this.lay>): void {
    // Bottom panel background
    const y = L.H - L.botBarH;
    const bg = c.createLinearGradient(0, y, 0, L.H);
    bg.addColorStop(0, C.bg1); bg.addColorStop(1, C.bg3);
    c.fillStyle = bg; c.fillRect(0, y, L.W, L.botBarH);

    // Top glow line mapping to bottom panel
    const tg = c.createLinearGradient(0, y, L.W, y);
    tg.addColorStop(0, 'transparent'); tg.addColorStop(0.35, C.accentD);
    tg.addColorStop(0.65, C.accentD); tg.addColorStop(1, 'transparent');
    c.fillStyle = tg; c.fillRect(0, y, L.W, 1.5);

    // Side accents for bottom panel
    c.fillStyle = C.accentD;
    c.fillRect(0, y, 2, L.botBarH); c.fillRect(L.W - 2, y, 2, L.botBarH);
  }

  // ── Top Bar ──

  private drawTopBar(c: CanvasRenderingContext2D, L: ReturnType<typeof this.lay>): void {
    const y = 0, h = L.topBarH;
    
    // Top Bar Background
    c.fillStyle = 'rgba(2, 6, 14, 0.96)';
    c.fillRect(0, y, L.W, h);
    c.fillStyle = C.border;
    c.fillRect(0, h - 0.5, L.W, 0.5);

    const cy = h / 2;

    // LEFT: Resources
    const ex = 12, ew = 72, eh = Math.min(26, h - 8);
    const ey = cy - eh / 2;
    
    // Energy
    c.fillStyle = 'rgba(10, 24, 42, 0.5)'; c.strokeStyle = C.border; c.lineWidth = 0.5;
    if (c.roundRect) {
      c.beginPath(); c.roundRect(ex, ey, ew, eh, 4); c.fill(); c.stroke();
    } else {
      c.fillRect(ex, ey, ew, eh); c.strokeRect(ex, ey, ew, eh);
    }
    c.fillStyle = '#ffd84a'; c.font = '14px Inter,sans-serif'; c.fillText('⚡', ex + 8, cy + 4);
    c.fillStyle = C.text; c.font = 'bold 12px Inter,sans-serif'; c.fillText(`${this.s.resources}`, ex + 30, cy + 4);

    // Crystals
    if (this.features.crystals) {
      const cxpos = ex + ew + 12;
      c.fillStyle = 'rgba(10, 24, 42, 0.5)'; c.strokeStyle = C.border;
      if (c.roundRect) {
        c.beginPath(); c.roundRect(cxpos, ey, ew, eh, 4); c.fill(); c.stroke();
      } else {
        c.fillRect(cxpos, ey, ew, eh); c.strokeRect(cxpos, ey, ew, eh);
      }
      c.fillStyle = '#a06aff'; c.font = '14px Inter,sans-serif'; c.fillText('💎', cxpos + 8, cy + 4);
      c.fillStyle = C.text; c.font = 'bold 12px Inter,sans-serif'; c.fillText(`${this.s.crystals}`, cxpos + 30, cy + 4);
    }

    // Line separator
    c.fillStyle = C.textDim;
    c.fillRect(ex + ew * 2 + 24, cy - 10, 1, 20);

    // CENTER: Phase & Time
    c.textAlign = 'center';
    c.fillStyle = C.textDim; c.font = '600 8px Inter,monospace';
    c.fillText('ФАЗА ОБОРОНЫ', L.W / 2, cy - 6);

    const timer = Math.max(0, Math.ceil(this.s.waveTimer));
    const min = Math.floor(timer / 60);
    const sec = timer % 60;
    const timerStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    const isUrgent = timer > 0 && timer <= 5;
    
    c.fillStyle = isUrgent ? C.red : C.text; 
    c.font = 'bold 20px Inter,sans-serif';
    if (isUrgent) { c.shadowColor = C.red; c.shadowBlur = 6; }
    c.fillText(timerStr, L.W / 2, cy + 12);
    c.shadowBlur = 0;
    c.textAlign = 'left';

    // RIGHT: Wave, Points, Enemies
    c.textAlign = 'right';
    const rx = L.W - 16;
    c.fillStyle = C.textDim; c.font = '600 9px Inter,monospace';
    c.fillText(`ОЧКИ: ${this.s.totalDamage * 10 + this.s.enemiesKilled * 50}`, rx, cy - 7);
    c.fillText(`ВОЛНА ${this.s.wave}`, rx, cy + 4);
    c.fillText(`ВРАГОВ: ${this.s.enemiesAlive + this.s.enemiesQueued}`, rx, cy + 15);
    c.textAlign = 'left';
  }

  // ── 1. Citadel (left) ──

  private drawCitadel(c: CanvasRenderingContext2D, L: ReturnType<typeof this.lay>): void {
    const x = L.cx[0], w = L.cw[0], y = L.topY, h = L.mainH;
    this.drawPanel(c, x, y, w, h);
    this.drawLabel(c, x + 6, y + 4, 'CITADEL CORE', w - 12);

    let cy = y + 26;

    // Citadel icon circle
    const iconR = Math.min(24, Math.max(16, h * 0.16));
    const iconCx = x + 6 + iconR;
    const iconCy = cy + iconR;
    c.fillStyle = C.bg3;
    c.beginPath(); c.arc(iconCx, iconCy, iconR + 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = C.accent; c.lineWidth = 1.5;
    c.beginPath(); c.arc(iconCx, iconCy, iconR, 0, Math.PI * 2); c.stroke();
    c.save(); c.beginPath(); c.arc(iconCx, iconCy, iconR - 1, 0, Math.PI * 2); c.clip();
    if (this.imgs.citadel.complete && this.imgs.citadel.width > 0)
      c.drawImage(this.imgs.citadel, iconCx - iconR + 1, iconCy - iconR + 1, (iconR - 1) * 2, (iconR - 1) * 2);
    c.restore();

    // HP Header
    const txtX = x + 6 + iconR * 2 + 10;
    const ratio = this.s.hpSmooth;
    const hpCol = ratio > 0.6 ? C.accent : ratio > 0.3 ? '#c47aff' : C.red;

    c.fillStyle = C.textDim; c.font = '600 8px Inter,sans-serif';
    c.fillText('STRUCTURAL INTEGRITY', txtX, cy + 12);
    c.fillStyle = hpCol; c.font = 'bold 18px Inter,sans-serif';
    c.fillText(`${Math.ceil(this.s.hp)}/${this.s.maxHp}`, txtX, cy + 32);

    cy += iconR * 2 + 16;

    // HP bar
    this.drawBar(c, x + 16, cy, w - 32, 10, ratio, hpCol);
    cy += 28;

    // Stats area
    c.fillStyle = C.textDim; c.font = '600 7px Inter,sans-serif';
    c.fillText('COMBAT HISTORY', x + 16, cy);
    c.fillStyle = C.border; c.fillRect(x + 16, cy + 4, w - 32, 0.5);
    cy += 16;

    if (this.features.stats) {
      c.fillStyle = C.textMid; c.font = '12px Inter,sans-serif';
      c.fillText(`⚔ Enemies Eradicated: ${this.s.enemiesKilled}`, x + 16, cy + 6);
      c.fillText(`💥 Power Projected: ${this.s.totalDamage}`, x + 16, cy + 26);
      c.fillText(`🏗 Grid Towers: ${this.s.towerCount}`, x + 16, cy + 46);
    } else {
      c.fillStyle = C.lockedText; c.font = '11px Inter,sans-serif';
      c.fillText('🔒 Logs Encrypted', x + 16, cy + 8);
    }
  }

  // ── 2. Defenses (center) ──

  private drawDefenses(c: CanvasRenderingContext2D, L: ReturnType<typeof this.lay>): void {
    const x = L.cx[1], w = L.cw[1], y = L.topY, h = L.mainH;
    this.drawPanel(c, x, y, w, h);
    this.drawLabel(c, x + 6, y + 4, 'DEFENSES', w - 12);

    // Tower buttons
    this.drawTowerBtn(c, L.atkBtn, 'ATTACK', '50⚡', this.imgs.attack,
      this.s.armedAction === 'attack', this.s.attackAvail);
    this.drawTowerBtn(c, L.bufBtn, 'BUFF', '40⚡', this.imgs.buff,
      this.s.armedAction === 'buff', this.s.buffAvail);

    // Console message area below buttons
    const msgY = L.atkBtn.y + L.atkBtn.h + 8;
    const msgH = h - (msgY - y) - 8;
    if (msgH > 10) {
      c.fillStyle = 'rgba(4,10,24,0.6)';
      c.fillRect(x + 2, msgY, w - 4, msgH);
      c.strokeStyle = C.border; c.lineWidth = 0.5;
      c.strokeRect(x + 2, msgY, w - 4, msgH);

      const blink = Math.sin(this.s.t * 4) > 0;
      c.fillStyle = blink ? C.accent : 'transparent';
      c.font = '8px monospace'; c.fillText('>', x + 8, msgY + 12);

      c.fillStyle = C.textMid; c.font = '10px Inter,sans-serif';
      const mw = w - 24;
      const words = this.s.message.split(' ');
      let line = '', ly = msgY + 12;
      for (const wd of words) {
        const test = line ? `${line} ${wd}` : wd;
        if (c.measureText(test).width > mw && line) {
          c.fillText(line, x + 18, ly); line = wd; ly += 14;
          if (ly > msgY + msgH - 4) break;
        } else line = test;
      }
      if (line && ly <= msgY + msgH - 4) c.fillText(line, x + 18, ly);
    }
  }

  // ── 3. Warband (right) ──

  private drawWarband(c: CanvasRenderingContext2D, L: ReturnType<typeof this.lay>): void {
    const x = L.cx[2], w = L.cw[2], y = L.topY, h = L.mainH;
    this.drawPanel(c, x, y, w, h);

    c.fillStyle = C.accent; c.font = '700 8px Inter,sans-serif';
    c.fillText('⬡ WARBAND', x + 6, y + 12);
    c.fillStyle = C.textDim; c.font = '600 8px Inter,sans-serif';
    c.textAlign = 'right';
    c.fillText(`${this.s.alliesAlive} on field`, x + w - 6, y + 12);
    c.textAlign = 'left';

    c.fillStyle = C.border; c.fillRect(x + 6, y + 16, w - 12, 0.5);

    const defs = [
      { n: 'VIKING', sub: 'Melee • 50⚡', img: this.imgs.unitA, live: true, locked: false },
      { n: 'COLLECT', sub: 'Gather', img: this.imgs.unitB, live: false, locked: false },
      { n: 'BERSERK', sub: 'Heavy', img: this.imgs.unitC, live: false, locked: !this.features.berserk },
      { n: 'GUARD', sub: 'Ranged', img: this.imgs.unitD, live: false, locked: !this.features.guard },
    ];

    L.units.forEach((u, i) => this.drawUnitBtn(c, u, defs[i]));
  }

  // ── Alert Bar (bottom strip) ──

  private drawAlertBar(c: CanvasRenderingContext2D, L: ReturnType<typeof this.lay>): void {
    const y = L.H - L.alertH;
    c.fillStyle = 'rgba(4,10,20,0.9)';
    c.fillRect(0, y, L.W, L.alertH);
    c.fillStyle = 'rgba(40,100,200,0.2)';
    c.fillRect(0, y, L.W, 0.5);

    if (this.s.alertTimer > 0 && this.s.alert) {
      const flash = Math.sin(this.s.t * 6) > 0 ? 0.9 : 0.6;
      c.fillStyle = `rgba(255, 90, 90, ${flash * 0.12})`;
      c.fillRect(0, y, L.W, L.alertH);

      c.fillStyle = `rgba(255, 200, 100, ${flash})`;
      c.font = 'bold 10px Inter,sans-serif';
      c.textAlign = 'center';
      c.fillText(`⚠ ${this.s.alert}`, L.W / 2, y + 12);
      c.textAlign = 'left';
    } else {
      c.fillStyle = C.textDim; c.font = '9px Inter,sans-serif';
      c.textAlign = 'center';
      c.fillText('Runic defense grid online • MagicBlock devnet', L.W / 2, y + 12);
      c.textAlign = 'left';
    }
  }

  // ── Drawing primitives ──

  private drawPanel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const bg = c.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, 'rgba(8,18,40,0.85)'); bg.addColorStop(1, 'rgba(4,10,24,0.92)');
    c.fillStyle = bg; c.fillRect(x, y, w, h);
    c.strokeStyle = C.border; c.lineWidth = 0.5; c.strokeRect(x, y, w, h);
    const tg = c.createLinearGradient(x, y, x + w, y);
    tg.addColorStop(0, 'transparent'); tg.addColorStop(0.5, C.borderL); tg.addColorStop(1, 'transparent');
    c.fillStyle = tg; c.fillRect(x, y, w, 0.5);
  }

  private drawLabel(c: CanvasRenderingContext2D, x: number, y: number, title: string, w: number): void {
    c.fillStyle = C.accent; c.font = '700 8px Inter,sans-serif';
    c.fillText(`⬡ ${title}`, x, y + 10);
    c.fillStyle = C.border; c.fillRect(x, y + 14, w, 0.5);
  }

  private drawBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, col: string): void {
    c.fillStyle = 'rgba(8,18,40,0.9)'; c.fillRect(x, y, w, h);
    c.strokeStyle = C.accentD; c.lineWidth = 0.5; c.strokeRect(x, y, w, h);
    const fw = Math.max(0, w * ratio);
    if (fw > 0) {
      const g = c.createLinearGradient(x, y, x + fw, y);
      g.addColorStop(0, C.accentD); g.addColorStop(1, col);
      c.fillStyle = g; c.fillRect(x + 0.5, y + 0.5, fw - 1, h - 1);
    }
  }

  private drawTowerBtn(
    c: CanvasRenderingContext2D,
    r: { x: number; y: number; w: number; h: number },
    label: string, cost: string, img: HTMLImageElement,
    sel: boolean, avail: boolean
  ): void {
    c.globalAlpha = avail ? 1 : 0.35;
    const bg = c.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    bg.addColorStop(0, sel ? '#12283e' : '#0a1828');
    bg.addColorStop(1, sel ? '#0a1c30' : C.bg2);
    c.fillStyle = bg; c.fillRect(r.x, r.y, r.w, r.h);

    if (sel) {
      c.shadowColor = C.accent; c.shadowBlur = 8 + Math.sin(this.s.t * 4) * 3;
      c.strokeStyle = C.borderL; c.lineWidth = 1.5; c.strokeRect(r.x, r.y, r.w, r.h);
      c.shadowBlur = 0;
    } else {
      c.strokeStyle = C.border; c.lineWidth = 0.5; c.strokeRect(r.x, r.y, r.w, r.h);
    }

    // Icon
    const iS = Math.min(r.w * 0.5, r.h * 0.35, 28);
    const ix = r.x + (r.w - iS) / 2, iy = r.y + 8;
    c.fillStyle = C.bg3; c.fillRect(ix - 1, iy - 1, iS + 2, iS + 2);
    c.strokeStyle = C.accentD; c.lineWidth = 0.5; c.strokeRect(ix - 1, iy - 1, iS + 2, iS + 2);
    if (img.complete && img.width > 0) c.drawImage(img, ix, iy, iS, iS);

    c.textAlign = 'center';
    c.fillStyle = sel ? C.accentL : C.text; c.font = `bold ${Math.min(9, r.w * 0.1)}px Inter,sans-serif`;
    c.fillText(label, r.x + r.w / 2, iy + iS + 11);
    c.fillStyle = C.textDim; c.font = '8px Inter,sans-serif';
    c.fillText(cost, r.x + r.w / 2, r.y + r.h - 5);
    c.textAlign = 'left';
    c.globalAlpha = 1;
  }

  private drawUnitBtn(
    c: CanvasRenderingContext2D,
    r: { x: number; y: number; w: number; h: number },
    d: { n: string; sub: string; img: HTMLImageElement; live: boolean; locked: boolean }
  ): void {
    c.globalAlpha = d.locked ? 0.25 : d.live ? 1 : 0.45;

    const bg = c.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    bg.addColorStop(0, d.live ? '#0c1e38' : '#081420');
    bg.addColorStop(1, d.live ? '#061228' : C.bg3);
    c.fillStyle = bg; c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = d.live ? C.accentD : C.border;
    c.lineWidth = d.live ? 1 : 0.5; c.strokeRect(r.x, r.y, r.w, r.h);

    if (d.live) {
      const p = 0.15 + Math.sin(this.s.t * 2) * 0.08;
      c.shadowColor = C.accent; c.shadowBlur = 5 * p;
      c.strokeRect(r.x, r.y, r.w, r.h); c.shadowBlur = 0;
    }

    // Icon
    const iS = Math.min(r.w * 0.5, r.h * 0.45, 28);
    const ix = r.x + (r.w - iS) / 2, iy = r.y + 4;
    if (d.img.complete && d.img.width > 0) c.drawImage(d.img, ix, iy, iS, iS);

    c.textAlign = 'center';
    c.fillStyle = d.locked ? C.lockedText : d.live ? C.accentL : C.textDim;
    c.font = `600 ${Math.min(8, r.w * 0.08)}px Inter,sans-serif`;
    c.fillText(d.n, r.x + r.w / 2, iy + iS + 9);

    if (d.locked) {
      c.fillStyle = C.lockedText; c.font = '10px Inter,sans-serif';
      c.fillText('🔒', r.x + r.w / 2, iy + iS + 20);
    } else {
      c.fillStyle = C.textDim; c.font = '7px Inter,sans-serif';
      c.fillText(d.sub, r.x + r.w / 2, iy + iS + 18);
    }

    c.textAlign = 'left'; c.globalAlpha = 1;
  }

  // ── Events ──

  private bindEv(el: HTMLElement): void {
    el.querySelector('#vk-hud-build-attack')?.addEventListener('click', () => this.cbs.attack?.());
    el.querySelector('#vk-hud-build-buff')?.addEventListener('click', () => this.cbs.buff?.());
    el.querySelector('#vk-hud-unit-a')?.addEventListener('click', () => this.cbs.stagedUnitA?.());
    el.querySelector('#vk-hud-unit-b')?.addEventListener('click', () => this.cbs.stagedUnitB?.());
    el.querySelector('#vk-hud-unit-c')?.addEventListener('click', () => this.cbs.stagedUnitC?.());
    el.querySelector('#vk-hud-unit-d')?.addEventListener('click', () => this.cbs.stagedUnitD?.());
  }

  // ── CSS ──

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style'); s.id = STYLE_ID;
    s.textContent = `
      #vk-hud { position: absolute; inset: 0; pointer-events: none; z-index: 50; overflow: hidden; }
      #vk-hud-canvas { display: block; width: 100%; height: 100%; pointer-events: none; }
      #vk-hud-hit { position: absolute; inset: 0; pointer-events: none; }
      .vk-hit { position: absolute; background: transparent; border: none; cursor: pointer; pointer-events: all; padding: 0; outline: none; }
      .vk-hit:disabled { cursor: not-allowed; pointer-events: none; }
      #${OVERLAY_ID} {
        position: fixed; inset: 0; display: flex; align-items: center;
        justify-content: center; background: rgba(2,5,12,0.85);
        backdrop-filter: blur(8px); z-index: 110; font-family: Inter, sans-serif;
      }
      .vk-res-panel {
        width: min(92vw, 360px); padding: 32px 24px;
        border: 1px solid ${C.accentD}; background: linear-gradient(180deg, ${C.bg1}, ${C.bg3});
        box-shadow: 0 40px 80px rgba(0,20,60,0.7);
        display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
        clip-path: polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px);
      }
      .vk-res-panel::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, ${C.borderL}, transparent);
      }
      .vk-res-panel[data-r="lost"] { border-color: rgba(255,90,90,0.4); }
      .vk-res-rune { font-size: 48px; color: ${C.accent}; text-shadow: 0 0 30px ${C.accent}; }
      .vk-res-panel[data-r="lost"] .vk-res-rune { color: ${C.red}; text-shadow: 0 0 30px ${C.red}; }
      .vk-res-k { margin: 0; color: ${C.textDim}; text-transform: uppercase; letter-spacing: 0.2em; font-size: 10px; font-weight: 700; }
      .vk-res-t { margin: 0; font-family: Cinzel, serif; font-size: 40px; font-weight: 800; color: ${C.accentL}; text-shadow: 0 0 40px rgba(74,174,255,0.5); }
      .vk-res-panel[data-r="lost"] .vk-res-t { color: ${C.red}; text-shadow: 0 0 40px rgba(255,90,90,0.5); }
      .vk-res-d { margin: 0; color: ${C.textMid}; font-size: 13px; line-height: 1.6; }
      .vk-res-btn {
        margin-top: 6px; width: 100%; padding: 12px;
        background: linear-gradient(180deg, #12283e, #0a1828);
        color: ${C.accentL}; border: 1px solid ${C.accentD};
        cursor: pointer; font-family: Cinzel, serif; font-size: 13px;
        font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; transition: all 0.2s;
        clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
      }
      .vk-res-btn:hover {
        background: linear-gradient(180deg, #1a3858, #12283e);
        border-color: ${C.accent}; box-shadow: 0 0 24px rgba(74,174,255,0.25); transform: translateY(-1px);
      }
    `;
    document.head.appendChild(s);
  }
}
