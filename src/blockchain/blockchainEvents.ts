export const BLOCKCHAIN_TX_EVENT = 'vk:blockchain-tx';
export const BLOCKCHAIN_STATUS_EVENT = 'vk:blockchain-status';

export type BlockchainTxEventDetail = {
  label: string;
  status: 'pending' | 'sent' | 'failed';
  signature?: string;
  error?: string;
  entity?: string;
  outcome?: string;
};

export type BlockchainStatusEventDetail = {
  mode: 'offline' | 'cheap-tx';
  status: 'idle' | 'connecting' | 'active' | 'fallback' | 'ended';
  message: string;
};

export function emitBlockchainTx(detail: BlockchainTxEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<BlockchainTxEventDetail>(BLOCKCHAIN_TX_EVENT, { detail }));
}

export function emitBlockchainStatus(detail: BlockchainStatusEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<BlockchainStatusEventDetail>(BLOCKCHAIN_STATUS_EVENT, { detail }));
}
