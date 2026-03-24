const OVERLAY_ID = 'vk-negotiation-overlay';
const STYLE_ID = 'vk-neg-style';

const GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

const SYSTEM_PROMPT = `Ты — Пожиратель Миров, древний и ужасающий разум, стоящий перед Цитаделью. Игрок пытается с тобой договориться.
Отвечай строго в образе: угрожающе, величественно, немного загадочно. Только 1–2 предложения от лица босса.
После ответа добавь на новой строке JSON (без markdown, просто текст): {"outcome":"success"} или {"outcome":"failure"}.
Решай сам: если игрок предлагает что-то интересное, льстит, уважает силу или предлагает выгодную сделку — success.
Если грубит, угрожает, пишет чушь или ничего не предлагает — failure.`;

export type NegotiationCallbacks = {
  onSuccess: () => void;
  onFailure: () => void;
  initialScale?: number;
  initialAttempts?: number;
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;

  mount(_container: HTMLElement, cbs: NegotiationCallbacks): void {
    if (document.getElementById(OVERLAY_ID)) return;
    this.ensureStyle();
    this.el = document.createElement('div');
    this.el.id = OVERLAY_ID;
    this.el.innerHTML = `
      <div class="vk-neg-panel">
        <div class="vk-neg-rune">Переговоры</div>
        <div class="vk-neg-title">Пожиратель Миров</div>
        <p class="vk-neg-speech" id="vk-neg-speech">"Ещё один защитник Цитадели. Говори, смертный — у тебя мало времени."</p>
        <div class="vk-neg-input-row">
          <input id="vk-neg-input" class="vk-neg-input" type="text" placeholder="Что предлагаешь боссу?" maxlength="200" autocomplete="off" />
          <button id="vk-neg-send" class="vk-neg-send" type="button">➤</button>
        </div>
        <div id="vk-neg-status" class="vk-neg-status"></div>
      </div>
    `;
    document.body.appendChild(this.el);

    const input = this.el.querySelector<HTMLInputElement>('#vk-neg-input')!;
    const sendBtn = this.el.querySelector<HTMLButtonElement>('#vk-neg-send')!;

    const send = () => this.sendMessage(input, sendBtn, cbs);
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input.focus();
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private async sendMessage(
    input: HTMLInputElement,
    sendBtn: HTMLButtonElement,
    cbs: NegotiationCallbacks,
  ): Promise<void> {
    const text = input.value.trim();
    if (!text) return;

    input.disabled = true;
    sendBtn.disabled = true;
    this.setStatus('Пожиратель Миров думает...');

    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      const jsonMatch = raw.match(/\{"outcome"\s*:\s*"(success|failure)"\}/);
      const outcome = jsonMatch?.[1] as 'success' | 'failure' | undefined;
      const bossReply = raw.replace(/\{[^}]*\}/, '').trim();

      this.setSpeech(bossReply || raw);
      this.setStatus('');

      setTimeout(() => {
        this.unmount();
        if (outcome === 'success') cbs.onSuccess();
        else cbs.onFailure();
      }, 2800);

    } catch (err) {
      this.setStatus('Связь с боссом прервана. Попробуй ещё раз.');
      input.disabled = false;
      sendBtn.disabled = false;
    }
  }

  private setSpeech(text: string): void {
    const el = document.getElementById('vk-neg-speech');
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
      #${OVERLAY_ID}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,4,10,.92);backdrop-filter:blur(16px);z-index:120}
      .vk-neg-panel{width:min(92vw,520px);padding:40px 36px;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;border:1px solid rgba(168,123,76,.32);background:linear-gradient(180deg,rgba(22,18,24,.99),rgba(6,4,8,.99));box-shadow:0 48px 120px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,226,182,.06)}
      .vk-neg-rune{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#d1a06a}
      .vk-neg-title{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:26px;letter-spacing:.1em;text-transform:uppercase;color:#f0c17b}
      .vk-neg-speech{margin:0;font-size:14px;line-height:1.7;color:#c8d8e8;font-style:italic;min-height:44px}
      .vk-neg-input-row{display:flex;gap:8px;width:100%}
      .vk-neg-input{flex:1;padding:11px 14px;background:#07090f;border:1px solid rgba(140,100,60,.4);color:#e8f0f8;font-size:13px;font-family:"Trebuchet MS",sans-serif;outline:none}
      .vk-neg-input:focus{border-color:rgba(200,160,80,.6)}
      .vk-neg-input:disabled{opacity:.5}
      .vk-neg-send{padding:11px 18px;background:#0e0c14;border:1px solid rgba(168,123,76,.4);color:#f0c17b;cursor:pointer;font-size:15px;transition:background .15s}
      .vk-neg-send:hover:not(:disabled){background:#1a1420}
      .vk-neg-send:disabled{opacity:.4;cursor:default}
      .vk-neg-status{font-size:11px;color:#7a9ab8;letter-spacing:.08em;min-height:16px}
    `;
    document.head.appendChild(style);
  }
}
