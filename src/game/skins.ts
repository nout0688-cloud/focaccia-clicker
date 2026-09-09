import focacciaImg from '../assets/focaccia.png';
import skinChefImg from '../assets/skins/skin_chef.jpg';
import skinCyberImg from '../assets/skins/skin_cyber.jpg';
import skinRoyalImg from '../assets/skins/skin_royal.jpg';
import skinDemonImg from '../assets/skins/skin_demon.jpg';
import skinSamuraiImg from '../assets/skins/skin_samurai.jpg';
import skinFrostImg from '../assets/skins/skin_frost.jpg';
import skinPirateImg from '../assets/skins/skin_pirate.jpg';
import skinCosmicImg from '../assets/skins/skin_cosmic.jpg';
import skinGoldImg from '../assets/skins/skin_gold.jpg';

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface SkinItem {
  id: string;
  name: string;
  nameRu: string;
  rarity: SkinRarity;
  img: string;
  desc: string;
  descRu: string;
  bonusDesc: string;
  bonusDescRu: string;
  clickMult: number;
  cpsMult: number;
  energyRegenMult: number;
  bossDamageMult: number;
  goldenChanceMult: number;
  critChance: number;
  tier: number;
  badge: string;
  colorGrad: string;
  borderColor: string;
  glowColor: string;
  baseCostFocaccia: number;
  baseCostDiamonds: number;
}

export const RARITY_LABELS: Record<SkinRarity, { uk: string; ru: string; color: string; border: string; glow: string }> = {
  common: { uk: 'Звичайний', ru: 'Обычный', color: 'text-stone-300 bg-stone-800/80', border: 'border-stone-600', glow: 'rgba(168,162,158,0.3)' },
  rare: { uk: 'Рідкісний', ru: 'Редкий', color: 'text-blue-300 bg-blue-900/60', border: 'border-blue-500', glow: 'rgba(59,130,246,0.35)' },
  epic: { uk: 'Епічний', ru: 'Эпический', color: 'text-fuchsia-300 bg-purple-900/60', border: 'border-fuchsia-500', glow: 'rgba(217,70,239,0.4)' },
  legendary: { uk: 'Легендарний', ru: 'Легендарный', color: 'text-amber-300 bg-amber-950/70', border: 'border-amber-400', glow: 'rgba(251,191,36,0.45)' },
  mythic: { uk: 'Міфічний', ru: 'Мифический', color: 'text-rose-300 bg-rose-950/70', border: 'border-rose-500', glow: 'rgba(244,63,94,0.55)' },
};

