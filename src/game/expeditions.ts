export interface ExpeditionLocation {
  id: string;
  nameUk: string;
  nameRu: string;
  descUk: string;
  descRu: string;
  icon: string;
  baseDurationMs: number;
  requiredCatLevel: number;
  guaranteedIngredients: { id: string; count: number }[];
  possibleLoot: {
    diamondsMin: number;
    diamondsMax: number;
    passXp: number;
    focacciaBase: number;
    bonusIngredientChance: { id: string; chance: number; count: number };
  };
  color: string;
  bannerBg: string;
}

export const EXPEDITION_LOCATIONS: ExpeditionLocation[] = [
  {
    id: 'whispering_woods',
    nameUk: 'Шепітний Ліс',
    nameRu: 'Шепчущий Лес',
    descUk: 'Затишний ліс біля пекарні, порослий пахучим розмарином та диким базиліком.',
    descRu: 'Уютный лес возле пекарни, заросший пахучим розмарином и диким базиликом.',
    icon: '🌲',
    baseDurationMs: 10 * 60 * 1000, // 10 minutes
    requiredCatLevel: 1,
    guaranteedIngredients: [
      { id: 'mystic_basil', count: 3 },
      { id: 'moon_honey', count: 1 },
    ],
    possibleLoot: {
      diamondsMin: 0,
      diamondsMax: 1,
      passXp: 15,
      focacciaBase: 25000,
      bonusIngredientChance: { id: 'star_yeast', chance: 0.35, count: 1 },
    },
    color: '#10b981',
    bannerBg: 'from-emerald-950/60 to-emerald-900/20',
  },
  {
    id: 'sunken_mill',
    nameUk: 'Затонулий Млин',
    nameRu: 'Затонувшая Мельница',
    descUk: 'Старовинний млин посеред чистого гірського озера, де зберігаються зоряні дріжджі.',
    descRu: 'Старинная мельница посреди чистого горного озера, где хранятся звёздные дрожжи.',
    icon: '💧',
    baseDurationMs: 30 * 60 * 1000, // 30 minutes
    requiredCatLevel: 2,
    guaranteedIngredients: [
      { id: 'star_yeast', count: 3 },
      { id: 'moon_honey', count: 2 },
    ],
    possibleLoot: {
      diamondsMin: 1,
      diamondsMax: 3,
      passXp: 35,
      focacciaBase: 120000,
      bonusIngredientChance: { id: 'volcano_olive', chance: 0.4, count: 2 },
    },
    color: '#06b6d4',
    bannerBg: 'from-cyan-950/60 to-blue-900/20',
  },
  {
    id: 'volcano_peak',
    nameUk: 'Вулканічний Пік',
    nameRu: 'Вулканический Пик',
    descUk: 'Жаркі лавові схили, на яких ростуть знамениті вогнетривкі вулканічні оливки.',
    descRu: 'Жаркие лавовые склоны, на которых растут знаменитые огнеупорные вулканические оливки.',
    icon: '🌋',
    baseDurationMs: 90 * 60 * 1000, // 90 minutes
    requiredCatLevel: 3,
    guaranteedIngredients: [
      { id: 'volcano_olive', count: 4 },
      { id: 'star_yeast', count: 2 },
    ],
    possibleLoot: {
      diamondsMin: 2,
      diamondsMax: 6,
      passXp: 70,
      focacciaBase: 500000,
      bonusIngredientChance: { id: 'truffle', chance: 0.35, count: 1 },
    },
    color: '#f97316',
    bannerBg: 'from-orange-950/60 to-red-900/20',
  },
  {
    id: 'astral_bakery',
    nameUk: 'Астральна Пекарня',
    nameRu: 'Астральная Пекарня',
    descUk: 'Таємна космічна пекарня серед зірок, де ростуть містичні Золоті Трюфелі.',
    descRu: 'Тайная космическая пекарня среди звёзд, где растут мистические Золотые Трюфели.',
    icon: '🌌',
    baseDurationMs: 4 * 60 * 60 * 1000, // 4 hours
    requiredCatLevel: 4,
    guaranteedIngredients: [
      { id: 'truffle', count: 3 },
      { id: 'volcano_olive', count: 4 },
      { id: 'star_yeast', count: 4 },
    ],
    possibleLoot: {
      diamondsMin: 5,
      diamondsMax: 15,
      passXp: 150,
      focacciaBase: 2500000,
      bonusIngredientChance: { id: 'truffle', chance: 0.7, count: 2 },
    },
    color: '#a855f7',
    bannerBg: 'from-purple-950/60 to-indigo-900/20',
  },
];

export interface ActiveExpedition {
  locationId: string;
  startTime: number;
  durationMs: number;
  completed?: boolean;
}

export function getCatExpeditionDuration(baseDurationMs: number, catLevel: number): number {
  // Higher cat level speeds up expeditions
  let speedMultiplier = 1;
  if (catLevel >= 5) speedMultiplier = 0.55; // 45% faster
  else if (catLevel >= 4) speedMultiplier = 0.70; // 30% faster
  else if (catLevel >= 3) speedMultiplier = 0.80; // 20% faster
  else if (catLevel >= 2) speedMultiplier = 0.90; // 10% faster
  return Math.floor(baseDurationMs * speedMultiplier);
}

export function generateExpeditionRewards(
  location: ExpeditionLocation,
  catLevel: number
): {
  focaccia: number;
  diamonds: number;
  passXp: number;
  ingredients: Record<string, number>;
} {
  const lootMultiplier = 1 + Math.max(0, catLevel - 1) * 0.25;
  const ingredients: Record<string, number> = {};

  for (const item of location.guaranteedIngredients) {
    ingredients[item.id] = Math.ceil(item.count * lootMultiplier);
  }

  if (Math.random() <= location.possibleLoot.bonusIngredientChance.chance) {
    const bonus = location.possibleLoot.bonusIngredientChance;
    ingredients[bonus.id] = (ingredients[bonus.id] || 0) + bonus.count;
  }

  const diaRange = location.possibleLoot.diamondsMax - location.possibleLoot.diamondsMin;
  const rawDia = location.possibleLoot.diamondsMin + Math.floor(Math.random() * (diaRange + 1));
  const diamonds = Math.ceil(rawDia * (catLevel >= 4 ? 1.5 : 1));

  const focaccia = Math.floor(location.possibleLoot.focacciaBase * lootMultiplier);
  const passXp = Math.floor(location.possibleLoot.passXp * lootMultiplier);

  return { focaccia, diamonds, passXp, ingredients };
}
