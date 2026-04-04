import { getLanguage, t } from '../i18n/localization';

const STYLE_ID = 'vk-hud-style';
const OVERLAY_ID = 'vk-win-loss-overlay';

export type BuildAction = 'attack' | 'buff' | 'sell';
export type CommandCallbacks = {
  attack?: () => void;
  buff?: () => void;
  sell?: () => void;
  stagedUnitA?: () => void;
  stagedUnitB?: () => void;
  stagedUnitC?: () => void;
  stagedUnitD?: () => void;
  supportA?: () => void;
  supportB?: () => void;
  supportC?: () => void;
  supportD?: () => void;
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
  canSalvage?: boolean;
  canAffordViking?: boolean;
  canAffordCollector?: boolean;
  canAffordCybernetic?: boolean;
  cyberneticCooldown?: number;
  cyberneticSlots?: number;
  waveTimer?: number;
  enemiesAlive?: number;
  enemiesQueued?: number;
  alliesAlive?: number;
  crystals?: number;
  latfa?: number;
  schematics?: number;
  towerCount?: number;
  alert?: string;
  enemiesKilled?: number;
  totalDamage?: number;
  canSupportOverdrive?: boolean;
  canSupportOrbital?: boolean;
  canSupportMissile?: boolean;
  canSupportLance?: boolean;
  supportOverdriveCooldown?: number;
  supportOrbitalCooldown?: number;
  supportMissileCooldown?: number;
  supportLanceCooldown?: number;
}

export class HudOverlay {
  private el: HTMLElement | null = null;
  private cbs: CommandCallbacks = {};
  private s = {
    hp: 2000,
    maxHp: 2000,
    dmg: 0,
    kills: 0,
    resources: 0,
    crystals: 0,
    latfa: 0,
    schematics: 0,
    enemiesAlive: 0,
    enemiesQueued: 0,
    alliesAlive: 0,
    towerCount: 0,
    armedAction: null as BuildAction | null,
    alertTimer: null as ReturnType<typeof setTimeout> | null,
    supportCooldowns: {
      overdrive: 0,
      orbital: 0,
      missile: 0,
      lance: 0,
    },
  };

