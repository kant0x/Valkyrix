import type { GameState } from '../game/game.types';
import {
  BLOCKCHAIN_STATUS_EVENT,
  BLOCKCHAIN_TX_EVENT,
  type BlockchainStatusEventDetail,
  type BlockchainTxEventDetail,
} from '../blockchain/blockchainEvents';
import { t } from '../i18n/localization';

export type GameSidePanelRefs = {
  killsEl: HTMLElement | null;
  activeEl: HTMLElement | null;
  waveEl: HTMLElement | null;
  txListEl: HTMLElement | null;
};

export class GameSidePanelController {
  private killsEl: HTMLElement | null = null;
  private activeEl: HTMLElement | null = null;
  private waveEl: HTMLElement | null = null;
  private txListEl: HTMLElement | null = null;
  private txPollTimer: ReturnType<typeof setInterval> | null = null;
  private enemyKilledTotal = 0;
  private seenEnemyIds = new Set<number>();
  private localTxEntries: string[] = [];
  private txListener: ((event: Event) => void) | null = null;
  private statusListener: ((event: Event) => void) | null = null;

  bind(refs: GameSidePanelRefs): void {
    this.killsEl = refs.killsEl;
    this.activeEl = refs.activeEl;
    this.waveEl = refs.waveEl;
    this.txListEl = refs.txListEl;
  }

  resetState(): void {
    this.enemyKilledTotal = 0;
    this.seenEnemyIds = new Set<number>();
    if (this.killsEl) this.killsEl.textContent = '0';
    if (this.activeEl) this.activeEl.textContent = '0';
    if (this.waveEl) this.waveEl.textContent = t('game.waveShort', { value: 0 });
    this.localTxEntries = [];
    this.renderTxPanel();
  }

  reconcileBattleState(state: GameState): number {
    const enemyUnits = state.units.filter((u) => u.faction === 'enemy');
    const aliveEnemyIds = new Set<number>(enemyUnits.map((u) => u.id));
    if (this.seenEnemyIds.size > 0) {
      let killedNow = 0;
      for (const prevId of this.seenEnemyIds) {
        if (!aliveEnemyIds.has(prevId)) killedNow += 1;
      }
      if (killedNow > 0) {
        this.enemyKilledTotal += killedNow;
      }
    }
    this.seenEnemyIds = aliveEnemyIds;

    if (this.killsEl) this.killsEl.textContent = String(this.enemyKilledTotal);
    if (this.activeEl) this.activeEl.textContent = String(enemyUnits.length);
    if (this.waveEl) this.waveEl.textContent = t('game.waveShort', { value: state.waveNumber });

    return this.enemyKilledTotal;
  }

  startMagicBlockTxFeed(): void {
    this.stopMagicBlockTxFeed();
    this.attachBlockchainListeners();
    void this.refreshMagicBlockTransactions();
    this.txPollTimer = setInterval(() => {
      void this.refreshMagicBlockTransactions();
    }, 15000);
  }

  stopMagicBlockTxFeed(): void {
    if (this.txPollTimer) {
      clearInterval(this.txPollTimer);
      this.txPollTimer = null;
    }
    this.detachBlockchainListeners();
  }

  clear(): void {
    this.stopMagicBlockTxFeed();
    this.killsEl = null;
    this.activeEl = null;
    this.waveEl = null;
    this.txListEl = null;
    this.enemyKilledTotal = 0;
    this.seenEnemyIds = new Set<number>();
  }

  async refreshMagicBlockTransactions(): Promise<void> {
    if (!this.txListEl) return;
    this.renderTxPanel();
  }

  private attachBlockchainListeners(): void {
    if (typeof window === 'undefined') return;
    if (!this.txListener) {
      this.txListener = (event: Event) => {
        const detail = (event as CustomEvent<BlockchainTxEventDetail>).detail;
        if (!detail) return;
        if (this.isGameplayLabel(detail.label) && detail.status === 'sent' && detail.signature) {
          const line = this.formatGameplayTx(detail);
          this.localTxEntries = [line, ...this.localTxEntries].slice(0, 8);
        }
        this.renderTxPanel();
      };
      window.addEventListener(BLOCKCHAIN_TX_EVENT, this.txListener);
    }

    if (!this.statusListener) {
      this.statusListener = (event: Event) => {
        const detail = (event as CustomEvent<BlockchainStatusEventDetail>).detail;
        if (!detail) return;
        this.renderTxPanel();
      };
      window.addEventListener(BLOCKCHAIN_STATUS_EVENT, this.statusListener);
    }
  }

  private detachBlockchainListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.txListener) {
      window.removeEventListener(BLOCKCHAIN_TX_EVENT, this.txListener);
      this.txListener = null;
    }
    if (this.statusListener) {
      window.removeEventListener(BLOCKCHAIN_STATUS_EVENT, this.statusListener);
      this.statusListener = null;
    }
  }

  private renderTxPanel(): void {
    if (!this.txListEl) return;
    this.txListEl.innerHTML = '';

    const uniqueEntries = [...new Set(this.localTxEntries)].slice(0, 10);
    for (const entry of uniqueEntries) {
      const item = document.createElement('li');
      item.textContent = entry;
      this.txListEl.appendChild(item);
    }
  }

  private getTxLabelGroup(label: string): string {
    if (
      label === 'initialize_game' ||
      label === 'initialize_player' ||
      label === 'session_signer_fund' ||
      label === 'start_session'
    ) {
      return '[setup]';
    }
    if (
      label === 'record_create' ||
      label === 'record_kill' ||
      label === 'record_boss_outcome' ||
      label === 'finalize_session'
    ) {
      return '[gameplay]';
    }
    return '[tx]';
  }

  private isGameplayLabel(label: string): boolean {
    return this.getTxLabelGroup(label) === '[gameplay]';
  }

  private formatGameplayTx(detail: BlockchainTxEventDetail): string {
    return `${this.describeGameplayTx(detail)} | ${this.shortSignature(detail.signature ?? '')}`;
  }

  private describeGameplayTx(detail: BlockchainTxEventDetail): string {
    if (detail.label === 'record_kill') {
      return t('tx.kill', { entity: this.formatEntity(detail.entity) });
    }
    if (detail.label === 'record_create') {
      return this.describeCreate(detail.entity);
    }
    if (detail.label === 'record_boss_outcome') {
      return detail.outcome === 'negotiated' ? t('tx.bossDeal') : t('tx.bossKill');
    }
    if (detail.label === 'finalize_session') {
      return t('tx.finalize');
    }
    return detail.label;
  }

  private describeCreate(entity?: string): string {
    if (entity === 'attack-tower') return t('tx.buildAttack');
    if (entity === 'buff-tower') return t('tx.buildBuff');
    if (entity === 'light-ally') return t('tx.unitViking');
    if (entity === 'heavy-ally') return t('tx.unitHeavy');
    if (entity === 'collector') return t('tx.unitCollector');
    if (entity === 'berserker') return t('tx.unitCybernetic');
    if (entity === 'guardian') return t('tx.unitGuardian');
    return t('tx.create', { entity: this.formatEntity(entity) });
  }

  private formatEntity(entity?: string): string {
    if (!entity) return t('tx.unknown');
    return entity.replace(/-/g, ' ');
  }

  private shortSignature(signature: string): string {
    if (signature.length <= 14) return signature;
    return `${signature.slice(0, 6)}...${signature.slice(-6)}`;
  }
}
