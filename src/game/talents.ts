export type TalentBranch = 'berserk' | 'tycoon' | 'mystic';

export interface TalentNode {
  id: string;
  branch: TalentBranch;
  name: { uk: string; ru: string };
  desc: { uk: string; ru: string };
  icon: string;
  maxLevel: number;
  costPerLevel: number; // usually 1
  requiredBranchPoints: number; // threshold to unlock
  effectPerLevel: (level: number) => string;
}

export interface TalentsState {
  spent: number;
  nodes: Record<string, number>; // id -> level
}

export const TALENT_NODES: Record<string, TalentNode> = {
  // === BERSERK (ACTIVE / CLICKING) ===
  t_click_power: {
    id: 't_click_power',
    branch: 'berserk',
    name: { uk: 'Сталева Рука', ru: 'Стальная Рука' },
    desc: { uk: 'Збільшує силу кліку по фокачі на +15% за кожен рівень.', ru: 'Увеличивает силу клика по фокачче на +15% за каждый уровень.' },
    icon: '✊',
    maxLevel: 5,
    costPerLevel: 1,
    requiredBranchPoints: 0,
    effectPerLevel: (lvl) => `+${lvl * 15}% сили кліку`,
  },
  t_crit_surge: {
    id: 't_crit_surge',
    branch: 'berserk',
    name: { uk: 'Нищівний Крит', ru: 'Сокрушительный Крит' },
    desc: { uk: '+2% до шансу критичного кліку та +150% до критичної шкоди за рівень.', ru: '+2% к шансу критического клика и +150% к критическому урону за уровень.' },
    icon: '⚡',
    maxLevel: 5,
    costPerLevel: 1,
    requiredBranchPoints: 0,
    effectPerLevel: (lvl) => `+${lvl * 2}% шанс криту, +${lvl * 150}% крит шкоди`,
  },
  t_combo_master: {
    id: 't_combo_master',
    branch: 'berserk',
    name: { uk: 'Ритмічний Шквал', ru: 'Ритмичный Шквал' },
    desc: { uk: 'Збільшує вікно утримання комбо на +0.5с та макс. комбо на +25 за рівень.', ru: 'Увеличивает окно удержания комбо на +0.5с и макс. комбо на +25 за уровень.' },
    icon: '🔥',
    maxLevel: 4,
    costPerLevel: 1,
    requiredBranchPoints: 2,
    effectPerLevel: (lvl) => `+${lvl * 0.5}с комбо таймер, +${lvl * 25} макс комбо`,
  },
  t_frenzy_ignite: {
    id: 't_frenzy_ignite',
    branch: 'berserk',
    name: { uk: 'Пекельне Полум’я', ru: 'Адское Пламя' },
    desc: { uk: 'Під час будь-якого Frenzy кліки дають додатково +40% фокач за рівень.', ru: 'Во время любого Frenzy клики дают дополнительно +40% фокачч за уровень.' },
    icon: '💥',
    maxLevel: 3,
    costPerLevel: 1,
    requiredBranchPoints: 4,
    effectPerLevel: (lvl) => `+${lvl * 40}% клік під час Френзі`,
  },
  t_berserk_capstone: {
    id: 't_berserk_capstone',
    branch: 'berserk',
    name: { uk: 'Гнів Пекаря', ru: 'Гнев Пекаря' },
    desc: { uk: 'Кожні 120 кліків активують бурхливий 5-секундний автоклік (12 кліків/сек) без витрати енергії!', ru: 'Каждые 120 кликов активируют бурный 5-секундный автоклик (12 кликов/сек) без расхода энергии!' },
    icon: '🌋',
    maxLevel: 1,
    costPerLevel: 1,
    requiredBranchPoints: 8,
    effectPerLevel: (lvl) => lvl > 0 ? 'АКТИВОВАНО: Авто-шквал кожні 120 кліків' : 'Заблоковано',
  },

  // === TYCOON (PASSIVE / PRODUCTION & AFK) ===
  t_tycoon_cps: {
    id: 't_tycoon_cps',
    branch: 'tycoon',
    name: { uk: 'Золоті Печі', ru: 'Золотые Печи' },
    desc: { uk: 'Збільшує виробництво всіх будівель (CPS) на +10% за кожен рівень.', ru: 'Увеличивает производство всех зданий (CPS) на +10% за каждый уровень.' },
    icon: '🏭',
    maxLevel: 5,
    costPerLevel: 1,
    requiredBranchPoints: 0,
    effectPerLevel: (lvl) => `+${lvl * 10}% до всього CPS`,
  },
  t_night_baking: {
    id: 't_night_baking',
    branch: 'tycoon',
    name: { uk: 'Нічна Зміна', ru: 'Ночная Смена' },
    desc: { uk: 'Підвищує ставку нічного офлайн-доходу з 10% до 30%/50%/70%/90%.', ru: 'Повышает ставку ночного офлайн-дохода с 10% до 30%/50%/70%/90%.' },
    icon: '🌙',
    maxLevel: 4,
    costPerLevel: 1,
    requiredBranchPoints: 0,
    effectPerLevel: (lvl) => `${10 + lvl * 20}% нічний дохід (замість 10%)`,
  },
  t_guild_discount: {
    id: 't_guild_discount',
    branch: 'tycoon',
    name: { uk: 'Оптовий Закуп', ru: 'Оптовый Закуп' },
    desc: { uk: 'Знижує вартість покупки всіх звичайних будівель на 3% за рівень.', ru: 'Снижает стоимость покупки всех обычных зданий на 3% за уровень.' },
    icon: '🏷️',
    maxLevel: 5,
    costPerLevel: 1,
    requiredBranchPoints: 2,
    effectPerLevel: (lvl) => `-${lvl * 3}% знижка на будівлі`,
  },
  t_auto_repair: {
    id: 't_auto_repair',
    branch: 'tycoon',
    name: { uk: 'Авто-Майстер', ru: 'Авто-Мастер' },
    desc: { uk: 'Зламані будівлі самі лагодяться через 45с / 25с / 10с без ремкомплекту.', ru: 'Сломанные здания сами чинятся через 45с / 25с / 10с без ремкомплекта.' },
    icon: '🔧',
    maxLevel: 3,
    costPerLevel: 1,
    requiredBranchPoints: 4,
    effectPerLevel: (lvl) => lvl === 1 ? 'Авто-ремонт за 45с' : lvl === 2 ? 'Авто-ремонт за 25с' : 'Авто-ремонт за 10с',
  },
  t_tycoon_capstone: {
    id: 't_tycoon_capstone',
    branch: 'tycoon',
    name: { uk: 'Вічна Імперія', ru: 'Вечная Империя' },
    desc: { uk: 'Максимальний ліміт офлайн-доходу збільшено на +12 годин, і весь офлайн-дохід помножується на +30%!', ru: 'Максимальный лимит офлайн-дохода увеличен на +12 часов, и весь офлайн-доход умножается на +30%!' },
    icon: '🏛️',
    maxLevel: 1,
    costPerLevel: 1,
    requiredBranchPoints: 8,
    effectPerLevel: (lvl) => lvl > 0 ? 'АКТИВОВАНО: +12 год. офлайну & +30% доходу' : 'Заблоковано',
  },

  // === MYSTIC (LUCK, RARES & CAT) ===
  t_golden_omen: {
    id: 't_golden_omen',
    branch: 'mystic',
    name: { uk: 'Зоряне Благословення', ru: 'Звёздное Благословение' },
    desc: { uk: 'Золоті, алмазні та смарагдові фокачі з’являються на +12% частіше за кожен рівень.', ru: 'Золотые, алмазные и изумрудные фокаччи появляются на +12% чаще за каждый уровень.' },
    icon: '✨',
    maxLevel: 5,
    costPerLevel: 1,
    requiredBranchPoints: 0,
    effectPerLevel: (lvl) => `+${lvl * 12}% частота появи рідкісних фокач`,
  },
  t_cat_agility: {
    id: 't_cat_agility',
    branch: 'mystic',
    name: { uk: 'Прудкий Мурчик', ru: 'Быстрый Мурчик' },
    desc: { uk: 'Кіт бігає на +15% швидше, і ловить шкідників з нагородою +30% за рівень.', ru: 'Кот бегает на +15% быстрее, и ловит вредителей с наградой +30% за уровень.' },
    icon: '🐾',
    maxLevel: 4,
    costPerLevel: 1,
    requiredBranchPoints: 0,
    effectPerLevel: (lvl) => `+${lvl * 15}% швидкість кота, +${lvl * 30}% фокач`,
  },
  t_diamond_gleam: {
    id: 't_diamond_gleam',
    branch: 'mystic',
    name: { uk: 'Діамантова Жила', ru: 'Алмазная Жила' },
    desc: { uk: '+10% шанс отримати 💎 зі шкідників за рівень, а боси дають +1 💎 додатково.', ru: '+10% шанс получить 💎 со вредителей за уровень, а боссы дают +1 💎 дополнительно.' },
    icon: '💠',
    maxLevel: 3,
    costPerLevel: 1,
    requiredBranchPoints: 2,
    effectPerLevel: (lvl) => `+${lvl * 10}% шанс на 💎 зі шкідників, +${lvl} 💎 з босів`,
  },
  t_lucky_fate: {
    id: 't_lucky_fate',
    branch: 'mystic',
    name: { uk: 'Щаслива Доля', ru: 'Счастливая Судьба' },
    desc: { uk: 'Податкова інспекція забирає на 50% менше, а «Свято випічки» триває на 10с довше за рівень.', ru: 'Налоговая инспекция забирает на 50% меньше, а «Праздник выпечки» длится на 10с дольше за уровень.' },
    icon: '🍀',
    maxLevel: 2,
    costPerLevel: 1,
    requiredBranchPoints: 4,
    effectPerLevel: (lvl) => lvl === 1 ? '-50% податків, +10с свято' : '-100% податків (імунітет!), +20с свято',
  },
  t_mystic_capstone: {
    id: 't_mystic_capstone',
    branch: 'mystic',
    name: { uk: 'Кулінарне Диво', ru: 'Кулинарное Чудо' },
    desc: { uk: 'Кожна спіймана золота/алмазна/смарагдова фокача має 25% шанс подвоїти тривалість і дати +5 💎!', ru: 'Каждая пойманная золотая/алмазная/изумрудная фокачча имеет 25% шанс удвоить длительность и дать +5 💎!' },
    icon: '👑',
    maxLevel: 1,
    costPerLevel: 1,
    requiredBranchPoints: 8,
    effectPerLevel: (lvl) => lvl > 0 ? 'АКТИВОВАНО: 25% шанс подвоєння рідкісних фокач +5💎' : 'Заблоковано',
  },
};

export function getBranchSpentPoints(nodes: Record<string, number>, branch: TalentBranch): number {
  let count = 0;
  for (const [id, lvl] of Object.entries(nodes)) {
    const node = TALENT_NODES[id];
    if (node && node.branch === branch && lvl > 0) {
      count += lvl * node.costPerLevel;
    }
  }
  return count;
}

export function getTotalSpentPoints(nodes: Record<string, number>): number {
  let count = 0;
  for (const [id, lvl] of Object.entries(nodes)) {
    const node = TALENT_NODES[id];
    if (node && lvl > 0) {
      count += lvl * node.costPerLevel;
    }
  }
  return count;
}

export function getAvailableTalentPoints(prestige: number, spentPoints: number): number {
  // 1 Talent Point per Rebirth level!
  return Math.max(0, prestige - spentPoints);
}