export const SKINS: Record<string, SkinItem> = {
  skin_classic: {
    id: 'skin_classic',
    name: 'Класична Фокача',
    nameRu: 'Классическая Фокачча',
    rarity: 'common',
    img: focacciaImg,
    desc: 'Оригінальна, хрустка та неймовірно смачна домашня фокача.',
    descRu: 'Оригинальная, хрустящая и невероятно вкусная домашняя фокачча.',
    bonusDesc: 'Базовий смак (стандартні показники)',
    bonusDescRu: 'Базовый вкус (стандартные показатели)',
    clickMult: 1.0,
    cpsMult: 1.0,
    energyRegenMult: 1.0,
    bossDamageMult: 1.0,
    goldenChanceMult: 1.0,
    critChance: 0,
    tier: 1,
    badge: '🫓 Базовий',
    colorGrad: 'from-amber-700/60 to-stone-900',
    borderColor: 'border-amber-500/40',
    glowColor: 'rgba(245,158,11,0.2)',
    baseCostFocaccia: 0,
    baseCostDiamonds: 0,
  },
  skin_samurai: {
    id: 'skin_samurai',
    name: 'Фокача-Самурай',
    nameRu: 'Фокачча-Самурай',
    rarity: 'rare',
    img: skinSamuraiImg,
    desc: 'Відважний воїн у шоломі кабуто з гострою катаною та пелюстками сакури.',
    descRu: 'Отважный воин в шлеме кабуто с острой катаной и лепестками сакуры.',
    bonusDesc: '+12% сили кліку & +15% шкоди босам',
    bonusDescRu: '+12% силы клика & +15% урона боссам',
    clickMult: 1.12,
    cpsMult: 1.05,
    energyRegenMult: 1.10,
    bossDamageMult: 1.15,
    goldenChanceMult: 1.0,
    critChance: 0.05,
    tier: 2,
    badge: '🥷 Рідкісний',
    colorGrad: 'from-red-900/60 via-amber-950/70 to-stone-900',
    borderColor: 'border-red-400',
    glowColor: 'rgba(239,68,68,0.35)',
    baseCostFocaccia: 120000,
    baseCostDiamonds: 30,
  },
  skin_frost: {
    id: 'skin_frost',
    name: 'Крижана Фокача',
    nameRu: 'Ледяная Фокачча',
    rarity: 'rare',
    img: skinFrostImg,
    desc: 'Морозна скоринка з вічними кристалами блакитного льоду та полярним сяйвом.',
    descRu: 'Морозная корочка с вечными кристаллами лазурного льда и полярным сиянием.',
    bonusDesc: '+25% швидкості енергії & +8% до всього CPS',
    bonusDescRu: '+25% скорости энергии & +8% ко всему CPS',
    clickMult: 1.08,
    cpsMult: 1.08,
    energyRegenMult: 1.25,
    bossDamageMult: 1.10,
    goldenChanceMult: 1.05,
    critChance: 0.04,
    tier: 2,
    badge: '❄️ Рідкісний',
    colorGrad: 'from-cyan-900/60 via-sky-950/70 to-stone-900',
    borderColor: 'border-cyan-400',
    glowColor: 'rgba(6,182,212,0.35)',
    baseCostFocaccia: 150000,
    baseCostDiamonds: 35,
  },
  skin_chef: {
    id: 'skin_chef',
    name: 'Шеф-Кухар',
    nameRu: 'Шеф-Повар',
    rarity: 'rare',
    img: skinChefImg,
    desc: 'Майстер італійської випічки у білосніжному ковпаку зі скалкою в руці.',
    descRu: 'Мастер итальянской выпечки в белоснежном колпаке со скалкой в руке.',
    bonusDesc: '+10% сили кліку & +15% швидкості енергії',
    bonusDescRu: '+10% силы клика & +15% скорости энергии',
    clickMult: 1.10,
    cpsMult: 1.05,
    energyRegenMult: 1.15,
    bossDamageMult: 1.05,
    goldenChanceMult: 1.0,
    critChance: 0.03,
    tier: 2,
    badge: '👨‍🍳 Рідкісний',
    colorGrad: 'from-blue-900/60 via-indigo-950/70 to-stone-900',
    borderColor: 'border-blue-400',
    glowColor: 'rgba(59,130,246,0.35)',
    baseCostFocaccia: 100000,
    baseCostDiamonds: 25,
  },
  skin_cyber: {
    id: 'skin_cyber',
    name: 'Кібер-Фокача 2077',
    nameRu: 'Кибер-Фокачча 2077',
    rarity: 'epic',
    img: skinCyberImg,
    desc: 'Футуристична неонова кібер-випічка з візором та енергетичними схемами.',
    descRu: 'Футуристическая неоновая кибер-выпечка с визором и энергосхемами.',
    bonusDesc: '+20% шкоди босам & +15% автокліку (CPS)',
    bonusDescRu: '+20% урона боссам & +15% автоклику (CPS)',
    clickMult: 1.15,
    cpsMult: 1.15,
    energyRegenMult: 1.10,
    bossDamageMult: 1.20,
    goldenChanceMult: 1.10,
    critChance: 0.06,
    tier: 3,
    badge: '🤖 Епічний',
    colorGrad: 'from-purple-900/60 via-fuchsia-950/70 to-stone-900',
    borderColor: 'border-fuchsia-400',
    glowColor: 'rgba(217,70,239,0.35)',
    baseCostFocaccia: 1000000,
    baseCostDiamonds: 70,
  },
  skin_pirate: {
    id: 'skin_pirate',
    name: 'Капітан Фокача',
    nameRu: 'Капитан Фокачча',
    rarity: 'epic',
    img: skinPirateImg,
    desc: 'Гроза кулінарних морів у піратському капелюсі з золотими дублонами та ліхтарем.',
    descRu: 'Гроза кулинарных морей в пиратской треуголке с золотыми дублонами и фонарём.',
    bonusDesc: '+35% шанс Золотої фокачі & +20% сили кліку',
    bonusDescRu: '+35% шанс Золотой фокаччи & +20% силы клика',
    clickMult: 1.20,
    cpsMult: 1.18,
    energyRegenMult: 1.15,
    bossDamageMult: 1.22,
    goldenChanceMult: 1.35,
    critChance: 0.08,
    tier: 3,
    badge: '🏴‍☠️ Епічний',
    colorGrad: 'from-amber-950/80 via-stone-900 to-yellow-950',
    borderColor: 'border-amber-400',
    glowColor: 'rgba(217,119,6,0.4)',
    baseCostFocaccia: 2500000,
    baseCostDiamonds: 90,
  },
  skin_royal: {
    id: 'skin_royal',
    name: 'Королівська Величність',
    nameRu: 'Королевское Величество',
    rarity: 'legendary',
    img: skinRoyalImg,
    desc: 'Монарх пекарського королівства у золотій короні та оксамитовій мантії.',
    descRu: 'Монарх пекарского королевства в золотой короне и бархатной мантии.',
    bonusDesc: '+30% до всього доходу & +25% шанс Золотої фокачі',
    bonusDescRu: '+30% ко всему доходу & +25% шанс Золотой фокаччи',
    clickMult: 1.30,
    cpsMult: 1.30,
    energyRegenMult: 1.20,
    bossDamageMult: 1.25,
    goldenChanceMult: 1.25,
    critChance: 0.10,
    tier: 4,
    badge: '👑 Легендарний',
    colorGrad: 'from-amber-900/60 via-yellow-950/70 to-stone-900',
    borderColor: 'border-amber-400',
    glowColor: 'rgba(251,191,36,0.45)',
    baseCostFocaccia: 10000000,
    baseCostDiamonds: 180,
  },
  skin_cosmic: {
    id: 'skin_cosmic',
    name: 'Космічна Галактика',
    nameRu: 'Космическая Галактика',
    rarity: 'legendary',
    img: skinCosmicImg,
    desc: 'Витвір зоряного пилу та галактичної туманності з мініатюрними планетами на орбіті.',
    descRu: 'Создание звёздной пыли и галактической туманности с миниатюрными планетами на орбите.',
    bonusDesc: '+35% загального CPS & +35% сили кліку',
    bonusDescRu: '+35% общего CPS & +35% силы клика',
    clickMult: 1.35,
    cpsMult: 1.35,
    energyRegenMult: 1.25,
    bossDamageMult: 1.35,
    goldenChanceMult: 1.25,
    critChance: 0.12,
    tier: 4,
    badge: '🌌 Легендарний',
    colorGrad: 'from-indigo-900/60 via-purple-950/70 to-stone-900',
    borderColor: 'border-indigo-400',
    glowColor: 'rgba(99,102,241,0.45)',
    baseCostFocaccia: 20000000,
    baseCostDiamonds: 220,
  },
  skin_demon: {
    id: 'skin_demon',
    name: 'Пекельний Демон',
    nameRu: 'Адский Демон',
    rarity: 'mythic',
    img: skinDemonImg,
    desc: 'Запечений у вулканічній лаві дух полум\'я з вогняними рогами та перцем чилі.',
    descRu: 'Запеченный в вулканической лаве дух пламени с огненными рогами и перцем чили.',
    bonusDesc: '+50% сили кліку в Люті & +15% шанс критичного удару (x3)',
    bonusDescRu: '+50% силы клика в Ярости & +15% шанс критического удара (x3)',
    clickMult: 1.35,
    cpsMult: 1.25,
    energyRegenMult: 1.25,
    bossDamageMult: 1.40,
    goldenChanceMult: 1.30,
    critChance: 0.15,
    tier: 5,
    badge: '🔥 Міфічний',
    colorGrad: 'from-red-950/70 via-rose-950/80 to-stone-900',
    borderColor: 'border-rose-500',
    glowColor: 'rgba(244,63,94,0.5)',
    baseCostFocaccia: 75000000,
    baseCostDiamonds: 400,
  },
  skin_gold: {
    id: 'skin_gold',
    name: 'Золотий Моноліт',
    nameRu: 'Золотой Монолит',
    rarity: 'mythic',
    img: skinGoldImg,
    desc: 'Божественна фокача з 24-каратного монолітного золота з сяючими рубінами та діамантами.',
    descRu: 'Божественная фокачча из 24-каратного монолитного золота с сияющими рубинами и алмазами.',
    bonusDesc: '+50% до кліку, +45% до CPS & +20% шанс криту (x4)',
    bonusDescRu: '+50% к клику, +45% к CPS & +20% шанс крита (x4)',
    clickMult: 1.50,
    cpsMult: 1.45,
    energyRegenMult: 1.40,
    bossDamageMult: 1.50,
    goldenChanceMult: 1.50,
    critChance: 0.20,
    tier: 5,
    badge: '👑 Міфічний',
    colorGrad: 'from-amber-500/30 via-yellow-600/30 to-amber-950/80',
    borderColor: 'border-yellow-300',
    glowColor: 'rgba(250,204,21,0.6)',
    baseCostFocaccia: 150000000,
    baseCostDiamonds: 500,
  },
};

