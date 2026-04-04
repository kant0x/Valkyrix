import type { GameState } from './game.types';
import type { BlockchainService } from '../blockchain/BlockchainService';
import { getCurrentState } from '../wallet/WalletService';
import { getLanguage } from '../i18n/localization';

export type RecruitableUnitKey = 'light-ally' | 'collector' | 'cybernetic';

type RecruitmentCost = {
  resources: number;
  crystals: number;
  latfa: number;
  label: string;
};

const CYBERNETIC_CALL_LIMIT = 3;
const CYBERNETIC_CALL_WINDOW_MS = 45_000;
const CYBERNETIC_CALL_COOLDOWN_MS = 15_000;
const CYBERNETIC_POD_SPAWN_COUNT = 3;
const VIKING_RECRUIT_COOLDOWN_MS = 1_200;

export const RECRUITMENT_COSTS: Record<RecruitableUnitKey, RecruitmentCost> = {
  'light-ally': {
    resources: 30,
    crystals: 0,
    latfa: 0,
    label: 'Viking',
  },
  'collector': {
    resources: 20,
    crystals: 0,
    latfa: 0,
    label: 'Collector',
  },
  'cybernetic': {
    resources: 0,
    crystals: 0,
    latfa: 12,
    label: 'Cybernetic Drop',
  },
};

export function canRecruitUnit(defKey: RecruitableUnitKey, state: GameState): boolean {
  if (state.phase !== 'playing') return false;
  const cost = RECRUITMENT_COSTS[defKey];
  const storedCrystals = state.crystals ?? 0;
  const storedLatfa = state.latfa ?? 0;
  if (state.resources < cost.resources || storedCrystals < cost.crystals || storedLatfa < cost.latfa) return false;
  if (defKey === 'light-ally' && !isVikingRecruitReady(state)) return false;
  if (defKey === 'collector') {
    const alive = state.units.filter(u => u.def.role === 'collector' && u.faction === 'ally' && u.hp > 0).length;
    const queued = state.spawnQueue.filter(e => e.defKey === 'collector').length;
    if (alive + queued >= 2) return false;
  }
  if (defKey === 'cybernetic') {
    const recent = getRecentCyberneticCalls(state);
    if (recent.length >= CYBERNETIC_CALL_LIMIT) return false;
    return getCyberneticCooldownRemaining(state) <= 0;
  }
  return true;
}

