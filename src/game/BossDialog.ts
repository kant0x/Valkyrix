/**
 * BossDialog — branching dialog tree for the Ночной Охотник (Night Hunter).
 *
 * Lore: The Night Hunter was banished to the Void (Пустота) by the god-programmers
 * of Asgard-Prime for seeking total control. He has returned to claim the Код Предков
 * (Code of the Ancestors) — the living heart of the Citadel that sustains all life.
 *
 * Flow:
 *   Phase 1 (Appearance) → Phase 2 (History, optional) or Phase 3
 *   Phase 3 (Debate) → Phase 4 (Turning Point)
 *   Phase 4 final choice → evaluate: persuasionPoints >= 50 → success, else failure
 *
 * Persuasion points accumulate (clamped 0–100). Success threshold: 50.
 */

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
export const SUCCESS_THRESHOLD = 50;

export const DIALOG_PHASES: readonly DialogPhase[] = [

  // ── Phase 1: Появление ────────────────────────────────────────────────────
  {
    id: 1,
    bossText:
      'Наконец-то я нашёл вас. Тысячи лет я охотился за этим.\n' +
      'Код Предков — я чувствую его биение в сердце вашей Цитадели.\n\n' +
      'Он мой. Он всегда был моим.\n' +
      'Отдайте его — и я позволю вам умереть быстро.',
    choices: [
      {
        text: 'Кто ты? Почему ты охотишься за Кодом Предков?',
        points: 15,
        nextPhase: 2,
      },
      {
        text: 'Никогда! Цитадель Асгард-Прайм устоит!',
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
      'Я был здесь до Асгард-Прайм. Я видел, как боги-программисты создавали Код Предков.\n' +
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
        text: 'Уходи. Больше не возвращайся в Асгард-Прайм.',
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
  return DIALOG_PHASES.find(p => p.id === id);
}