export const SKIN_LIST = Object.values(SKINS);

// ===== 🎁 CASES DEFINITION =====

export interface CaseDrop {
  skinId: string;
  weight: number; // probability weight
}

export interface CaseItem {
  id: string;
  name: string;
  nameRu: string;
  desc: string;
  descRu: string;
  icon: string;
  priceType: 'focaccia' | 'diamonds';
  price: number;
  drops: CaseDrop[];
  gradient: string;
  border: string;
  glow: string;
  badge: string;
}

export const CASES: CaseItem[] = [
  {
    id: 'case_bakery',
    name: 'Пекарська Скриня',
    nameRu: 'Пекарский Сундук',
    desc: 'Базова дерев’яна скриня з ароматом свіжої здоби та шанс на епічний кібер-смак.',
    descRu: 'Базовый деревянный сундук с ароматом свежей выпечки и шанс на эпический кибер-вкус.',
    icon: '🥖',
    priceType: 'focaccia',
    price: 5000000,
    drops: [
      { skinId: 'skin_classic', weight: 42 },
      { skinId: 'skin_samurai', weight: 26 },
      { skinId: 'skin_frost', weight: 20 },
      { skinId: 'skin_chef', weight: 10 },
      { skinId: 'skin_cyber', weight: 2 },
    ],
    gradient: 'from-amber-950/70 via-stone-900 to-amber-900/60',
    border: 'border-amber-600/60',
    glow: 'rgba(217,119,6,0.3)',
    badge: '🍞 Старт',
  },
  {
    id: 'case_empire',
    name: 'Імперська Скриня',
    nameRu: 'Имперский Сундук',
    desc: 'Кована золотом скриня з королівської скарбниці з високим шансом на рідкісні скіни.',
    descRu: 'Кованый золотом сундук из королевской сокровищницы с высоким шансом на редкие скины.',
    icon: '👑',
    priceType: 'focaccia',
    price: 50000000,
    drops: [
      { skinId: 'skin_chef', weight: 30 },
      { skinId: 'skin_samurai', weight: 28 },
      { skinId: 'skin_pirate', weight: 22 },
      { skinId: 'skin_cyber', weight: 14 },
      { skinId: 'skin_royal', weight: 6 },
    ],
    gradient: 'from-yellow-950/70 via-stone-900 to-amber-900/70',
    border: 'border-yellow-500/60',
    glow: 'rgba(234,179,8,0.35)',
    badge: '⚜️ Еліт',
  },
  {
    id: 'case_diamond',
    name: 'Діамантовий Сейф',
    nameRu: 'Алмазный Сейф',
    desc: 'Високотехнологічний кристал-сейф з гарантованим епічним або легендарним лутом.',
    descRu: 'Высокотехнологичный кристалл-сейф с гарантированным эпическим или легендарным лутом.',
    icon: '💎',
    priceType: 'diamonds',
    price: 35,
    drops: [
      { skinId: 'skin_cyber', weight: 30 },
      { skinId: 'skin_pirate', weight: 28 },
      { skinId: 'skin_royal', weight: 22 },
      { skinId: 'skin_cosmic', weight: 15 },
      { skinId: 'skin_demon', weight: 5 },
    ],
    gradient: 'from-cyan-950/80 via-blue-950/70 to-stone-900',
    border: 'border-cyan-400/60',
    glow: 'rgba(6,182,212,0.4)',
    badge: '💎 Преміум',
  },
  {
    id: 'case_celestial',
    name: 'Небесна Капсула',
    nameRu: 'Небесная Капсула',
    desc: 'Орбітальна капсула зоряної енергії з найвищим шансом на Міфічні шедеври!',
    descRu: 'Орбитальная капсула звёздной энергии с высочайшим шансом на Мифические шедевры!',
    icon: '🌌',
    priceType: 'diamonds',
    price: 85,
    drops: [
      { skinId: 'skin_pirate', weight: 22 },
      { skinId: 'skin_royal', weight: 28 },
      { skinId: 'skin_cosmic', weight: 26 },
      { skinId: 'skin_demon', weight: 15 },
      { skinId: 'skin_gold', weight: 9 },
    ],
    gradient: 'from-purple-950/80 via-indigo-950/80 to-stone-900',
    border: 'border-purple-400/70',
    glow: 'rgba(168,85,247,0.5)',
    badge: '🌌 Легенда',
  },
];

