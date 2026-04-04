import { getPhase, SUCCESS_THRESHOLD } from '../game/BossDialog';
import type { DialogChoice } from '../game/BossDialog';
import { getLanguage } from '../i18n/localization';

const OVERLAY_ID = 'vk-neg-overlay';
const STYLE_ID = 'vk-neg-styles';

export type NegotiationMountOptions = {
  onSuccess: () => void;
  onFailure: () => void;
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;
  private persuasionPoints = 0;
  private currentPhaseId = 1;

  mount(container: HTMLElement, opts: NegotiationMountOptions): void {
    if (document.getElementById(OVERLAY_ID)) return;

    this.persuasionPoints = 0;
    this.ensureStyle();

    this.el = document.createElement('div');
    this.el.id = OVERLAY_ID;
    this.el.innerHTML = `
      <div class="vk-neg-wrap">
        <div class="vk-neg-boss-panel">
          <div class="vk-neg-boss-name">⚔ НОЧНОЙ ОХОТНИК</div>
          <div class="vk-neg-phase-label" id="vk-neg-phase">Фаза 1 / 4</div>
          <p class="vk-neg-boss-text" id="vk-neg-boss-text"></p>
        </div>
        <div class="vk-neg-player-panel">
          <div class="vk-neg-persuasion-wrap">
            <div class="vk-neg-persuasion-track">
              <div class="vk-neg-persuasion-fill" id="vk-neg-persuasion-fill"></div>
            </div>
            <div class="vk-neg-persuasion-label" id="vk-neg-persuasion-label">Убеждение: 0 / 100</div>
          </div>
          <div class="vk-neg-choices" id="vk-neg-choices"></div>
          <div class="vk-neg-custom-wrap">
            <input class="vk-neg-custom-input" id="vk-neg-custom-input" type="text" placeholder="Напишите свой ответ..." maxlength="200" autocomplete="off" />
            <button class="vk-neg-custom-send" id="vk-neg-custom-send">→</button>
          </div>
          <div class="vk-neg-status" id="vk-neg-status"></div>
        </div>
      </div>
    `;
    const bossName = this.el.querySelector<HTMLElement>('.vk-neg-boss-name');
    if (bossName) bossName.textContent = getLanguage() === 'ru' ? 'НОЧНОЙ ОХОТНИК' : 'NIGHT HUNTER';
    const phaseLabel = this.el.querySelector<HTMLElement>('#vk-neg-phase');
    if (phaseLabel) phaseLabel.textContent = this.formatPhaseLabel(1);
    const persuasionLabel = this.el.querySelector<HTMLElement>('#vk-neg-persuasion-label');
    if (persuasionLabel) persuasionLabel.textContent = this.formatPersuasionLabel();
    const customInput = this.el.querySelector<HTMLInputElement>('#vk-neg-custom-input');
    if (customInput) customInput.placeholder = getLanguage() === 'ru' ? 'Напишите свой ответ...' : 'Write your own answer...';

    container.appendChild(this.el);
    this.currentPhaseId = 1;
    this.showPhase(1, opts);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private showPhase(phaseId: number, opts: NegotiationMountOptions): void {
    const phase = getPhase(phaseId);
    if (!phase) return;

    // Phase label: 1 and 2 both show as "Фаза 1", 3→2, 4→3/4
    this.currentPhaseId = phaseId;

    const phaseEl = document.getElementById('vk-neg-phase');
    if (phaseEl) {
      const display = phaseId <= 2 ? 1 : phaseId - 1;
      phaseEl.textContent = `Фаза ${display} / 4`;
    }

    if (phaseEl) phaseEl.textContent = this.formatPhaseLabel(phaseId);
    const textEl = document.getElementById('vk-neg-boss-text');
    if (textEl) textEl.textContent = `"${phase.bossText}"`;

    // Render choice buttons
    const choicesEl = document.getElementById('vk-neg-choices');
    if (choicesEl) {
      choicesEl.innerHTML = '';
      phase.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'vk-neg-choice';
        btn.textContent = choice.text;
        btn.addEventListener('click', () => this.onChoiceClick(choice, opts));
        choicesEl.appendChild(btn);
      });
    }

    const statusEl = document.getElementById('vk-neg-status');
    if (statusEl) statusEl.textContent = '';

    // Wire custom input
    const sendBtn = document.getElementById('vk-neg-custom-send') as HTMLButtonElement | null;
    const inputEl = document.getElementById('vk-neg-custom-input') as HTMLInputElement | null;
    const handleSend = () => {
      if (!inputEl) return;
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      this.onCustomInput(text, opts);
    };
    sendBtn?.addEventListener('click', handleSend);
    inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  private onChoiceClick(choice: DialogChoice, opts: NegotiationMountOptions): void {
    // Disable all buttons immediately (prevent double-click)
    document.querySelectorAll<HTMLButtonElement>('.vk-neg-choice').forEach(b => {
      b.disabled = true;
    });

    // Apply persuasion points (clamp 0–100)
    this.persuasionPoints = Math.max(0, Math.min(100, this.persuasionPoints + choice.points));
    this.updatePersuasionUI();

    // Show feedback
    const statusEl = document.getElementById('vk-neg-status');
    if (statusEl) {
      statusEl.textContent =
        choice.points > 0 ? `+${choice.points} к убеждению` :
        choice.points < 0 ? `${choice.points} к убеждению` : '';
    }

    if (statusEl) {
      statusEl.textContent =
        choice.points > 0 ? this.formatDelta(choice.points) :
        choice.points < 0 ? this.formatDelta(choice.points) : '';
    }

    if (choice.nextPhase === -1) {
      setTimeout(() => this.showOutcome(opts), 1500);
    } else {
      setTimeout(() => this.showPhase(choice.nextPhase, opts), 1500);
    }
  }

  private showOutcome(opts: NegotiationMountOptions): void {
    const success = this.persuasionPoints >= SUCCESS_THRESHOLD;
    const wrap = this.el?.querySelector('.vk-neg-wrap') as HTMLElement | null;
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="vk-neg-outcome ${success ? 'vk-neg-outcome--success' : 'vk-neg-outcome--failure'}">
        <div class="vk-neg-outcome-icon">${success ? '✦' : '✗'}</div>
        <div class="vk-neg-outcome-title">${success ? 'Переговоры завершены' : 'Переговоры провалены'}</div>
        <div class="vk-neg-outcome-desc">${
          success
            ? 'Ночной Охотник отступил. Цитадель устоит.'
            : 'Ночной Охотник разочарован. Орда на подходе.'
        }</div>
        <div class="vk-neg-outcome-pts">Убеждение: ${this.persuasionPoints} / 100</div>
      </div>
    `;
    const outcomeTitle = wrap.querySelector<HTMLElement>('.vk-neg-outcome-title');
    if (outcomeTitle) {
      outcomeTitle.textContent = success
        ? (getLanguage() === 'ru' ? 'Переговоры завершены' : 'Negotiation Complete')
        : (getLanguage() === 'ru' ? 'Переговоры провалены' : 'Negotiation Failed');
    }
    const outcomeDesc = wrap.querySelector<HTMLElement>('.vk-neg-outcome-desc');
    if (outcomeDesc) {
      outcomeDesc.textContent = success
        ? (getLanguage() === 'ru' ? 'Ночной Охотник отступил. Цитадель устоит.' : 'The Night Hunter withdrew. The Citadel stands.')
        : (getLanguage() === 'ru' ? 'Ночной Охотник разочарован. Орда уже в пути.' : 'The Night Hunter is not persuaded. The horde is already moving.');
    }
    const outcomePts = wrap.querySelector<HTMLElement>('.vk-neg-outcome-pts');
    if (outcomePts) outcomePts.textContent = this.formatPersuasionLabel();

    setTimeout(() => {
      this.unmount();
      if (success) opts.onSuccess(); else opts.onFailure();
    }, 2500);
  }

  private onCustomInput(_text: string, opts: NegotiationMountOptions): void {
    // Disable buttons and input while processing
    document.querySelectorAll<HTMLButtonElement>('.vk-neg-choice').forEach(b => { b.disabled = true; });
    const sendBtn = document.getElementById('vk-neg-custom-send') as HTMLButtonElement | null;
    const inputEl = document.getElementById('vk-neg-custom-input') as HTMLInputElement | null;
    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;

    // +2 persuasion for any custom message, stays on current phase
    this.persuasionPoints = Math.max(0, Math.min(100, this.persuasionPoints + 2));
    this.updatePersuasionUI();

    const statusEl = document.getElementById('vk-neg-status');
    if (statusEl) statusEl.textContent = `+2 к убеждению`;

    if (statusEl) statusEl.textContent = this.formatDelta(2);
    setTimeout(() => {
      // Re-render current phase (re-enables buttons and input)
      this.showPhase(this.currentPhaseId, opts);
    }, 1200);
  }

  private updatePersuasionUI(): void {
    const fill = document.getElementById('vk-neg-persuasion-fill');
    if (fill) fill.style.width = `${this.persuasionPoints}%`;

    const label = document.getElementById('vk-neg-persuasion-label');
    if (label) label.textContent = `Убеждение: ${this.persuasionPoints} / 100`;
  }

  private formatPhaseLabel(phaseId: number): string {
    const display = phaseId <= 2 ? 1 : phaseId - 1;
    return getLanguage() === 'ru' ? `Фаза ${display} / 4` : `Phase ${display} / 4`;
  }

  private formatPersuasionLabel(): string {
    return getLanguage() === 'ru'
      ? `Убеждение: ${this.persuasionPoints} / 100`
      : `Persuasion: ${this.persuasionPoints} / 100`;
  }

  private formatDelta(points: number): string {
    return getLanguage() === 'ru'
      ? `${points > 0 ? '+' : ''}${points} к убеждению`
      : `${points > 0 ? '+' : ''}${points} to persuasion`;
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.92);z-index:9999}
      .vk-neg-wrap{max-width:640px;width:min(94vw,640px);display:flex;flex-direction:column;border:1px solid #4a1a6a;border-radius:12px;overflow:hidden}
      .vk-neg-boss-panel{background:linear-gradient(180deg,#0e0018 0%,#180828 100%);padding:24px 28px 20px;border-bottom:1px solid #4a1a6a;box-shadow:inset 0 0 40px rgba(120,0,200,.15)}
      .vk-neg-boss-name{color:#c060ff;font-size:13px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:4px}
      .vk-neg-phase-label{color:#7040a0;font-size:11px;letter-spacing:.1em;margin-bottom:12px}
      .vk-neg-boss-text{margin:0;color:#d0b0f0;font-size:14px;font-style:italic;line-height:1.7;white-space:pre-line}
      .vk-neg-player-panel{background:linear-gradient(180deg,#000d1a 0%,#001428 100%);padding:20px 28px 24px}
      .vk-neg-persuasion-wrap{margin-bottom:16px}
      .vk-neg-persuasion-track{height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-bottom:4px}
      .vk-neg-persuasion-fill{height:100%;background:linear-gradient(90deg,#4040c0,#a040ff);border-radius:3px;transition:width .4s ease;width:0%}
      .vk-neg-persuasion-label{font-size:11px;color:#4080c0;text-align:right}
      .vk-neg-choices{display:flex;flex-direction:column;gap:8px}
      .vk-neg-choice{background:#040c18;color:#90c8f0;border:1px solid #1a3a5a;padding:11px 16px;border-radius:6px;cursor:pointer;font-size:13px;text-align:left;transition:background .15s,border-color .15s;line-height:1.4}
      .vk-neg-choice:hover:not(:disabled){background:#0a1e30;border-color:#2a6090}
      .vk-neg-choice:disabled{opacity:.4;cursor:default}
      .vk-neg-outcome{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;text-align:center;min-height:220px}
      .vk-neg-outcome--success{background:linear-gradient(180deg,#001a0a 0%,#002a10 100%)}
      .vk-neg-outcome--failure{background:linear-gradient(180deg,#1a0000 0%,#2a0808 100%)}
      .vk-neg-outcome-icon{font-size:40px;margin-bottom:16px}
      .vk-neg-outcome--success .vk-neg-outcome-icon{color:#40c060}
      .vk-neg-outcome--failure .vk-neg-outcome-icon{color:#c03030}
      .vk-neg-outcome-title{font-size:18px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px}
      .vk-neg-outcome--success .vk-neg-outcome-title{color:#60e080}
      .vk-neg-outcome--failure .vk-neg-outcome-title{color:#e04040}
      .vk-neg-outcome-desc{font-size:14px;color:#a090a0;line-height:1.6;margin-bottom:16px}
      .vk-neg-outcome-pts{font-size:12px;color:#6050a0;letter-spacing:.08em}
      .vk-neg-custom-wrap{display:flex;gap:8px;margin-top:12px}
      .vk-neg-custom-input{flex:1;background:#040c18;color:#c0e0ff;border:1px solid #1a3a5a;border-radius:6px;padding:9px 14px;font-size:13px;outline:none;transition:border-color .15s}
      .vk-neg-custom-input::placeholder{color:#2a5080}
      .vk-neg-custom-input:focus{border-color:#2a6090}
      .vk-neg-custom-input:disabled{opacity:.4}
      .vk-neg-custom-send{background:#0a1e30;color:#90c8f0;border:1px solid #1a3a5a;border-radius:6px;padding:9px 16px;cursor:pointer;font-size:15px;transition:background .15s,border-color .15s}
      .vk-neg-custom-send:hover:not(:disabled){background:#0f2a40;border-color:#2a6090}
      .vk-neg-custom-send:disabled{opacity:.4;cursor:default}
      .vk-neg-status{font-size:12px;color:#8060c0;text-align:center;min-height:18px;margin-top:10px;letter-spacing:.06em}
    `;
    document.head.appendChild(style);
  }
}