export function recruitUnit(
  defKey: RecruitableUnitKey,
  state: GameState,
  blockchainService?: BlockchainService,
): { ok: boolean; message: string } {
  if (state.phase !== 'playing') {
    return {
      ok: false,
      message: getLanguage() === 'ru'
        ? 'Найм недоступен, пока бой снова не активен.'
        : 'Recruitment is unavailable until the battle is active again.',
    };
  }

  const cost = RECRUITMENT_COSTS[defKey];
  const label = getRecruitLabel(defKey);
  const storedCrystals = state.crystals ?? 0;
  const storedLatfa = state.latfa ?? 0;
  if (state.resources < cost.resources) {
    return {
      ok: false,
      message: getLanguage() === 'ru'
        ? `Недостаточно энергии, чтобы вызвать ${label}.`
        : `Not enough energy to deploy ${label}.`,
    };
  }
  if (storedCrystals < cost.crystals) {
    return {
      ok: false,
      message: getLanguage() === 'ru'
        ? `Недостаточно кристаллов, чтобы вызвать ${label}.`
        : `Not enough crystals to deploy ${label}.`,
    };
  }
  if (storedLatfa < cost.latfa) {
    return {
      ok: false,
      message: getLanguage() === 'ru'
        ? `Сборщик должен принести больше латфы, прежде чем станет доступен ${label}.`
        : `Collector must gather more latfa before ${label} is available.`,
    };
  }
  if (defKey === 'light-ally' && !isVikingRecruitReady(state)) {
    return {
      ok: false,
      message: getLanguage() === 'ru'
        ? 'Кузница цитадели перезаряжается. Следующего викинга можно выпускать раз в 1.5 секунды.'
        : 'Citadel forge is recharging. The next Viking can deploy every 1.2 seconds.',
    };
  }

  if (defKey === 'collector') {
    const alive = state.units.filter(u => u.def.role === 'collector' && u.faction === 'ally' && u.hp > 0).length;
    const queued = state.spawnQueue.filter(e => e.defKey === 'collector').length;
    if (alive + queued >= 2) {
      return {
        ok: false,
        message: getLanguage() === 'ru'
          ? 'Оба слота сборщика заняты. Подожди, пока один освободится.'
          : 'Both collector slots are occupied. Wait for one to fall.',
      };
    }
  }

  if (defKey === 'cybernetic') {
    const recentCalls = getRecentCyberneticCalls(state);
    if (recentCalls.length >= CYBERNETIC_CALL_LIMIT) {
      return {
        ok: false,
        message: getLanguage() === 'ru'
          ? 'Использованы все 3 капсулы. Жди 45 секунд до перезарядки.'
          : 'All 3 capsule slots used. Wait 45 seconds for relay reset.',
      };
    }
    const cooldownSec = getCyberneticCooldownRemaining(state);
    if (cooldownSec > 0) {
      return {
        ok: false,
        message: getLanguage() === 'ru'
          ? `Следующая капсула через ${Math.ceil(cooldownSec)} сек.`
          : `Next capsule in ${Math.ceil(cooldownSec)}s.`,
      };
    }
  }

  state.resources -= cost.resources;
  state.crystals = storedCrystals - cost.crystals;
  state.latfa = storedLatfa - cost.latfa;
  if (defKey === 'light-ally') {
    state.lastVikingRecruitAtMs = Date.now();
  }

  if (defKey === 'cybernetic') {
    const anchor = resolveCyberneticDropAnchor(state);
    const recentCalls = getRecentCyberneticCalls(state);
    const perpAmounts = [-40, 0, 40]; // spread perpendicular to path, not in screen X
    const perpAmount = perpAmounts[recentCalls.length % perpAmounts.length] ?? 0;

    // Compute path perpendicular at anchor so pods land where applyLanePosition places units
    const allyPath = state.allyPathNodes ?? [];
    const anchorIdx = allyPath.findIndex(n => n.wx === anchor.wx && n.wy === anchor.wy);
    const nextNode = allyPath[anchorIdx >= 0 && anchorIdx < allyPath.length - 1 ? anchorIdx + 1 : Math.max(anchorIdx - 1, 0)];
    const pdx = nextNode ? nextNode.wx - anchor.wx : 0;
    const pdy = nextNode ? nextNode.wy - anchor.wy : 1;
    const plen = Math.hypot(pdx, pdy) || 1;
    const perpX = -pdy / plen;
    const perpY = pdx / plen;

    state.dropPods ??= [];
    state.cyberneticCallTimestamps = [...recentCalls, Date.now()];
    state.dropPods.push({
      id: state.nextId++,
      wx: anchor.wx + perpX * perpAmount,
      wy: anchor.wy - 24 + perpY * perpAmount,
      anchorWx: anchor.wx,
      anchorWy: anchor.wy,
      elapsed: 0,
      spawnCount: CYBERNETIC_POD_SPAWN_COUNT,
      releasedCount: 0,
    });
    const { publicKey } = getCurrentState();
    blockchainService?.recordCreate(defKey, publicKey).catch(() => {});
    return {
      ok: true,
      message: getLanguage() === 'ru'
        ? 'Капсула кибернетиков уже на подлёте. Сейчас высадятся три бойца.'
        : 'Cybernetic capsule inbound. Three operatives are dropping now.',
    };
  }

  // Stagger ally spawns: each queued light-ally adds 0.8 s delay so they
  // don't all appear in a cluster when the player spams the button.
  const staggerDelay = defKey === 'light-ally'
    ? state.spawnQueue.filter(e => e.defKey === 'light-ally').length * 0.8
    : 0;
  state.spawnQueue.push({ defKey, delay: staggerDelay });
  const { publicKey } = getCurrentState();
  blockchainService?.recordCreate(defKey, publicKey).catch(() => {});

  return {
    ok: true,
    message: getLanguage() === 'ru'
      ? `${label} выходит из цитадели.`
      : `${label} deployed from the citadel.`,
  };
}

function getRecentCyberneticCalls(state: GameState): number[] {
  const cutoff = Date.now() - CYBERNETIC_CALL_WINDOW_MS;
  return (state.cyberneticCallTimestamps ?? []).filter((timestamp) => timestamp >= cutoff);
}

export function getCyberneticCooldownRemaining(state: GameState): number {
  const recent = getRecentCyberneticCalls(state);
  if (recent.length === 0) return 0;
  const lastCall = Math.max(...recent);
  return Math.max(0, (lastCall + CYBERNETIC_CALL_COOLDOWN_MS - Date.now()) / 1000);
}

export function getCyberneticSlotsRemaining(state: GameState): number {
  return Math.max(0, CYBERNETIC_CALL_LIMIT - getRecentCyberneticCalls(state).length);
}

function isVikingRecruitReady(state: GameState): boolean {
  const lastRecruitAtMs = state.lastVikingRecruitAtMs ?? 0;
  return Date.now() - lastRecruitAtMs >= VIKING_RECRUIT_COOLDOWN_MS;
}

function resolveCyberneticDropAnchor(state: GameState): { wx: number; wy: number } {
  const allyPath = state.allyPathNodes ?? [];
  const citadel = allyPath[0];
  // Find the first road node that is at least 4 tile widths (256 world units) away from the citadel.
  if (citadel && allyPath.length >= 2) {
    const minDist = 4 * 64;
    for (let i = 1; i < allyPath.length; i++) {
      const node = allyPath[i]!;
      if (Math.hypot(node.wx - citadel.wx, node.wy - citadel.wy) >= minDist) {
        return node;
      }
    }
    return allyPath[allyPath.length - 1]!;
  }
  if (citadel) return citadel;
  const pathNodes = state.pathNodes;
  return pathNodes[Math.floor(pathNodes.length * 0.6)] ?? pathNodes[pathNodes.length - 1] ?? { wx: 0, wy: 0 };
}

function getRecruitLabel(defKey: RecruitableUnitKey): string {
  if (getLanguage() === 'ru') {
    if (defKey === 'light-ally') return 'викинг';
    if (defKey === 'collector') return 'сборщик';
    return 'сброс кибернетиков';
  }
  return RECRUITMENT_COSTS[defKey].label;
}