/** Розрахунок випадкового дропу з кейса */
export function rollCaseDrop(c: CaseItem): SkinItem {
  const totalWeight = c.drops.reduce((acc, d) => acc + d.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const drop of c.drops) {
    if (rand <= drop.weight) {
      return SKINS[drop.skinId] || SKINS.skin_classic;
    }
    rand -= drop.weight;
  }

  const lastDrop = c.drops[c.drops.length - 1];
  return SKINS[lastDrop?.skinId || 'skin_classic'] || SKINS.skin_classic;
}

/** Рівень скіна (1..5) */
export function getSkinLevel(skinId: string, levels?: Record<string, number>): number {
  if (!levels || !levels[skinId]) return 1;
  return Math.max(1, Math.min(5, Math.floor(levels[skinId])));
}

/** Множник бонусу скіна від його рівня (+15% за кожен рівень вище 1-го) */
export function getSkinLevelMultiplier(level: number): number {
  return 1 + (Math.max(1, Math.min(5, level)) - 1) * 0.15;
}

/** Вартість покращення рівня скіна вручну */
export function getSkinLevelUpgradeCost(skin: SkinItem, currentLevel: number): { focaccia: number; diamonds: number } | null {
  if (currentLevel >= 5) return null; // Max level
  const tierCostMult = Math.pow(skin.tier, 2);
  const lvlMult = Math.pow(currentLevel, 1.8);

  const baseFocaccia = skin.baseCostFocaccia > 0 ? skin.baseCostFocaccia * 0.5 : 500000;
  const baseDiamonds = skin.baseCostDiamonds > 0 ? Math.ceil(skin.baseCostDiamonds * 0.3) : 5;

  return {
    focaccia: Math.round(baseFocaccia * lvlMult * (tierCostMult * 0.5)),
    diamonds: Math.round(baseDiamonds * lvlMult),
  };
}

