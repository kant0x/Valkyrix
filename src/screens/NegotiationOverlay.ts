const OVERLAY_ID = 'vk-negotiation-overlay';
const STYLE_ID = 'vk-neg-style';

export type NegotiationCallbacks = {
  onSuccess: () => void;
  onFailure: () => void;
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;

  mount(container: HTMLElement, cbs: NegotiationCallbacks): void {
    if (document.getElementById(OVERLAY_ID)) return;
    this.ensureStyle();
    this.el = document.createElement('div');
    this.el.id = OVERLAY_ID;
    this.el.innerHTML = `
      <div class="vk-neg-panel">
        <div class="vk-neg-rune">Parley</div>
        <div class="vk-neg-title">Devourer of Worlds</div>
        <p class="vk-neg-body">A dark intellect stands before the Citadel. Its voice resonates through the data lattice:</p>
        <p class="vk-neg-speech">"Stand aside and I shall spare your archives. Resist, and I shall consume them."</p>
        <div class="vk-neg-choices">
          <button id="vk-neg-offer" class="vk-neg-btn vk-neg-btn--offer" type="button">Offer tribute</button>
          <button id="vk-neg-defy" class="vk-neg-btn vk-neg-btn--defy" type="button">Defy it</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.el);
    this.el.querySelector('#vk-neg-offer')?.addEventListener('click', () => {
      this.unmount();
      cbs.onSuccess();
    });
    this.el.querySelector('#vk-neg-defy')?.addEventListener('click', () => {
      this.unmount();
      cbs.onFailure();
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,4,10,.90);backdrop-filter:blur(14px);z-index:120}
      .vk-neg-panel{width:min(92vw,480px);padding:36px 32px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;border:1px solid rgba(168,123,76,.32);background:linear-gradient(180deg,rgba(22,22,24,.98),rgba(6,6,8,.99));box-shadow:0 48px 120px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,226,182,.06)}
      .vk-neg-rune{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#d1a06a}
      .vk-neg-title{font-family:"Copperplate Gothic Bold","Bahnschrift",sans-serif;font-size:28px;letter-spacing:.12em;text-transform:uppercase;color:#f0c17b}
      .vk-neg-body,.vk-neg-speech{margin:0;font-size:13px;line-height:1.6;color:#9cb7cf}
      .vk-neg-speech{color:#c8d8e8;font-style:italic}
      .vk-neg-choices{display:flex;gap:12px;margin-top:8px;width:100%}
      .vk-neg-btn{flex:1;padding:14px;border:1px solid rgba(170,126,77,.28);background:#0e1118;color:#ecf7ff;cursor:pointer;font-family:"Bahnschrift","Trebuchet MS",sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;transition:border-color .15s,background .15s}
      .vk-neg-btn--offer:hover{border-color:rgba(120,220,160,.52);background:#081410}
      .vk-neg-btn--defy:hover{border-color:rgba(255,110,110,.4);background:#120808}
    `;
    document.head.appendChild(style);
  }
}