  mount(container: HTMLElement): void {
    this.ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'vk-hud';
    this.el.innerHTML = `
      <div class="vk-hud-deck" aria-label="${t('hud.citadelOrders')}">
        <div class="vk-hud-main">
          <section class="vk-panel-block vk-citadel-block">
            <div class="vk-citadel-banner"><strong>${t('hud.citadel')}</strong><span>${t('hud.guardData')}</span></div>
            <div class="vk-citadel-shell">
              <div class="vk-citadel-art"><img src="/assets/build/citadel/citadel.png" alt="" /></div>
              <div class="vk-citadel-copy">
                <div class="vk-panel-kicker">${t('hud.coreGenerator')}</div>
                <div class="vk-panel-title">${t('hud.anchorCitadel')}</div>
                <div class="vk-health-readout">
                  <strong id="vk-hud-health" class="vk-stat-value">2000 / 2000</strong>
                  <span class="vk-health-state">${t('hud.integrityStable')}</span>
                </div>
                <div class="vk-health-track"><div id="vk-hud-health-fill" class="vk-health-fill"></div></div>
                <div class="vk-mini-grid">
                  <div class="vk-mini-stat"><span>${t('hud.wave')}</span><strong id="vk-hud-wave">0</strong></div>
                  <div class="vk-mini-stat"><span>${t('hud.energy')}</span><strong id="vk-hud-resources">0</strong></div>
                  <div class="vk-mini-stat"><span>${t('hud.crystals')}</span><strong id="vk-hud-crystals">0</strong></div>
                  <div class="vk-mini-stat"><span>${t('hud.latfa')}</span><strong id="vk-hud-latfa">0</strong></div>
                  <div class="vk-mini-stat"><span>${t('hud.towers')}</span><strong id="vk-hud-towers">0</strong></div>
                  <div class="vk-mini-stat"><span>${t('hud.allies')}</span><strong id="vk-hud-allies">0</strong></div>
                </div>
                <div id="hud-alert-strip" class="vk-alert-strip">${t('hud.alertDefault')}</div>
              </div>
            </div>
          </section>

          <section class="vk-panel-block vk-oracle-block">
            <div class="vk-oracle-head">
              <div class="vk-oracle-eye" aria-hidden="true"></div>
            </div>
            <div class="vk-support-grid" aria-label="${t('hud.supportMatrix')}">
              <button id="vk-support-overdrive" class="vk-support-card vk-support-button" type="button">
                <span class="vk-support-kicker">${t('hud.booster')}</span>
                <strong class="vk-support-name">${t('support.overdriveName')}</strong>
                <span class="vk-support-desc">${t('support.overdriveDesc')}</span>
                <span class="vk-support-cost">${t('support.costs', { value: 2 })}</span>
                <span id="vk-support-buff-status" class="vk-support-status">${t('support.overdriveStatusReady')}</span>
              </button>
              <button id="vk-support-orbital" class="vk-support-card vk-support-button" type="button">
                <span class="vk-support-kicker">${t('hud.fromOrbit')}</span>
                <strong class="vk-support-name">${t('support.orbitalName')}</strong>
                <span class="vk-support-desc">${t('support.orbitalDesc')}</span>
                <span class="vk-support-cost">${t('support.costs', { value: 6 })}</span>
                <span id="vk-support-drop-status" class="vk-support-status">${t('support.orbitalStatusNeed')}</span>
              </button>
              <button id="vk-support-missile" class="vk-support-card vk-support-button" type="button">
                <span class="vk-support-kicker">${t('hud.antiSwarm')}</span>
                <strong class="vk-support-name">${t('support.missileName')}</strong>
                <span class="vk-support-desc">${t('support.missileDesc')}</span>
                <span class="vk-support-cost">${t('support.costs', { value: 4 })}</span>
                <span id="vk-support-rocket-status" class="vk-support-status">${t('support.missileStatusNeed')}</span>
              </button>
              <button id="vk-support-lance" class="vk-support-card vk-support-button" type="button">
                <span class="vk-support-kicker">${t('hud.heavyWeapon')}</span>
                <strong class="vk-support-name">${t('support.lanceName')}</strong>
                <span class="vk-support-desc">${t('support.lanceDesc')}</span>
                <span class="vk-support-cost">${t('support.costs', { value: 5 })}</span>
                <span id="vk-support-heavy-status" class="vk-support-status">${t('support.lanceStatusNeed')}</span>
              </button>
            </div>
            <div id="vk-hud-command-message" class="vk-deck-message">${t('hud.supportOnline')}</div>
            <div id="vk-hud-focus-label" class="vk-focus-label">${t('hud.focusDefault')}</div>
            <div id="vk-hud-oracle-resource" class="vk-oracle-resource">${t('support.reserves', { schematics: 0 })}</div>
          </section>

          <section class="vk-panel-block vk-orders-block">
            <div class="vk-order-column">
              <div class="vk-command-grid">
                <button id="vk-hud-build-attack" class="vk-command-card" type="button" data-selected="false">
                  <span class="vk-card-key">T</span>
                  <span class="vk-card-name">${t('hud.attackTower')}</span>
                  <span class="vk-card-desc">${t('hud.attackDesc')}</span>
                  <span class="vk-card-cost">E 50</span>
                </button>
                <button id="vk-hud-build-buff" class="vk-command-card" type="button" data-selected="false">
                  <span class="vk-card-key">A</span>
                  <span class="vk-card-name">${t('hud.buffTower')}</span>
                  <span class="vk-card-desc">${t('hud.buffDesc')}</span>
                  <span class="vk-card-cost">E 40</span>
                </button>
                <button id="vk-hud-build-sell" class="vk-command-card" type="button" data-selected="false">
                  <span class="vk-card-key">R</span>
                  <span class="vk-card-name">${t('hud.salvageTower')}</span>
                  <span class="vk-card-desc">${t('hud.salvageDesc')}</span>
                  <span class="vk-card-cost">E 15-25/s</span>
                </button>
              </div>
            </div>

            <div class="vk-order-column">
              <div class="vk-command-grid vk-command-grid-units">
                <button id="vk-hud-unit-a" class="vk-command-card" type="button">
                  <span class="vk-card-key">W</span>
                  <span class="vk-card-name">${t('hud.viking')}</span>
                  <span class="vk-card-desc">${t('hud.vikingDesc')}</span>
                  <span id="vk-cost-viking" class="vk-card-cost">E 0 / 30</span>
                </button>
                <button id="vk-hud-unit-b" class="vk-command-card" type="button">
                  <span class="vk-card-key">C</span>
                  <span class="vk-card-name">${t('hud.collector')}</span>
                  <span class="vk-card-desc">${t('hud.collectorDesc')}</span>
                  <span id="vk-cost-collector" class="vk-card-cost">E 0 / 20</span>
                </button>
                <button id="vk-hud-unit-c" class="vk-command-card" type="button">
                  <span class="vk-card-key">B</span>
                  <span class="vk-card-name">${t('hud.cybernetic')}</span>
                  <span class="vk-card-desc">${t('hud.cyberneticDesc')}</span>
                  <span id="vk-cost-cybernetic" class="vk-card-cost">L 0 / 12</span>
                </button>
                <button id="vk-hud-unit-d" class="vk-command-card is-locked" type="button" disabled>
                  <span class="vk-card-key">G</span>
                  <span class="vk-card-name">${t('hud.guardian')}</span>
                  <span class="vk-card-desc">${t('hud.guardianDesc')}</span>
                  <span class="vk-card-cost">C 35</span>
                </button>
              </div>
            </div>
          </section>
        </div>

      </div>
    `;

    container.appendChild(this.el);
    this.bindEvents();
    this.updateOracleInsight();
  }

  unmount(): void {
    if (this.s.alertTimer) clearTimeout(this.s.alertTimer);
    this.el?.remove();
    this.el = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }

  setCommandCallbacks(c: CommandCallbacks): void {
    this.cbs = { ...c };
  }

  setBuildSelection(selection: BuildAction | null): void {
    this.s.armedAction = selection;
    if (!this.el) return;
    const attack = this.el.querySelector<HTMLElement>('#vk-hud-build-attack');
    const buff = this.el.querySelector<HTMLElement>('#vk-hud-build-buff');
    const sell = this.el.querySelector<HTMLElement>('#vk-hud-build-sell');
    const items: Record<BuildAction, HTMLElement | null> = { attack, buff, sell };
    for (const [key, el] of Object.entries(items)) {
      if (!el) continue;
      const active = selection === key;
      el.dataset.selected = active ? 'true' : 'false';
      el.classList.toggle('is-active', active);
    }
  }