/** Розрахунок шансу в апгрейдері */
export function calculateUpgradeChance(
  sourceSkin: SkinItem,
  targetSkin: SkinItem,
  boostDiamonds: number = 0
): { baseChance: number; boostChance: number; totalChance: number } {
  const tierDiff = targetSkin.tier - sourceSkin.tier;
  let baseChance = 50;

  if (tierDiff <= 0) {
    baseChance = 75;
  } else if (tierDiff === 1) {
    if (targetSkin.tier === 2) baseChance = 50; // common -> rare
    else if (targetSkin.tier === 3) baseChance = 35; // rare -> epic
    else if (targetSkin.tier === 4) baseChance = 22; // epic -> legendary
    else if (targetSkin.tier === 5) baseChance = 12; // legendary -> mythic
  } else if (tierDiff === 2) {
    if (targetSkin.tier === 3) baseChance = 22;
    else if (targetSkin.tier === 4) baseChance = 14;
    else if (targetSkin.tier === 5) baseChance = 7;
  } else if (tierDiff === 3) {
    baseChance = targetSkin.tier === 5 ? 4 : 8;
  } else {
    baseChance = 3;
  }

  // Буст алмазами: кожен 1 алмаз додає ~0.5% шансу, максимум +40%
  const boostChance = Math.min(40, boostDiamonds * 0.5);
  const totalChance = Math.min(85, Math.max(1, Math.round((baseChance + boostChance) * 10) / 10));

  return { baseChance, boostChance, totalChance };
}
