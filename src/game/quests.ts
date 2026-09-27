export type QuestType =
  | 'clicks'
  | 'golden'
  | 'bosses'
  | 'pests'
  | 'pet_cat'
  | 'casino'
  | 'focaccia_earn'
  | 'combo';

export interface DailyQuest {
  id: string;
  type: QuestType;
  title: { uk: string; ru: string };
  desc: { uk: string; ru: string };
  icon: string;
  target: number;
  progress: number;
  rewardFocaccia: number;
  rewardDiamonds: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

export interface PassTier {
  tier: number;
  requiredXp: number;
  freeReward: {
    type: 'focaccia' | 'diamonds' | 'repair_kit' | 'case';
    amount?: number;
    caseId?: string;
    label: { uk: string; ru: string };
    icon: string;
  };
  vipReward: {
    type: 'focaccia' | 'diamonds' | 'repair_kit' | 'case' | 'frame';
    amount?: number;
    caseId?: string;
    frameId?: string;
    label: { uk: string; ru: string };
    icon: string;
  };
}

export interface QuestsState {
  date: string; // YYYY-MM-DD
  daily: DailyQuest[];
  passXp: number;
  claimedFree: number[]; // tier numbers
  claimedVip: number[];
  vipUnlocked?: boolean;
}

export const PASS_TIERS_COUNT = 15;
export const XP_PER_TIER = 100;

export const BAKER_PASS_TIERS: PassTier[] = [
  {
    tier: 1,
    requiredXp: 100,
    freeReward: { type: 'focaccia', amount: 25000, label: { uk: '25,000 Фокач', ru: '25,000 Фокачч' }, icon: '🫓' },
    vipReward: { type: 'diamonds', amount: 15, label: { uk: '15 Діамантів', ru: '15 Алмазов' }, icon: '💎' },
  },
  {
    tier: 2,
    requiredXp: 200,
    freeReward: { type: 'diamonds', amount: 3, label: { uk: '3 Діаманти', ru: '3 Алмаза' }, icon: '💎' },
    vipReward: { type: 'repair_kit', amount: 5, label: { uk: '5 Ремкомплектів', ru: '5 Ремкомплектов' }, icon: '🔧' },
  },
  {
    tier: 3,
    requiredXp: 300,
    freeReward: { type: 'repair_kit', amount: 2, label: { uk: '2 Ремкомплекти', ru: '2 Ремкомплекта' }, icon: '🔧' },
    vipReward: { type: 'diamonds', amount: 25, label: { uk: '25 Діамантів', ru: '25 Алмазов' }, icon: '💎' },
  },
  {
    tier: 4,
    requiredXp: 400,
    freeReward: { type: 'focaccia', amount: 100000, label: { uk: '100,000 Фокач', ru: '100,000 Фокачч' }, icon: '🫓' },
    vipReward: { type: 'case', caseId: 'case_bakery', label: { uk: 'Пекарська Скриня', ru: 'Пекарский Сундук' }, icon: '🥖' },
  },
  {
    tier: 5,
    requiredXp: 500,
    freeReward: { type: 'diamonds', amount: 5, label: { uk: '5 Діамантів', ru: '5 Алмазов' }, icon: '💎' },
    vipReward: { type: 'diamonds', amount: 35, label: { uk: '35 Діамантів', ru: '35 Алмазов' }, icon: '💎' },
  },
  {
    tier: 6,
    requiredXp: 600,
    freeReward: { type: 'repair_kit', amount: 3, label: { uk: '3 Ремкомплекти', ru: '3 Ремкомплекта' }, icon: '🔧' },
    vipReward: { type: 'focaccia', amount: 500000, label: { uk: '500,000 Фокач', ru: '500,000 Фокачч' }, icon: '🫓' },
  },
  {
    tier: 7,
    requiredXp: 700,
    freeReward: { type: 'focaccia', amount: 250000, label: { uk: '250,000 Фокач', ru: '250,000 Фокачч' }, icon: '🫓' },
    vipReward: { type: 'case', caseId: 'case_arcade', label: { uk: 'Неонова Аркада', ru: 'Неоновая Аркада' }, icon: '🕹️' },
  },
  {
    tier: 8,
    requiredXp: 800,
    freeReward: { type: 'diamonds', amount: 8, label: { uk: '8 Діамантів', ru: '8 Алмазов' }, icon: '💎' },
    vipReward: { type: 'diamonds', amount: 50, label: { uk: '50 Діамантів', ru: '50 Алмазов' }, icon: '💎' },
  },
  {
    tier: 9,
    requiredXp: 900,
    freeReward: { type: 'repair_kit', amount: 5, label: { uk: '5 Ремкомплектів', ru: '5 Ремкомплектов' }, icon: '🔧' },
    vipReward: { type: 'repair_kit', amount: 12, label: { uk: '12 Ремкомплектів', ru: '12 Ремкомплектов' }, icon: '🧰' },
  },
  {
    tier: 10,
    requiredXp: 1000,
    freeReward: { type: 'case', caseId: 'case_nature', label: { uk: 'Лісова Скриня', ru: 'Лесной Сундук' }, icon: '🌲' },
    vipReward: { type: 'case', caseId: 'case_diamond', label: { uk: 'Діамантовий Сейф', ru: 'Алмазный Сейф' }, icon: '💠' },
  },
  {
    tier: 11,
    requiredXp: 1100,
    freeReward: { type: 'diamonds', amount: 12, label: { uk: '12 Діамантів', ru: '12 Алмазов' }, icon: '💎' },
    vipReward: { type: 'diamonds', amount: 75, label: { uk: '75 Діамантів', ru: '75 Алмазов' }, icon: '💎' },
  },
  {
    tier: 12,
    requiredXp: 1200,
    freeReward: { type: 'focaccia', amount: 1000000, label: { uk: '1,000,000 Фокач', ru: '1,000,000 Фокачч' }, icon: '🫓' },
    vipReward: { type: 'case', caseId: 'case_celestial', label: { uk: 'Небесна Капсула', ru: 'Небесная Капсула' }, icon: '✨' },
  },
  {
    tier: 13,
    requiredXp: 1300,
    freeReward: { type: 'repair_kit', amount: 8, label: { uk: '8 Ремкомплектів', ru: '8 Ремкомплектов' }, icon: '🔧' },
    vipReward: { type: 'diamonds', amount: 100, label: { uk: '100 Діамантів', ru: '100 Алмазов' }, icon: '💎' },
  },
  {
    tier: 14,
    requiredXp: 1400,
    freeReward: { type: 'case', caseId: 'case_empire', label: { uk: 'Імперська Скриня', ru: 'Имперский Сундук' }, icon: '👑' },
    vipReward: { type: 'case', caseId: 'case_abyss', label: { uk: 'Скриня Безодні', ru: 'Сундук Бездны' }, icon: '🔮' },
  },
  {
    tier: 15,
    requiredXp: 1500,
    freeReward: { type: 'diamonds', amount: 30, label: { uk: '30 Діамантів', ru: '30 Алмазов' }, icon: '💎' },
    vipReward: { type: 'frame', frameId: 'frame_gold_crown', label: { uk: 'Королівське Золото', ru: 'Королевское Золото' }, icon: '👑' },
  },
];

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateDailyQuests(totalBaked: number = 0, prestige: number = 0): DailyQuest[] {
  const isExperienced = totalBaked > 50000 || prestige > 0;
  const isMaster = totalBaked > 5000000 || prestige > 2;

  const questPool: DailyQuest[] = [
    {
      id: 'q_click',
      type: 'clicks',
      title: { uk: 'Швидкі Пальці', ru: 'Быстрые Пальцы' },
      desc: { uk: 'Зроби 400 кліків по фокачі', ru: 'Сделай 400 кликов по фокачче' },
      icon: '👆',
      target: 400,
      progress: 0,
      rewardFocaccia: 15000,
      rewardDiamonds: 1,
      rewardXp: 35,
      completed: false,
      claimed: false,
    },
    {
      id: 'q_golden',
      type: 'golden',
      title: { uk: 'Ловець Удачі', ru: 'Ловец Удачи' },
      desc: { uk: 'Спіймай 2 золоті, алмазні або смарагдові фокачі', ru: 'Поймай 2 золотые, алмазные или изумрудные фокаччи' },
      icon: '✨',
      target: 2,
      progress: 0,
      rewardFocaccia: 25000,
      rewardDiamonds: 2,
      rewardXp: 40,
      completed: false,
      claimed: false,
    },
    {
      id: 'q_boss',
      type: 'bosses',
      title: { uk: 'Захисник Пекарні', ru: 'Защитник Пекарни' },
      desc: { uk: 'Переможи хоча б 1 боса', ru: 'Победи хотя бы 1 босса' },
      icon: '⚔️',
      target: 1,
      progress: 0,
      rewardFocaccia: 35000,
      rewardDiamonds: 3,
      rewardXp: 45,
      completed: false,
      claimed: false,
    },
    {
      id: 'q_pest',
      type: 'pests',
      title: { uk: 'Санітарний Контроль', ru: 'Санитарный Контроль' },
      desc: { uk: 'Розчави 3 шкідників', ru: 'Раздави 3 вредителей' },
      icon: '🪳',
      target: 3,
      progress: 0,
      rewardFocaccia: 20000,
      rewardDiamonds: 2,
      rewardXp: 35,
      completed: false,
      claimed: false,
    },
    {
      id: 'q_pet',
      type: 'pet_cat',
      title: { uk: 'Муркотлива Радість', ru: 'Мурчащая Радость' },
      desc: { uk: 'Погладь котика Мурчика 5 разів', ru: 'Погладь котика Мурчика 5 раз' },
      icon: '😸',
      target: 5,
      progress: 0,
      rewardFocaccia: 10000,
      rewardDiamonds: 1,
      rewardXp: 30,
      completed: false,
      claimed: false,
    },
    {
      id: 'q_casino',
      type: 'casino',
      title: { uk: 'Азартний Пекар', ru: 'Азартный Пекарь' },
      desc: { uk: 'Зіграй 3 рази в будь-яку гру казино', ru: 'Сыграй 3 раза в любую игру казино' },
      icon: '🎰',
      target: 3,
      progress: 0,
      rewardFocaccia: 20000,
      rewardDiamonds: 2,
      rewardXp: 35,
      completed: false,
      claimed: false,
    },
    {
      id: 'q_combo',
      type: 'combo',
      title: { uk: 'Майстер Ритму', ru: 'Мастер Ритма' },
      desc: { uk: 'Набери комбо x30 або вище', ru: 'Набери комбо x30 или выше' },
      icon: '⚡',
      target: 30,
      progress: 0,
      rewardFocaccia: 18000,
      rewardDiamonds: 2,
      rewardXp: 35,
      completed: false,
      claimed: false,
    },
  ];

  const today = getTodayKey();
  let seed = 0;
  for (let i = 0; i < today.length; i++) {
    seed = (seed * 31 + today.charCodeAt(i)) % 1000000;
  }

  const poolCopy = [...questPool];
  const selected: DailyQuest[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = (seed + i * 7) % poolCopy.length;
    const [picked] = poolCopy.splice(idx, 1);
    
    if (isMaster) {
      picked.rewardFocaccia *= 10;
      picked.rewardDiamonds += 1;
    } else if (isExperienced) {
      picked.rewardFocaccia *= 3;
    }
    selected.push(picked);
  }

  return selected;
}

export function ensureQuestsState(current?: QuestsState, totalBaked = 0, prestige = 0): QuestsState {
  const today = getTodayKey();
  if (!current || current.date !== today || !Array.isArray(current.daily) || current.daily.length === 0) {
    return {
      date: today,
      daily: generateDailyQuests(totalBaked, prestige),
      passXp: current?.passXp || 0,
      claimedFree: current?.claimedFree || [],
      claimedVip: current?.claimedVip || [],
      vipUnlocked: current?.vipUnlocked || false,
    };
  }
  return current;
}
