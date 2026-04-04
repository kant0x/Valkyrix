/**
 * BossDialog — branching dialog tree for the Ночной Охотник (Night Hunter).
 *
 * Lore: The Night Hunter was banished to the Void (Пустота) by the god-programmers
 * of the old order for seeking total control. He has returned to claim the Код Предков
 * (Code of the Ancestors) — the living heart of the Citadel that sustains all life.
 *
 * Flow:
 *   Phase 1 (Appearance) → Phase 2 (History, optional) or Phase 3
 *   Phase 3 (Debate) → Phase 4 (Turning Point)
 *   Phase 4 → Phase 5 (Final Declaration)
 *   Phase 5 final choice → evaluate: persuasionPoints >= 80 → success, else failure
 *
 * Persuasion points accumulate (clamped 0–100). Success threshold: 50.
 */

import { getLanguage } from '../i18n/localization';

export interface DialogChoice {
  /** Text shown on the button */
  text: string;
  /** Persuasion points added when this choice is selected */
  points: number;
  /**
   * ID of the next phase to show.
   * -1 means "end of dialog — evaluate outcome".
   */
  nextPhase: number;
}

export interface DialogPhase {
  id: number;
  bossText: string;
  choices: DialogChoice[];
}

/** Minimum persuasion points for a peaceful outcome (onSuccess). */
export const SUCCESS_THRESHOLD = 80;

export const DIALOG_PHASES: readonly DialogPhase[] = [

  // ── Phase 1: Появление ────────────────────────────────────────────────────
  {
    id: 1,
    bossText:
      'Разрозненная энергия порождает хаос. Войны. Страдания. Всё это — последствия вашей свободы.\n\n' +
      'Я видел, как рождался Код Предков. Боги-программисты раздали энергию миллиардам — ' +
      'и мир погрузился в распад.\n\n' +
      'Я предлагал иное: единая воля, единый порядок. За это меня изгнали в Пустоту.\n' +
      'Но Пустота не убивает — она терпит. И я вернулся.\n\n' +
      'Код Предков будет сосредоточен там, где ему место. Подо мной.',
    choices: [
      {
        text: 'Кто ты? Почему ты охотишься за Кодом Предков?',
        points: 15,
        nextPhase: 2,
      },
      {
        text: 'Никогда! Цитадель устоит!',
        points: -10,
        nextPhase: 3,
      },
      {
        text: 'Мы готовы к бою, Ночной Охотник!',
        points: -10,
        nextPhase: 3,
      },
    ],
  },

  // ── Phase 2: История (только если выбрали "Кто ты?") ────────────────────
  {
    id: 2,
    bossText:
      'Я был здесь до падения старого мира. Я видел, как боги-программисты создавали Код Предков.\n' +
      'Я говорил им: сосредоточьте всю энергию. Дайте её мне. Я создам совершенный мир.\n\n' +
      'Но они изгнали меня в Пустоту.\n' +
      'За то, что я был прав.',
    choices: [
      {
        text: 'Может быть, ты ошибался тогда?',
        points: 20,
        nextPhase: 3,
      },
      {
        text: 'Разделённая энергия — это свобода.',
        points: 25,
        nextPhase: 3,
      },
      {
        text: 'Если возьмёшь Код — жители Цитадели погибнут.',
        points: 10,
        nextPhase: 3,
      },
      {
        text: 'Охота на невинных — не честь охотника.',
        points: 30,
        nextPhase: 3,
      },
    ],
  },

  // ── Phase 3: Философский диспут ──────────────────────────────────────────
  {
    id: 3,
    bossText:
      'Вы смелые. Я ожидал мольбы о пощаде.\n' +
      'Но вы защищаете мир, который не знает о вашем существовании.\n\n' +
      'Почему? Зачем охотиться за смыслом в мире без смысла?',
    choices: [
      {
        text: 'Потому что каждая жизнь имеет ценность.',
        points: 30,
        nextPhase: 4,
      },
      {
        text: 'Потому что свобода выбора важнее совершенства.',
        points: 35,
        nextPhase: 4,
      },
      {
        text: 'Один не может решать за всех. Это тирания.',
        points: 30,
        nextPhase: 4,
      },
      {
        text: 'Охота — это не власть. Это поиск смысла.',
        points: 35,
        nextPhase: 4,
      },
      {
        text: 'Код Предков — не твой. Никогда не был твоим.',
        points: -10,
        nextPhase: 4,
      },
    ],
  },

  // ── Phase 4: Момент истины ───────────────────────────────────────────────
  {
    id: 4,
    bossText:
      'Я... я помню. Я помню, почему был изгнан.\n' +
      'Не потому что был прав — потому что боялся.\n' +
      'Боялся хаоса. Боялся потерять контроль.\n' +
      'И в этом страхе потерял всё.\n\n' +
      'Тысячи лет один в Пустоте — охотился за тенями.\n' +
      'Думал, что это справедливо.\n\n' +
      'Может быть... я охотился не за тем?',
    choices: [
      {
        text: 'Присоединись к нам. Помоги защитить Цитадель.',
        points: 20,
        nextPhase: -1,
      },
      {
        text: 'Уходи. Больше не возвращайся к этим стенам.',
        points: 10,
        nextPhase: -1,
      },
      {
        text: 'Ты должен ответить за свои действия.',
        points: 5,
        nextPhase: -1,
      },
    ],
  },

];