  setCommandMessage(message: string): void {
    this.updateText('#vk-hud-command-message', message);
    this.updateOracleInsight();
  }

  setActionAvailability(state: { attack: boolean; buff: boolean; sell?: boolean }): void {
    if (!this.el) return;
    const attack = this.el.querySelector<HTMLButtonElement>('#vk-hud-build-attack');
    const buff = this.el.querySelector<HTMLButtonElement>('#vk-hud-build-buff');
    const sell = this.el.querySelector<HTMLButtonElement>('#vk-hud-build-sell');
    if (attack) attack.disabled = !state.attack;
    if (buff) buff.disabled = !state.buff;
    if (sell && state.sell !== undefined) sell.disabled = !state.sell;
    this.updateOracleInsight();
  }

  setUnitAvailability(state: { viking: boolean; collector: boolean; cybernetic: boolean }): void {
    if (!this.el) return;
    const viking = this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-a');
    const collector = this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-b');
    const cybernetic = this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-c');
    if (viking) viking.disabled = !state.viking;
    if (collector) collector.disabled = !state.collector;
    if (cybernetic) cybernetic.disabled = !state.cybernetic;
    this.updateOracleInsight();
  }

  setSupportAvailability(state: { overdrive: boolean; orbital: boolean; missile: boolean; lance: boolean }): void {
    if (!this.el) return;
    const overdrive = this.el.querySelector<HTMLButtonElement>('#vk-support-overdrive');
    const orbital = this.el.querySelector<HTMLButtonElement>('#vk-support-orbital');
    const missile = this.el.querySelector<HTMLButtonElement>('#vk-support-missile');
    const lance = this.el.querySelector<HTMLButtonElement>('#vk-support-lance');
    if (overdrive) overdrive.disabled = !state.overdrive;
    if (orbital) orbital.disabled = !state.orbital;
    if (missile) missile.disabled = !state.missile;
    if (lance) lance.disabled = !state.lance;
    this.updateOracleInsight();
  }

