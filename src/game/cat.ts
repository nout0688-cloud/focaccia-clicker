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

export interface CatSkin {
  id: string;
  nameUk: string;
  nameRu: string;
  breedUk: string;
  breedRu: string;
  descUk: string;
  descRu: string;
  minLevel: number;
  pounceBubble: string;
  chaseBubbleUk: string;
  chaseBubbleRu: string;
  rainBubbleUk: string;
  rainBubbleRu: string;
  purrsUk: string[];
  purrsRu: string[];
}

export const CAT_SKINS: CatSkin[] = [
  {
    id: 'murchik',
    nameUk: 'Мурчик',
    nameRu: 'Мурчик',
    breedUk: 'Класичний рудий',
    breedRu: 'Классический рыжий',
    descUk: 'Вірний та працьовитий захисник пекарні від жуків.',
    descRu: 'Верный и трудолюбивый защитник пекарни от жуков.',
    minLevel: 1,
    pounceBubble: '🐾 ХАП!',
    chaseBubbleUk: '😼 Бачу жука!',
    chaseBubbleRu: '😼 Вижу жука!',
    rainBubbleUk: '🙀 Дощ! Тікаю!',
    rainBubbleRu: '🙀 Дождь! Убегаю!',
    purrsUk: ['Муррр... ❤️', 'Мяу! 😻', 'Мур-мур! 🐾', 'Люблю фокачу! 🫓', 'Пекарня в безпеці! 🛡️'],
    purrsRu: ['Муррр... ❤️', 'Мяу! 😻', 'Мур-мур! 🐾', 'Люблю фокаччу! 🫓', 'Пекарня в безопасности! 🛡️'],
  },
  {
    id: 'bonya',
    nameUk: 'Боня',
    nameRu: 'Боня',
    breedUk: 'Шокована британка',
    breedRu: 'Шокированная британка',
    descUk: 'Британка з вічно очманілим, широко розкритим поглядом. Жуки самі тікають від її очей!',
    descRu: 'Британка с вечно ошарашенным взглядом. Жуки сами разбегаются от её глаз!',
    minLevel: 3,
    pounceBubble: '👀 ШО ЦЕ БУЛО?!',
    chaseBubbleUk: '😳 ТИ ХТО ТАКИЙ?!',
    chaseBubbleRu: '😳 ТЫ КТО ТАКОЙ?!',
    rainBubbleUk: '😱 ВОДА?! ЗАКРИЙТЕ НЕБО!',
    rainBubbleRu: '😱 ВОДА?! ЗАКРОЙТЕ НЕБО!',
    purrsUk: ['👀 Що ти робиш?!', '😳 Оце так погладив...', '🐾 Очманіти яка фокача!', '😹 Мене контузило любов\'ю!'],
    purrsRu: ['👀 Что ты делаешь?!', '😳 Вот это погладил...', '🐾 Обалдеть какая фокачча!', '😹 Меня контузило любовью!'],
  },
  {
    id: 'bambass',
    nameUk: 'Бамбасс',
    nameRu: 'Бамбасс',
    breedUk: 'Харизматичний дворовий пухнастик',
    breedRu: 'Харизматичный дворовый пушистик',
    descUk: 'Сірий кіт із пухнастою шерстю та характером міського боса. Ловить жуків з фірмовою незворушністю.',
    descRu: 'Серый кот с пушистой шерстью и характером городского босса. Ловит жуков с фирменным спокойствием.',
    minLevel: 3,
    pounceBubble: '💥 НА БАЗУ!',
    chaseBubbleUk: '😼 Стояти, дрібний!',
    chaseBubbleRu: '😼 Стоять, мелкий!',
    rainBubbleUk: '😼 Дощ? Я й не таке бачив!',
    rainBubbleRu: '😼 Дождь? Я и не такое видел!',
    purrsUk: ['😎 Повага пекарю!', '🐾 Двір під контролем.', '🥐 Насип ще фокачі, бро.', '😺 Нормально чухаєш!'],
    purrsRu: ['😎 Уважуха пекарю!', '🐾 Двор под контролем.', '🥐 Насыпь ещё фокаччи, бро.', '😺 Нормально чешешь!'],
  },
];

export function getCatSkin(skinId?: string): CatSkin {
  const found = CAT_SKINS.find((s) => s.id === skinId);
  return found || CAT_SKINS[0];
}