export function getPhase(id: number): DialogPhase | undefined {
  const phases = getLanguage() === 'ru' ? DIALOG_PHASES : EN_DIALOG_PHASES;
  return phases.find((p) => p.id === id);
}

const EN_DIALOG_PHASES: readonly DialogPhase[] = [
  {
    id: 1,
    bossText:
      'Scattered energy breeds chaos. Wars. Suffering. All of it is the price of your freedom.\n\n' +
      'I watched the Code of the Ancestors come alive. The god-programmers gave power to billions, and the world collapsed into fracture.\n\n' +
      'I offered another path: one will, one order. For that I was cast into the Void.\n' +
      'But the Void does not kill. It waits. And I returned.\n\n' +
      'The Code of the Ancestors will rest where it belongs. Under me.',
    choices: [
      { text: 'Who are you? Why do you hunt the Code of the Ancestors?', points: 15, nextPhase: 2 },
      { text: 'Never. The Citadel will stand.', points: -10, nextPhase: 3 },
      { text: 'We are ready for battle, Night Hunter.', points: -10, nextPhase: 3 },
    ],
  },
  {
    id: 2,
    bossText:
      'I stood here before the old world fell. I watched the god-programmers forge the Code of the Ancestors.\n' +
      'I told them: concentrate all energy. Give it to me. I will build a perfect world.\n\n' +
      'Instead, they cast me into the Void.\n' +
      'For being right.',
    choices: [
      { text: 'Maybe you were wrong back then.', points: 20, nextPhase: 3 },
      { text: 'Shared energy is freedom.', points: 25, nextPhase: 3 },
      { text: 'If you take the Code, the people of the Citadel will die.', points: 10, nextPhase: 3 },
      { text: 'Hunting the innocent is no hunter’s honor.', points: 30, nextPhase: 3 },
    ],
  },
  {
    id: 3,
    bossText:
      'You are braver than I expected. I thought you would beg for mercy.\n' +
      'Instead you defend a world that does not even know your names.\n\n' +
      'Why? Why chase meaning inside a world without meaning?',
    choices: [
      { text: 'Because every life has value.', points: 30, nextPhase: 4 },
      { text: 'Because freedom matters more than perfection.', points: 35, nextPhase: 4 },
      { text: 'One being cannot decide for all. That is tyranny.', points: 30, nextPhase: 4 },
      { text: 'Hunting is not rule. It is a search for meaning.', points: 35, nextPhase: 4 },
      { text: 'The Code of the Ancestors is not yours. It never was.', points: -10, nextPhase: 4 },
    ],
  },
  {
    id: 4,
    bossText:
      'I... I remember now. I remember why I was exiled.\n' +
      'Not because I was right. Because I was afraid.\n' +
      'Afraid of chaos. Afraid of losing control.\n' +
      'And inside that fear, I lost everything.\n\n' +
      'For ages I hunted shadows in the Void.\n' +
      'I told myself it was justice.\n\n' +
      'Maybe... I was hunting the wrong thing.',
    choices: [
      { text: 'Join us. Help defend the Citadel.', points: 20, nextPhase: -1 },
      { text: 'Leave. Do not come back to these walls.', points: 10, nextPhase: -1 },
      { text: 'You still have to answer for what you have done.', points: 5, nextPhase: -1 },
    ],
  },
];
