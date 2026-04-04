import type { LeaderboardEntry } from '../blockchain/blockchain.types';
import { t } from '../i18n/localization';

const STYLE_ID = 'vk-leaderboard-style';
const OVERLAY_ID = 'vk-leaderboard-overlay';

const CSS = `
#${OVERLAY_ID}{
  position:fixed;inset:0;z-index:220;
  background:linear-gradient(180deg,rgba(2,6,12,.96),rgba(4,12,22,.98));
  color:#d9e7f4;display:flex;align-items:center;justify-content:center;
  padding:24px;font-family:'Inter',sans-serif;
}
.vk-leaderboard-shell{
  width:min(860px,100%);max-height:min(82vh,720px);overflow:auto;
  border:1px solid rgba(90,165,255,.35);border-radius:18px;
  background:rgba(5,12,24,.92);box-shadow:0 24px 80px rgba(0,0,0,.55), inset 0 0 30px rgba(40,80,140,.12);
  position:relative;padding:28px 28px 24px;
}
.vk-leaderboard-title{
  margin:0 0 18px;font-family:'Cinzel',serif;font-size:30px;letter-spacing:.18em;text-transform:uppercase;color:#f0f6ff;
}
.vk-leaderboard-sub{
  margin:0 0 22px;color:#89a9c8;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
}
.vk-leaderboard-close{
  position:absolute;top:18px;right:18px;border:1px solid rgba(100,180,255,.28);background:rgba(10,24,40,.85);
  color:#bfe2ff;border-radius:999px;width:40px;height:40px;cursor:pointer;font-size:20px;
}
.vk-leaderboard-close:hover{background:rgba(20,40,64,.95)}
.vk-leaderboard-table{width:100%;border-collapse:collapse}
.vk-leaderboard-table th{
  text-align:left;padding:10px 12px;border-bottom:1px solid rgba(100,180,255,.24);
  color:#6f97bf;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
}
.vk-leaderboard-row td{
  padding:12px;border-bottom:1px solid rgba(90,120,160,.12);font-size:14px;
}
.vk-leaderboard-row.own-entry td{
  color:#ffe08a;background:rgba(120,90,10,.14);font-weight:700;
}
.vk-leaderboard-rank{width:80px}
.vk-leaderboard-score,.vk-leaderboard-kills{text-align:right}
.vk-leaderboard-empty{
  padding:40px 12px;text-align:center;color:#8ea9c5;font-size:14px;letter-spacing:.06em;
}
`;

export class LeaderboardOverlay {
  private currentWallet: string | null = null;

  setCurrentWallet(pubkey: string | null): void {
    this.currentWallet = pubkey;
  }

  show(entries: LeaderboardEntry[]): void {
    this.hide();
    this.ensureStyle();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'leaderboard-overlay';
    overlay.innerHTML = `
      <div class="vk-leaderboard-shell">
        <button class="vk-leaderboard-close" type="button" aria-label="Close leaderboard">×</button>
        <h2 class="vk-leaderboard-title">Лидерборд</h2>
        <p class="vk-leaderboard-sub">MagicBlock archive ranking</p>
      </div>
    `;

    const shell = overlay.querySelector('.vk-leaderboard-shell') as HTMLDivElement;
    const closeBtn = overlay.querySelector('.vk-leaderboard-close') as HTMLButtonElement;
    closeBtn.setAttribute('aria-label', t('leaderboard.close'));
    closeBtn.textContent = 'x';
    const titleEl = overlay.querySelector<HTMLElement>('.vk-leaderboard-title');
    if (titleEl) titleEl.textContent = t('leaderboard.title');
    const subEl = overlay.querySelector<HTMLElement>('.vk-leaderboard-sub');
    if (subEl) subEl.textContent = t('leaderboard.subtitle');
    closeBtn.addEventListener('click', () => this.hide());

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'vk-leaderboard-empty';
      empty.textContent = 'Нет результатов';
      empty.textContent = t('leaderboard.empty');
      shell.appendChild(empty);
    } else {
      const table = document.createElement('table');
      table.className = 'vk-leaderboard-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>#</th>
            <th>Кошелёк</th>
            <th>Очки</th>
            <th>Убийства</th>
          </tr>
        </thead>
      `;
      const headerCells = table.querySelectorAll('th');
      if (headerCells[1]) headerCells[1].textContent = t('leaderboard.wallet');
      if (headerCells[2]) headerCells[2].textContent = t('leaderboard.score');
      if (headerCells[3]) headerCells[3].textContent = t('leaderboard.kills');
      const body = document.createElement('tbody');
      for (const entry of entries) {
        const row = document.createElement('tr');
        row.className = 'vk-leaderboard-row';
        if (this.currentWallet && entry.player === this.currentWallet) {
          row.classList.add('own-entry');
        }
        row.innerHTML = `
          <td class="vk-leaderboard-rank">#${entry.rank}</td>
          <td class="vk-leaderboard-player">${truncateWallet(entry.player)}</td>
          <td class="vk-leaderboard-score">${entry.score}</td>
          <td class="vk-leaderboard-kills">${entry.kills}</td>
        `;
        body.appendChild(row);
      }
      table.appendChild(body);
      shell.appendChild(table);
    }

    document.body.appendChild(overlay);
  }

  hide(): void {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
}

function truncateWallet(wallet: string): string {
  return wallet.length > 11 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet;
}
