export interface CatLevelInfo {
  level: number;
  nameUk: string;
  nameRu: string;
  titleUk: string;
  titleRu: string;
  descUk: string;
  descRu: string;
  runDurationMs: number;
  catchBonusMult: number;
  diamondChance: number;
  cpsBonus: number;
  upgradeCostDiamonds: number;
}

export const CAT_LEVELS: CatLevelInfo[] = [
  {
    level: 1,
    nameUk: 'Кошеня Мурчик',
    nameRu: 'Котёнок Мурчик',
    titleUk: 'Маленький охоронець пекарні',
    titleRu: 'Маленький охранник пекарни',
    descUk: 'Швидкість бігу: 3.5с • Ловить будь-яких жуків без промаху',
    descRu: 'Скорость бега: 3.5с • Ловит любых жуков без промаха',
    runDurationMs: 3500,
    catchBonusMult: 1.0,
    diamondChance: 0.08,
    cpsBonus: 0.02,
    upgradeCostDiamonds: 0,
  },
  {
    level: 2,
    nameUk: 'Прудкий Мисливець',
    nameRu: 'Шустрый Охотник',
    titleUk: 'Швидкі лапки та гострі кігті',
    titleRu: 'Быстрые лапки и острые когти',
    descUk: 'Швидкість бігу: 2.5с • +30% фокач із жуків • +4% CPS',
    descRu: 'Скорость бега: 2.5с • +30% фокач с жуков • +4% CPS',
    runDurationMs: 2500,
    catchBonusMult: 1.3,
    diamondChance: 0.18,
    cpsBonus: 0.04,
    upgradeCostDiamonds: 30,
  },
  {
    level: 3,
    nameUk: 'Гроза Шкідників',
    nameRu: 'Гроза Вредителей',
    titleUk: 'Жоден жук не сховається',
    titleRu: 'Ни один жук не спрячется',
    descUk: 'Швидкість бігу: 1.8с • +60% фокач • 28% шанс на 1 💎 • +6% CPS',
    descRu: 'Скорость бега: 1.8с • +60% фокач • 28% шанс на 1 💎 • +6% CPS',
    runDurationMs: 1800,
    catchBonusMult: 1.6,
    diamondChance: 0.28,
    cpsBonus: 0.06,
    upgradeCostDiamonds: 65,
  },
  {
    level: 4,
    nameUk: 'Майстер Кот',
    nameRu: 'Мастер Кот',
    titleUk: 'Ніндзя-стрибок та реакція пантери',
    titleRu: 'Ниндзя-прыжок и реакция пантеры',
    descUk: 'Швидкість бігу: 1.2с • +100% фокач • 42% шанс на 💎 • +8% CPS',
    descRu: 'Скорость бега: 1.2с • +100% фокач • 42% шанс на 💎 • +8% CPS',
    runDurationMs: 1200,
    catchBonusMult: 2.0,
    diamondChance: 0.42,
    cpsBonus: 0.08,
    upgradeCostDiamonds: 130,
  },
  {
    level: 5,
    nameUk: 'Кіт-Легенда Пекарні',
    nameRu: 'Кот-Легенда Пекарни',
    titleUk: 'Міфічний захисник золотого розмарину',
    titleRu: 'Мифический защитник золотого розмарина',
    descUk: 'Блискавичний стрибок: 0.7с! • +200% фокач • 60% шанс на 💎 • +12% CPS',
    descRu: 'Молниеносный прыжок: 0.7с! • +200% фокач • 60% шанс на 💎 • +12% CPS',
    runDurationMs: 700,
    catchBonusMult: 3.0,
    diamondChance: 0.60,
    cpsBonus: 0.12,
    upgradeCostDiamonds: 250,
  },
];

export const CAT_UNLOCK_COST_DIAMONDS = 50;

export function getCatLevelInfo(level: number): CatLevelInfo {
  const lvl = Math.max(1, Math.min(CAT_LEVELS.length, level || 1));
  return CAT_LEVELS[lvl - 1];
}
