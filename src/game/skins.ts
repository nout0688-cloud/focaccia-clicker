import focacciaImg from '../assets/focaccia.png';
import skinChefImg from '../assets/skins/skin_chef.jpg';
import skinCyberImg from '../assets/skins/skin_cyber.jpg';
import skinRoyalImg from '../assets/skins/skin_royal.jpg';
import skinDemonImg from '../assets/skins/skin_demon.jpg';

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

export const RARITY_LABELS: Record<SkinRarity, { uk: string; ru: string; color: string; border: string }> = {
  common: { uk: 'Звичайний', ru: 'Обычный', color: 'text-stone-300 bg-stone-800/80', border: 'border-stone-600' },
  rare: { uk: 'Рідкісний', ru: 'Редкий', color: 'text-blue-300 bg-blue-900/60', border: 'border-blue-500' },
  epic: { uk: 'Епічний', ru: 'Эпический', color: 'text-fuchsia-300 bg-purple-900/60', border: 'border-fuchsia-500' },
  legendary: { uk: 'Легендарний', ru: 'Легендарный', color: 'text-amber-300 bg-amber-950/70', border: 'border-amber-400' },
  mythic: { uk: 'Міфічний', ru: 'Мифический', color: 'text-rose-300 bg-rose-950/70', border: 'border-rose-500' },
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
};

export const SKIN_LIST = Object.values(SKINS);

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
