import { getOpening, getResponse } from '../game/BossDialog';

const OVERLAY_ID = 'vk-neg-overlay';
const STYLE_ID = 'vk-neg-styles';

export type NegotiationMountOptions = {
  onSuccess: () => void;
  onFailure: () => void;
  initialScale?: number;
  initialAttempts?: number;
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;
  private scale = 0;
  private attemptsLeft = 3;
  private pending = false;

  mount(container: HTMLElement, opts: NegotiationMountOptions): void {
    // Prevent duplicate overlays
    if (document.getElementById(OVERLAY_ID)) return;

    // Initialise state from options
    this.scale = opts.initialScale ?? 0;
    this.attemptsLeft = opts.initialAttempts ?? 3;
    this.pending = false;

    this.ensureStyle();

    this.el = document.createElement('div');
    this.el.id = OVERLAY_ID;
    this.el.innerHTML = `
      <div class="vk-neg-panel">
        <div class="vk-neg-boss-area">
          <div class="vk-neg-boss-name">Пожиратель Миров</div>
        </div>
        <p class="vk-neg-reply" id="vk-neg-reply">"${getOpening()}"</p>

        <div class="vk-neg-scale-wrap">
          <div class="vk-neg-scale-track">
            <div class="vk-neg-scale-fill" id="vk-neg-scale-fill"></div>
          </div>
          <div class="vk-neg-scale-label" id="vk-neg-scale-label">0 / 12</div>
        </div>
        <div class="vk-neg-attempts" id="vk-neg-attempts">Попыток: ${this.attemptsLeft}</div>

        <input id="vk-neg-input" class="vk-neg-input" type="text"
               placeholder="Что предлагаешь боссу?" maxlength="300" autocomplete="off" />
        <button id="vk-neg-send" class="vk-neg-send" type="button">Отправить</button>
        <div id="vk-neg-status" class="vk-neg-status"></div>
      </div>
    `;

    container.appendChild(this.el);
    this.updateUI();

    const input = this.el.querySelector<HTMLInputElement>('#vk-neg-input')!;
    const sendBtn = this.el.querySelector<HTMLButtonElement>('#vk-neg-send')!;

    const send = () => this.sendMessage(input, sendBtn, opts);
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input.focus();
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private updateUI(): void {
    const fill = document.getElementById('vk-neg-scale-fill');
    if (fill) {
      (fill as HTMLElement).style.width = `${(this.scale / 12) * 100}%`;
    }

    const label = document.getElementById('vk-neg-scale-label');
    if (label) {
      label.textContent = `${this.scale} / 12`;
    }

    const attempts = document.getElementById('vk-neg-attempts');
    if (attempts) {
      attempts.textContent = `Попыток: ${this.attemptsLeft}`;
    }
  }

  private sendMessage(
    input: HTMLInputElement,
    sendBtn: HTMLButtonElement,
    opts: NegotiationMountOptions,
  ): void {
    // Pending guard — prevent double-submit
    if (this.pending) return;

    const text = input.value.trim();
    if (!text) return;

    this.pending = true;
    input.disabled = true;
    sendBtn.disabled = true;
    this.setStatus('Пожиратель Миров думает...');

    // Small delay so the "thinking" message is visible
    setTimeout(() => {
      const { reply, outcome } = getResponse(text);

      this.setReply(reply);
      this.setStatus('');

      // Apply outcome
      if (outcome === 'good') {
        this.scale = Math.min(12, this.scale + 4);
      } else if (outcome === 'neutral') {
        this.scale = Math.min(12, this.scale + 2);
        this.attemptsLeft += 2;
      } else {
        // bad
        this.attemptsLeft -= 1;
      }

      this.updateUI();

      // Terminal check after reading the reply
      setTimeout(() => {
        if (this.scale >= 12) {
          this.unmount();
          opts.onSuccess();
        } else if (this.attemptsLeft <= 0) {
          this.unmount();
          opts.onFailure();
        } else {
          // Non-terminal — re-enable input
          this.pending = false;
          input.disabled = false;
          sendBtn.disabled = false;
          input.value = '';
          input.focus();
        }
      }, 2000);
    }, 600);
  }

  private setReply(text: string): void {
    const el = document.getElementById('vk-neg-reply');
    if (el) el.textContent = `"${text}"`;
  }

  private setStatus(text: string): void {
    const el = document.getElementById('vk-neg-status');
    if (el) el.textContent = text;
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);z-index:9999}
      .vk-neg-panel{max-width:560px;width:min(92vw,560px);background:#0e1520;border:1px solid #2a3f5a;border-radius:12px;padding:28px;display:flex;flex-direction:column;gap:14px}
      .vk-neg-boss-name{color:#c8a86c;font-size:18px;letter-spacing:.1em;text-transform:uppercase}
      .vk-neg-reply{margin:0;color:#b0c4d8;font-size:14px;font-style:italic;min-height:60px;line-height:1.6}
      .vk-neg-scale-wrap{display:flex;flex-direction:column;gap:4px}
      .vk-neg-scale-track{height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden}
      .vk-neg-scale-fill{height:100%;background:linear-gradient(90deg,#a87b4c,#f0c17b);border-radius:4px;transition:width .4s ease;width:0%}
      .vk-neg-scale-label{font-size:11px;color:#7a9ab8;text-align:right;margin-top:2px}
      .vk-neg-attempts{font-size:12px;color:#c8d8e8;letter-spacing:.06em}
      .vk-neg-input{width:100%;box-sizing:border-box;background:#0a0f18;border:1px solid #2a3f5a;color:#e8f0f8;padding:10px 14px;border-radius:6px;font-size:14px;outline:none}
      .vk-neg-input:focus{border-color:#4a7fa8}
      .vk-neg-input:disabled{opacity:.5}
      .vk-neg-send{margin-top:2px;background:#1a2f4a;color:#90c8f0;border:1px solid #2a5a7a;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px;transition:background .15s}
      .vk-neg-send:hover:not(:disabled){background:#223a5a}
      .vk-neg-send:disabled{opacity:.4;cursor:default}
      .vk-neg-status{font-size:11px;color:#7a9ab8;letter-spacing:.06em;min-height:16px}
    `;
    document.head.appendChild(style);
  }
}