  update(state: HudState): void {
    if (!this.el) return;

    if (state.wave !== undefined) this.updateText('#vk-hud-wave', String(state.wave));
    if (state.resources !== undefined) {
      this.s.resources = Math.max(0, Math.floor(Number(state.resources) || 0));
      this.updateText('#vk-hud-resources', `E ${this.s.resources}`);
      this.updateText('#vk-cost-viking', `E ${this.s.resources} / 30`);
      this.updateText('#vk-cost-collector', `E ${this.s.resources} / 20`);
      const vikingBtn = this.el?.querySelector<HTMLElement>('#vk-hud-unit-a');
      const collectorBtn = this.el?.querySelector<HTMLElement>('#vk-hud-unit-b');
      if (vikingBtn) vikingBtn.style.setProperty('--cost-color', this.s.resources >= 30 ? '#7fffb2' : '#ff7c7c');
      if (collectorBtn) collectorBtn.style.setProperty('--cost-color', this.s.resources >= 20 ? '#7fffb2' : '#ff7c7c');
    }
    if (state.crystals !== undefined) {
      this.s.crystals = Math.max(0, Math.floor(Number(state.crystals) || 0));
      this.updateText('#vk-hud-crystals', `C ${this.s.crystals}`);
    }
    if (state.latfa !== undefined) {
      this.s.latfa = Math.max(0, Math.floor(Number(state.latfa) || 0));
      this.updateText('#vk-hud-latfa', `L ${this.s.latfa}`);
    }
    {
      const cd = Math.ceil(Number(state.cyberneticCooldown ?? 0) || 0);
      const slots = Number(state.cyberneticSlots ?? 3);
      const cyberneticBtn = this.el?.querySelector<HTMLElement>('#vk-hud-unit-c');
      if (cd > 0) {
        this.updateText('#vk-cost-cybernetic', `${cd}с · ${slots}/3`);
        if (cyberneticBtn) cyberneticBtn.style.setProperty('--cost-color', '#ff9944');
      } else {
        this.updateText('#vk-cost-cybernetic', slots > 0 ? `L ${this.s.latfa} / 12` : 'перезарядка');
        if (cyberneticBtn) cyberneticBtn.style.setProperty('--cost-color', this.s.latfa >= 12 && slots > 0 ? '#7fffb2' : '#ff7c7c');
      }
    }
    if (state.schematics !== undefined) {
      this.s.schematics = Math.max(0, Math.floor(Number(state.schematics) || 0));
    }

    if (state.health !== undefined) this.s.hp = Math.max(0, Number(state.health) || 0);
    if (state.citadelMaxHp !== undefined) this.s.maxHp = Math.max(1, Number(state.citadelMaxHp) || 1);
    this.updateText('#vk-hud-health', `${Math.round(this.s.hp)} / ${this.s.maxHp}`);
    const fill = this.el.querySelector<HTMLElement>('#vk-hud-health-fill');
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, (this.s.hp / this.s.maxHp) * 100))}%`;

    if (state.waveTimer !== undefined) {
      const min = Math.floor(state.waveTimer / 60);
      const sec = Math.floor(state.waveTimer % 60);
      this.updateText('#vk-hud-timer', `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
    }

    const activeEnemies = state.enemiesAlive ?? this.s.enemiesAlive;
    const queuedEnemies = state.enemiesQueued ?? this.s.enemiesQueued;
    this.s.enemiesAlive = activeEnemies;
    this.s.enemiesQueued = queuedEnemies;
    this.s.alliesAlive = state.alliesAlive ?? this.s.alliesAlive;
    this.s.towerCount = state.towerCount ?? this.s.towerCount;
    this.updateText('#vk-hud-enemies-active', String(activeEnemies));
    this.updateText('#vk-hud-enemies', String(activeEnemies));
    this.updateText('#vk-hud-enemies-queued', String(queuedEnemies));
    this.updateText('#vk-hud-threat-total', this.describePressure(activeEnemies, queuedEnemies));
    this.updateText('#vk-hud-allies', String(this.s.alliesAlive));
    this.updateText('#vk-hud-towers', String(this.s.towerCount));

    if (state.totalDamage !== undefined) this.s.dmg = Math.max(0, Number(state.totalDamage) || 0);
    if (state.enemiesKilled !== undefined) this.s.kills = Math.max(0, Number(state.enemiesKilled) || 0);
    this.updateText('#vk-hud-kills', String(this.s.kills));
    this.updateText('#vk-hud-damage', String(this.s.dmg));
    this.updateText('#vk-hud-score', String(this.s.dmg * 10 + this.s.kills * 50));

    if (state.armedAction !== undefined) this.setBuildSelection(state.armedAction);
    if (state.message !== undefined) this.setCommandMessage(state.message);
    if (state.canAffordAttack !== undefined || state.canAffordBuff !== undefined || state.canSalvage !== undefined) {
      this.setActionAvailability({
        attack: state.canAffordAttack ?? !(this.el.querySelector<HTMLButtonElement>('#vk-hud-build-attack')?.disabled ?? false),
        buff: state.canAffordBuff ?? !(this.el.querySelector<HTMLButtonElement>('#vk-hud-build-buff')?.disabled ?? false),
        sell: state.canSalvage ?? !(this.el.querySelector<HTMLButtonElement>('#vk-hud-build-sell')?.disabled ?? false),
      });
    }
    if (state.canAffordViking !== undefined || state.canAffordCollector !== undefined || state.canAffordCybernetic !== undefined) {
      this.setUnitAvailability({
        viking: state.canAffordViking ?? !(this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-a')?.disabled ?? false),
        collector: state.canAffordCollector ?? !(this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-b')?.disabled ?? false),
        cybernetic: state.canAffordCybernetic ?? !(this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-c')?.disabled ?? false),
      });
    }
    if (
      state.canSupportOverdrive !== undefined
      || state.canSupportOrbital !== undefined
      || state.canSupportMissile !== undefined
      || state.canSupportLance !== undefined
    ) {
      this.setSupportAvailability({
        overdrive: state.canSupportOverdrive ?? !(this.el.querySelector<HTMLButtonElement>('#vk-support-overdrive')?.disabled ?? false),
        orbital: state.canSupportOrbital ?? !(this.el.querySelector<HTMLButtonElement>('#vk-support-orbital')?.disabled ?? false),
        missile: state.canSupportMissile ?? !(this.el.querySelector<HTMLButtonElement>('#vk-support-missile')?.disabled ?? false),
        lance: state.canSupportLance ?? !(this.el.querySelector<HTMLButtonElement>('#vk-support-lance')?.disabled ?? false),
      });
    }
    this.s.supportCooldowns.overdrive = Math.max(0, Number(state.supportOverdriveCooldown ?? this.s.supportCooldowns.overdrive) || 0);
    this.s.supportCooldowns.orbital = Math.max(0, Number(state.supportOrbitalCooldown ?? this.s.supportCooldowns.orbital) || 0);
    this.s.supportCooldowns.missile = Math.max(0, Number(state.supportMissileCooldown ?? this.s.supportCooldowns.missile) || 0);
    this.s.supportCooldowns.lance = Math.max(0, Number(state.supportLanceCooldown ?? this.s.supportCooldowns.lance) || 0);

    this.updateOracleInsight();

    if (state.alert) this.showAlert(state.alert);
    if (this.s.hp <= 0) this.showWinLossOverlay('lost');
    if (state.won) this.showWinLossOverlay('won');
  }

  showWinLossOverlay(result: 'won' | 'lost'): void {
    if (document.getElementById(OVERLAY_ID)) return;
    const win = result === 'won';
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
        <div class="vk-res-panel" data-r="${result}">
        <div class="vk-res-rune">${win ? t('hud.overlayAegis') : t('hud.overlayFall')}</div>
        <p class="vk-res-k">${t('hud.battleResolution')}</p>
        <h2 class="vk-res-t">${win ? t('hud.victory') : t('hud.defeat')}</h2>
        <p class="vk-res-d">${win ? t('hud.victoryDesc') : t('hud.defeatDesc')}</p>
        <button id="vk-play-again" class="vk-res-btn" type="button">${t('common.playAgain')}</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector<HTMLButtonElement>('#vk-play-again')?.addEventListener('click', () => window.location.reload());
  }

  private showAlert(message: string): void {
    const strip = this.el?.querySelector<HTMLElement>('#hud-alert-strip');
    if (!strip) return;
    strip.textContent = message;
    strip.classList.add('is-alert');
    if (this.s.alertTimer) clearTimeout(this.s.alertTimer);
    this.s.alertTimer = setTimeout(() => {
      strip.classList.remove('is-alert');
      strip.textContent = t('hud.alertDefault');
    }, 4000);
  }

  private bindEvents(): void {
    if (!this.el) return;
    this.el.querySelector('#vk-hud-build-attack')?.addEventListener('click', () => this.cbs.attack?.());
    this.el.querySelector('#vk-hud-build-buff')?.addEventListener('click', () => this.cbs.buff?.());
    this.el.querySelector('#vk-hud-build-sell')?.addEventListener('click', () => this.cbs.sell?.());
    this.el.querySelector('#vk-hud-unit-a')?.addEventListener('click', () => this.cbs.stagedUnitA?.());
    this.el.querySelector('#vk-hud-unit-b')?.addEventListener('click', () => this.cbs.stagedUnitB?.());
    this.el.querySelector('#vk-hud-unit-c')?.addEventListener('click', () => this.cbs.stagedUnitC?.());
    this.el.querySelector('#vk-hud-unit-d')?.addEventListener('click', () => this.cbs.stagedUnitD?.());
    this.el.querySelector('#vk-support-overdrive')?.addEventListener('click', () => this.cbs.supportA?.());
    this.el.querySelector('#vk-support-orbital')?.addEventListener('click', () => this.cbs.supportB?.());
    this.el.querySelector('#vk-support-missile')?.addEventListener('click', () => this.cbs.supportC?.());
    this.el.querySelector('#vk-support-lance')?.addEventListener('click', () => this.cbs.supportD?.());
  }

  private updateText(selector: string, value: string): void {
    const el = this.el?.querySelector<HTMLElement>(selector);
    if (el) el.textContent = value;
  }

  private updateOracleInsight(): void {
    if (!this.el) return;
    const attackReady = !(this.el.querySelector<HTMLButtonElement>('#vk-hud-build-attack')?.disabled ?? true);
    const buffReady = !(this.el.querySelector<HTMLButtonElement>('#vk-hud-build-buff')?.disabled ?? true);
    const sellReady = !(this.el.querySelector<HTMLButtonElement>('#vk-hud-build-sell')?.disabled ?? true);
    const vikingReady = !(this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-a')?.disabled ?? true);
    const collectorReady = !(this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-b')?.disabled ?? true);
    const cyberneticReady = !(this.el.querySelector<HTMLButtonElement>('#vk-hud-unit-c')?.disabled ?? true);
    const overdriveReady = !(this.el.querySelector<HTMLButtonElement>('#vk-support-overdrive')?.disabled ?? true);
    const orbitalReady = !(this.el.querySelector<HTMLButtonElement>('#vk-support-orbital')?.disabled ?? true);
    const missileReady = !(this.el.querySelector<HTMLButtonElement>('#vk-support-missile')?.disabled ?? true);
    const lanceReady = !(this.el.querySelector<HTMLButtonElement>('#vk-support-lance')?.disabled ?? true);
    const totalPressure = this.s.enemiesAlive + this.s.enemiesQueued;
    void attackReady;
    void buffReady;
    void sellReady;
    void vikingReady;
    void collectorReady;
    void cyberneticReady;

    let focus = t('hud.focusDefault');
    if (this.s.armedAction === 'attack') {
      focus = getLocalizedFocus('attack');
    } else if (this.s.armedAction === 'buff') {
      focus = getLocalizedFocus('buff');
    } else if (this.s.armedAction === 'sell') {
      focus = getLocalizedFocus('sell');
    } else if (overdriveReady && this.s.alliesAlive > 0 && totalPressure >= 4) {
      focus = t('support.overdriveStatusReady');
    } else if (orbitalReady && totalPressure >= 8) {
      focus = t('support.orbitalStatusReady');
    } else if (missileReady && totalPressure >= 6) {
      focus = t('support.missileStatusReady');
    } else if (lanceReady && totalPressure >= 1) {
      focus = t('support.lanceStatusReady');
    } else if (this.s.enemiesAlive === 0 && this.s.enemiesQueued === 0) {
      focus = getLocalizedFocus('calm');
    } else {
      focus = getLocalizedFocus('default', this.s.enemiesAlive, this.s.enemiesQueued, this.s.towerCount, this.s.alliesAlive);
    }

    this.updateText(
      '#vk-support-buff-status',
      getSupportStatusLabel(
        this.s.supportCooldowns.overdrive,
        overdriveReady ? t('support.overdriveStatusReady') : t('support.overdriveStatusNeed'),
      ),
    );
    this.updateText(
      '#vk-support-drop-status',
      getSupportStatusLabel(
        this.s.supportCooldowns.orbital,
        orbitalReady ? t('support.orbitalStatusReady') : t('support.orbitalStatusNeed'),
      ),
    );
    this.updateText(
      '#vk-support-rocket-status',
      getSupportStatusLabel(
        this.s.supportCooldowns.missile,
        missileReady ? t('support.missileStatusReady') : t('support.missileStatusNeed'),
      ),
    );
    this.updateText(
      '#vk-support-heavy-status',
      getSupportStatusLabel(
        this.s.supportCooldowns.lance,
        lanceReady ? t('support.lanceStatusReady') : t('support.lanceStatusNeed'),
      ),
    );
    this.updateText('#vk-hud-focus-label', focus);
    this.updateText('#vk-hud-oracle-resource', t('support.reserves', { schematics: this.s.schematics }));
  }

  private describePressure(activeEnemies: number, queuedEnemies: number): string {
    const total = activeEnemies + queuedEnemies;
    if (total <= 0) return t('hud.calm');
    if (queuedEnemies > activeEnemies && total >= 10) return t('hud.surging');
    if (total >= 18) return t('hud.critical');
    if (total >= 10) return t('hud.high');
    if (total >= 4) return t('hud.rising');
    return t('hud.low');
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #vk-hud{position:relative;width:100%;height:100%;padding:8px 10px;color:#e7eef6;font-family:"Bahnschrift","Trebuchet MS",sans-serif}
      .vk-panel,.vk-panel-block,.vk-top-chip,.vk-command-card,.vk-oracle-stat,.vk-deck-message,.vk-focus-label,.vk-oracle-resource,.vk-alert-strip,.vk-res-panel{border:1px solid rgba(168,123,76,.24);background:linear-gradient(180deg,rgba(22,22,24,.96),rgba(8,8,10,.97))}
      .vk-panel{box-shadow:inset 0 1px 0 rgba(255,226,182,.07),0 14px 26px rgba(0,0,0,.24)}
      .vk-hud-deck{width:100%;height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:8px;padding:10px 12px;overflow:hidden}
      .vk-hud-topline{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
      .vk-top-chip{padding:7px 10px;display:flex;flex-direction:column;gap:2px}
      .vk-panel-kicker,.vk-top-chip-label{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#d1a06a}
      .vk-top-chip strong,.vk-stat-value{font-size:14px;color:#f5f8fc}.vk-timer{color:#8de2ff!important}
      .vk-hud-main{display:grid;grid-template-columns:minmax(270px,.9fr) minmax(260px,.85fr) minmax(380px,1.25fr);gap:10px;min-height:0}.vk-panel-block{min-width:0}
      .vk-citadel-banner{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;background:linear-gradient(180deg,rgba(69,63,56,.92),rgba(29,27,25,.98))}.vk-citadel-banner strong{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#f0c17b}.vk-citadel-banner span{font-size:11px;color:#97aabd}
      .vk-citadel-shell{display:grid;grid-template-columns:88px minmax(0,1fr);gap:14px;align-items:center;padding:14px}.vk-citadel-art{aspect-ratio:1;display:grid;place-items:center;background:radial-gradient(circle,rgba(100,190,255,.18),transparent 58%),linear-gradient(180deg,rgba(20,20,24,.96),rgba(7,8,10,.98))}.vk-citadel-art img{width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(91,194,255,.3))}
      .vk-citadel-copy{display:flex;flex-direction:column;gap:6px;min-width:0}
      .vk-panel-title{margin:0;font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:14px;letter-spacing:.07em;text-transform:uppercase;color:#f8fbff}.vk-health-readout{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.vk-health-state{font-size:11px;text-transform:uppercase;color:#8bc8ff}
      .vk-health-track{height:9px;background:#05080c;overflow:hidden;margin:6px 0}.vk-health-fill{height:100%;background:linear-gradient(90deg,#4f8cff,#75d6ff 65%,#d7feff);transition:width .25s ease}.vk-mini-grid{display:flex;gap:18px;flex-wrap:wrap}.vk-mini-stat{display:flex;gap:8px;color:#93a7ba;font-size:11px}.vk-mini-stat strong{color:#eef7ff;font-size:12px}
      .vk-oracle-block{display:grid;grid-template-rows:auto auto auto auto auto;gap:6px;padding:10px 12px 12px}.vk-oracle-head{display:flex;justify-content:flex-end;gap:10px;min-height:10px}.vk-oracle-eye{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle,rgba(144,238,255,.95) 0 20%,rgba(36,122,182,.88) 36%,rgba(5,18,29,.2) 72%,transparent 74%);box-shadow:0 0 18px rgba(116,219,255,.28);margin-top:0}
      .vk-support-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:stretch;margin-top:-2px}.vk-support-card{position:relative;display:grid;grid-template-rows:auto auto minmax(34px,1fr) auto auto;gap:6px;min-height:140px;padding:12px 13px 11px;border:1px solid rgba(132,176,220,.18);background:
        linear-gradient(180deg,rgba(26,33,44,.96) 0%,rgba(12,15,22,.98) 58%,rgba(8,10,16,.99) 100%);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05), inset 0 -10px 24px rgba(38,90,148,.09), 0 10px 24px rgba(0,0,0,.18);overflow:hidden}
      .vk-support-card::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(116,219,255,.12),transparent 34%,transparent 66%,rgba(255,194,122,.08));pointer-events:none}
      .vk-support-button{text-align:left;color:#eef6ff;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}.vk-support-button:hover:not(:disabled){transform:translateY(-2px);border-color:rgba(123,221,255,.48);box-shadow:0 12px 22px rgba(0,0,0,.28)}.vk-support-button:disabled{opacity:.42;cursor:not-allowed}.vk-support-kicker{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#d7a96e}.vk-support-name{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#eef6ff;max-width:85%}.vk-support-desc{font-size:10px;line-height:1.4;color:#8fa5b8;align-self:start}.vk-support-cost{margin-top:auto;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#efc17f}.vk-support-status{display:block;padding-top:2px;font-size:10px;line-height:1.35;color:#89dfff}
      .vk-deck-message,.vk-focus-label,.vk-oracle-resource,.vk-alert-strip{padding:9px 12px;font-size:11px;line-height:1.45}.vk-oracle-resource{color:#9dddff}.vk-oracle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.vk-oracle-stat{display:flex;flex-direction:column;gap:3px;padding:8px 10px}.vk-oracle-stat span{font-size:10px;text-transform:uppercase;color:#93a7ba}.vk-oracle-stat strong{font-size:13px;color:#eef7ff}
      .vk-alert-strip{margin-top:2px;font-size:10px;color:#b8c8d7}
      .vk-orders-block{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px 8px 6px;align-content:start;overflow:hidden}.vk-order-column{display:flex;flex-direction:column;min-width:0}.vk-order-column .vk-panel-kicker{font-size:8px;letter-spacing:.14em}.vk-order-column .vk-panel-title{font-size:12px;letter-spacing:.05em}.vk-command-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:5px}
      .vk-command-card{position:relative;display:flex;flex-direction:column;gap:2px;min-height:60px;padding:8px 9px 7px;text-align:left;color:#eef6ff;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;overflow:hidden}.vk-command-card:hover:not(:disabled){transform:translateY(-2px);border-color:rgba(123,221,255,.48);box-shadow:0 8px 18px rgba(0,0,0,.24)}.vk-command-card:disabled{opacity:.38;cursor:not-allowed}.vk-command-card.is-active,.vk-command-card[data-selected="true"]{border-color:rgba(130,229,255,.72);background:linear-gradient(180deg,rgba(36,52,72,.96),rgba(14,22,35,.98))}
      .vk-card-key{position:absolute;top:7px;right:7px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:1px solid rgba(128,205,255,.25);background:#081018;color:#95dbff}.vk-card-name{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:9px;letter-spacing:.035em;text-transform:uppercase;padding-right:18px;line-height:1.15}.vk-card-desc{font-size:8px;line-height:1.15;color:#98aabe;padding-right:10px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:18px}.vk-card-cost{margin-top:auto;font-size:8px;letter-spacing:.06em;text-transform:uppercase;color:#efc17f}
      .vk-alert-strip.is-alert{border-color:rgba(255,132,132,.32);background:linear-gradient(180deg,rgba(58,20,16,.94),rgba(20,10,10,.96));color:#ffd9d9}
      #${OVERLAY_ID}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,7,12,.86);backdrop-filter:blur(12px);z-index:110}.vk-res-panel{width:min(92vw,420px);padding:34px 30px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;box-shadow:0 42px 110px rgba(0,0,0,.5)}.vk-res-rune{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:26px;letter-spacing:.2em;color:#93dfff}.vk-res-k{margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#d1a06a}.vk-res-t{margin:0;font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:40px;text-transform:uppercase;color:#e0f1ff;letter-spacing:.1em}.vk-res-d{font-size:14px;line-height:1.6;color:#9cb7cf}.vk-res-btn{width:100%;padding:15px;border:1px solid rgba(170,126,77,.24);background:#14171d;color:#ecf7ff;cursor:pointer;font-family:"Bahnschrift","Trebuchet MS",sans-serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase}
      @media (max-width:1240px){.vk-hud-main{grid-template-columns:minmax(240px,.95fr) minmax(240px,.95fr) minmax(280px,1.1fr)}.vk-orders-block{grid-template-columns:1fr}}
      @media (max-width:980px){#vk-hud{padding:6px}.vk-hud-deck{padding:8px}.vk-hud-topline{grid-template-columns:repeat(2,minmax(0,1fr))}.vk-hud-main{grid-template-columns:1fr}.vk-citadel-shell{grid-template-columns:64px minmax(0,1fr);gap:10px}.vk-citadel-art img{width:52px;height:52px}}
    `;
    document.head.appendChild(style);
  }
}

function getLocalizedFocus(
  mode: 'attack' | 'buff' | 'sell' | 'calm' | 'default',
  enemiesAlive = 0,
  enemiesQueued = 0,
  towerCount = 0,
  alliesAlive = 0,
): string {
  if (mode === 'attack') {
    return getIsRu()
      ? 'Фокус: Attack Tower заряжена. Закрой линию сейчас и накрой следующий натиск поддержкой.'
      : 'Focus: Attack Tower armed. Lock a lane now, then layer support fire on the next push.';
  }
  if (mode === 'buff') {
    return getIsRu()
      ? 'Фокус: Buff Tower заряжена. Ставь её рядом с бойцами, чтобы усилить мили и поддержку.'
      : 'Focus: Buff Tower armed. Place it near defenders to multiply melee pressure and support output.';
  }
  if (mode === 'sell') {
    return getIsRu()
      ? 'Фокус: режим разборки активен. Переработай башню и снова открой питание для поддержки и подкреплений.'
      : 'Focus: Salvage Surge is active. The frontline stays empowered as long as the energy feed holds.';
  }
  if (mode === 'calm') {
    return getIsRu()
      ? 'Фокус: поле спокойно. Используй паузу, чтобы нарастить башни, воинов и готовность поддержки.'
      : 'Focus: Field is calm. Use the lull to stack towers, warriors and support readiness before the next push.';
  }
  return getIsRu()
    ? `Фокус: ${enemiesAlive} активны, ${enemiesQueued} в очереди. Поддержка считывает ${towerCount} башен и ${alliesAlive} защитников на линии.`
    : `Focus: ${enemiesAlive} active, ${enemiesQueued} queued. Support systems are reading ${towerCount} towers and ${alliesAlive} defenders on the line.`;
}

function getLocalizedReserves(
  mode: 'default' | 'starved' | 'salvage' | 'structures' | 'reinforcements' | 'full' | 'core',
  resources: number,
  crystals: number,
  latfa: number,
): string {
  const prefix = `E ${resources}, C ${crystals}, L ${latfa}`;
  switch (mode) {
    case 'starved':
      return getIsRu()
        ? `Резервы: ${prefix}. Все основные приказы голодают. Держись, пока цитадель снова не заполнит сеть.`
        : `Reserves: ${prefix}. All primary orders are starved. Hold until the citadel refills the grid.`;
    case 'salvage':
      return getIsRu()
        ? `Резервы: ${prefix}. Новые приказы закрыты, но разборка может вернуть питание под поддержку.`
        : `Reserves: ${prefix}. New orders are locked, but salvage can restore power for support.`;
    case 'structures':
      return getIsRu()
        ? `Резервы: ${prefix}. Строительная сетка просела, так что держись на телах и таймингах поддержки.`
        : `Reserves: ${prefix}. Structure grid is low, so lean on bodies and timed support windows.`;
    case 'reinforcements':
      return getIsRu()
        ? `Резервы: ${prefix}. Очередь подкреплений сухая, но башни и поддержка ещё открыты.`
        : `Reserves: ${prefix}. Reinforcement queue is dry, but towers and support posture remain open.`;
    case 'full':
      return getIsRu()
        ? `Резервы: ${prefix}. Открыт полный стек команд: строй, усиливай, разбирай и зови поддержку.`
        : `Reserves: ${prefix}. Full command stack is open: build, reinforce, salvage and support.`;
    case 'core':
      return getIsRu()
        ? `Резервы: ${prefix}. Все базовые приказы на строительство и подкрепления доступны.`
        : `Reserves: ${prefix}. Core build and reinforcement orders are all available.`;
    default:
      return getIsRu()
        ? `Резервы: ${prefix}. Тактические системы под питанием и ждут следующей команды.`
        : `Reserves: ${prefix}. Tactical systems are powered and waiting for the next commit.`;
  }
}

function getLocalizedSupportStatus(
  mode: 'buffReady' | 'buffIdle' | 'dropReady' | 'dropNeed' | 'rocketPrime' | 'rocketTrack' | 'heavyPrime' | 'heavyIdle',
  value = 0,
): string {
  switch (mode) {
    case 'buffReady':
      return getIsRu()
        ? `Бафф линии готов для ${value} активных защитников`
        : `Line buff ready for ${value} active defenders`;
    case 'buffIdle':
      return getIsRu()
        ? 'Нужны бойцы на фронте, иначе усиление не раскроется'
        : 'Needs frontline units before the boost matters';
    case 'dropReady':
      return getIsRu()
        ? 'Орбитальная линия открыта для капсул и шок-поддержки'
        : 'Orbital lane open for capsule or shock support';
    case 'dropNeed':
      return getIsRu()
        ? `Латфа ${value}/12. Сборщик должен принести ещё трофеев с поля`
        : `Latfa ${value}/12. Collector must secure more field salvage`;
    case 'rocketPrime':
      return getIsRu()
        ? `Главная рой-цель: ${value} врагов в боевой зоне`
        : `Prime swarm target: ${value} hostiles in the battlespace`;
    case 'rocketTrack':
      return getIsRu()
        ? `Рой собирается. Отслеживается ${value} вражеских целей`
        : `Swarm pattern forming. ${value} total hostiles tracked`;
    case 'heavyPrime':
      return getIsRu()
        ? 'Тяжёлый канал рекомендован. Решение для массивного оружия оправдано'
        : 'Heavy channel advised. Massive weapon solution is justified';
    default:
      return getIsRu()
        ? 'Тяжёлый канал держится в резерве под элиту, броню и давление босса'
        : 'Heavy lane held in reserve for elites, armor or boss pressure';
  }
}

function getSupportStatusLabel(cooldown: number, readyText: string): string {
  if (cooldown > 0.05) {
    return t('support.cooling', { seconds: Math.ceil(cooldown) });
  }
  return `${t('support.ready')} - ${readyText}`;
}

void getLocalizedReserves;
void getLocalizedSupportStatus;

function getIsRu(): boolean {
  return getLanguage() === 'ru';
}
