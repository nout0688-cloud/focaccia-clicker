export interface Ingredient {
  id: string;
  nameUk: string;
  nameRu: string;
  icon: string;
  rarity: 'common' | 'rare' | 'legendary';
  descUk: string;
  descRu: string;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  mystic_basil: {
    id: 'mystic_basil',
    nameUk: 'Містичний Базилік',
    nameRu: 'Мистический Базилик',
    icon: '🌿',
    rarity: 'common',
    descUk: 'Ароматне листя з таємничим свіченням, що наповнює тісто силою',
    descRu: 'Ароматные листья с таинственным свечением, наполняющие тесто силой',
  },
  moon_honey: {
    id: 'moon_honey',
    nameUk: 'Місячний Мед',
    nameRu: 'Лунный Мёд',
    icon: '🍯',
    rarity: 'common',
    descUk: 'Солодкий нектар космічних бджіл для ідеальної золотистої скоринки',
    descRu: 'Сладкий нектар космических пчёл для идеальной золотистой корочки',
  },
  star_yeast: {
    id: 'star_yeast',
    nameUk: 'Зоряні Дріжджі',
    nameRu: 'Звёздные Дрожжи',
    icon: '🌾',
    rarity: 'rare',
    descUk: 'Сяючі мікроорганізми, що змушують тісто підійматися втричі швидше',
    descRu: 'Светящиеся микроорганизмы, заставляющие тесто подниматься втрое быстрее',
  },
  volcano_olive: {
    id: 'volcano_olive',
    nameUk: 'Вулканічні Оливки',
    nameRu: 'Вулканические Оливки',
    icon: '🫒',
    rarity: 'rare',
    descUk: 'Вирощені на базальтових схилах вулкана, сповнені первозданного жару',
    descRu: 'Выращены на базальтовых склонах вулкана, полны первозданного жара',
  },
  truffle: {
    id: 'truffle',
    nameUk: 'Золотий Трюфель',
    nameRu: 'Золотой Трюфель',
    icon: '🍄',
    rarity: 'legendary',
    descUk: 'Легендарний дорогоцінний гриб — серце найпотужніших кулінарних зіллів',
    descRu: 'Легендарный драгоценный гриб — сердце мощнейших кулинарных зелий',
  },
};

export interface AlchemyPotion {
  id: string;
  nameUk: string;
  nameRu: string;
  icon: string;
  durationMs: number;
  cost: Record<string, number>;
  effectUk: string;
  effectRu: string;
  cpsMult?: number;
  clickMult?: number;
  goldenChanceMult?: number;
  xpMult?: number;
  frenzyMult?: number;
}

export const ALCHEMY_POTIONS: AlchemyPotion[] = [
  {
    id: 'yeast_overdrive',
    nameUk: 'Дріжджовий Овердрайв',
    nameRu: 'Дрожжевой Овердрайв',
    icon: '⚡',
    durationMs: 15 * 60 * 1000, // 15 mins
    cost: { star_yeast: 3, mystic_basil: 2 },
    effectUk: 'x3 до загального CPS пекарні на 15 хв',
    effectRu: 'x3 к общему CPS пекарни на 15 мин',
    cpsMult: 3,
  },
  {
    id: 'golden_touch',
    nameUk: 'Золотий Дотик',
    nameRu: 'Золотое Прикосновение',
    icon: '✨',
    durationMs: 20 * 60 * 1000, // 20 mins
    cost: { volcano_olive: 2, moon_honey: 3, truffle: 1 },
    effectUk: 'Золоті фокачі з’являються в 3x частіше та дають x2 нагороду',
    effectRu: 'Золотые фокаччи появляются в 3x чаще и дают x2 награду',
    goldenChanceMult: 3,
  },
  {
    id: 'aroma_overload',
    nameUk: 'Критичний Аромат',
    nameRu: 'Критический Аромат',
    icon: '💥',
    durationMs: 12 * 60 * 1000, // 12 mins
    cost: { mystic_basil: 4, volcano_olive: 2 },
    effectUk: 'Сила кліку x4 та 100% шанс критичного тапу на 12 хв',
    effectRu: 'Сила клика x4 и 100% шанс критического тапа на 12 мин',
    clickMult: 4,
  },
  {
    id: 'cosmic_ferment',
    nameUk: 'Космічне Бродіння',
    nameRu: 'Космическое Брожение',
    icon: '🌌',
    durationMs: 30 * 60 * 1000, // 30 mins
    cost: { truffle: 2, star_yeast: 2, moon_honey: 3 },
    effectUk: '+100% досвіду (x2 XP) до Baker Pass на 30 хв',
    effectRu: '+100% опыта (x2 XP) к Baker Pass на 30 мин',
    xpMult: 2,
  },
  {
    id: 'frenzy_inferno',
    nameUk: 'Вічний Екстаз Френзі',
    nameRu: 'Вечный Экстаз Френзи',
    icon: '🔥',
    durationMs: 20 * 60 * 1000, // 20 mins
    cost: { volcano_olive: 3, star_yeast: 3, truffle: 1 },
    effectUk: 'Френзі дає x10 (замість x6) та триває довше',
    effectRu: 'Френзи даёт x10 (вместо x6) и длится дольше',
    frenzyMult: 10,
  },
];

export interface AlchemyState {
  ingredients: Record<string, number>;
  buffs: Record<string, number>; // potionId -> timestamp expiresAt
}

export function getDefaultAlchemyState(): AlchemyState {
  return {
    ingredients: {
      mystic_basil: 2,
      moon_honey: 1,
      star_yeast: 1,
      volcano_olive: 0,
      truffle: 0,
    },
    buffs: {},
  };
}

export function isBuffActive(buffs: Record<string, number> | undefined, id: string): boolean {
  if (!buffs || !buffs[id]) return false;
  return buffs[id] > Date.now();
}

export function getBuffRemainingMs(buffs: Record<string, number> | undefined, id: string): number {
  if (!buffs || !buffs[id]) return 0;
  return Math.max(0, buffs[id] - Date.now());
}

export function formatDurationMmSs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function canBrewPotion(
  potion: AlchemyPotion,
  ingredients: Record<string, number> = {}
): boolean {
  for (const [ingId, count] of Object.entries(potion.cost)) {
    if ((ingredients[ingId] || 0) < count) return false;
  }
  return true;
}
