import { getPhase, SUCCESS_THRESHOLD } from '../game/BossDialog';
import type { DialogChoice } from '../game/BossDialog';

const OVERLAY_ID = 'vk-neg-overlay';
const STYLE_ID = 'vk-neg-styles';

export type NegotiationMountOptions = {
  onSuccess: () => void;
  onFailure: () => void;
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;
  private persuasionPoints = 0;

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
          <div class="vk-neg-status" id="vk-neg-status"></div>
        </div>
      </div>
    `;

    container.appendChild(this.el);
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
    const phaseEl = document.getElementById('vk-neg-phase');
    if (phaseEl) {
      const display = phaseId <= 2 ? 1 : phaseId - 1;
      phaseEl.textContent = `Фаза ${display} / 4`;
    }

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

    if (choice.nextPhase === -1) {
      // End of dialog — evaluate outcome after reading boss reaction
      setTimeout(() => {
        this.unmount();
        if (this.persuasionPoints >= SUCCESS_THRESHOLD) {
          opts.onSuccess();
        } else {
          opts.onFailure();
        }
      }, 1500);
    } else {
      setTimeout(() => this.showPhase(choice.nextPhase, opts), 1500);
    }
  }

  private updatePersuasionUI(): void {
    const fill = document.getElementById('vk-neg-persuasion-fill');
    if (fill) fill.style.width = `${this.persuasionPoints}%`;

    const label = document.getElementById('vk-neg-persuasion-label');
    if (label) label.textContent = `Убеждение: ${this.persuasionPoints} / 100`;
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
      .vk-neg-status{font-size:12px;color:#8060c0;text-align:center;min-height:18px;margin-top:10px;letter-spacing:.06em}
    `;
    document.head.appendChild(style);
  }
}
