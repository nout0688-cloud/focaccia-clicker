export interface DivisionInfo {
  division: number;
  nameUk: string;
  nameRu: string;
  badge: string;
  color: string;
  bgGradient: string;
  promoteTop: number; // e.g. top 3 get promoted
  demoteBottom: number; // e.g. bottom 5 get demoted
  rewards: {
    top1: { diamonds: number; passXp: number; label: string };
    top2: { diamonds: number; passXp: number; label: string };
    top3: { diamonds: number; passXp: number; label: string };
    safe: { diamonds: number; passXp: number; label: string };
  };
}

export const DIVISIONS: DivisionInfo[] = [
  {
    division: 0,
    nameUk: 'Бронзова Ліга',
    nameRu: 'Бронзовая Лига',
    badge: '🥉',
    color: '#cd7f32',
    bgGradient: 'from-amber-950/40 via-stone-900/40 to-stone-950/60',
    promoteTop: 3,
    demoteBottom: 0, // No demotion from Bronze
    rewards: {
      top1: { diamonds: 30, passXp: 100, label: '30 💎 + 100 XP' },
      top2: { diamonds: 20, passXp: 70, label: '20 💎 + 70 XP' },
      top3: { diamonds: 15, passXp: 50, label: '15 💎 + 50 XP' },
      safe: { diamonds: 5, passXp: 20, label: '5 💎 + 20 XP' },
    },
  },
  {
    division: 1,
    nameUk: 'Срібна Ліга',
    nameRu: 'Серебряная Лига',
    badge: '🥈',
    color: '#94a3b8',
    bgGradient: 'from-slate-900/60 via-slate-800/40 to-slate-950/60',
    promoteTop: 3,
    demoteBottom: 4,
    rewards: {
      top1: { diamonds: 50, passXp: 150, label: '50 💎 + 150 XP' },
      top2: { diamonds: 35, passXp: 110, label: '35 💎 + 110 XP' },
      top3: { diamonds: 25, passXp: 80, label: '25 💎 + 80 XP' },
      safe: { diamonds: 10, passXp: 35, label: '10 💎 + 35 XP' },
    },
  },
  {
    division: 2,
    nameUk: 'Золота Ліга',
    nameRu: 'Золотая Лига',
    badge: '🥇',
    color: '#eab308',
    bgGradient: 'from-amber-900/50 via-yellow-950/40 to-stone-950/60',
    promoteTop: 3,
    demoteBottom: 5,
    rewards: {
      top1: { diamonds: 80, passXp: 220, label: '80 💎 + 220 XP' },
      top2: { diamonds: 60, passXp: 160, label: '60 💎 + 160 XP' },
      top3: { diamonds: 40, passXp: 120, label: '40 💎 + 120 XP' },
      safe: { diamonds: 15, passXp: 50, label: '15 💎 + 50 XP' },
    },
  },
  {
    division: 3,
    nameUk: 'Рубінова Ліга',
    nameRu: 'Рубиновая Лига',
    badge: '💎',
    color: '#f43f5e',
    bgGradient: 'from-rose-950/60 via-red-950/40 to-stone-950/60',
    promoteTop: 3,
    demoteBottom: 5,
    rewards: {
      top1: { diamonds: 130, passXp: 320, label: '130 💎 + 320 XP' },
      top2: { diamonds: 95, passXp: 240, label: '95 💎 + 240 XP' },
      top3: { diamonds: 70, passXp: 180, label: '70 💎 + 180 XP' },
      safe: { diamonds: 25, passXp: 75, label: '25 💎 + 75 XP' },
    },
  },
  {
    division: 4,
    nameUk: 'Ліга Майстрів',
    nameRu: 'Лига Мастеров',
    badge: '👑',
    color: '#a855f7',
    bgGradient: 'from-purple-950/60 via-indigo-950/40 to-stone-950/60',
    promoteTop: 2,
    demoteBottom: 5,
    rewards: {
      top1: { diamonds: 200, passXp: 450, label: '200 💎 + 450 XP' },
      top2: { diamonds: 150, passXp: 350, label: '150 💎 + 350 XP' },
      top3: { diamonds: 100, passXp: 250, label: '100 💎 + 250 XP' },
      safe: { diamonds: 40, passXp: 100, label: '40 💎 + 100 XP' },
    },
  },
  {
    division: 5,
    nameUk: 'Бог Пекарів',
    nameRu: 'Бог Пекарей',
    badge: '⚡',
    color: '#38bdf8',
    bgGradient: 'from-sky-950/60 via-cyan-950/40 to-stone-950/60',
    promoteTop: 0, // Highest tier!
    demoteBottom: 5,
    rewards: {
      top1: { diamonds: 350, passXp: 700, label: '350 💎 + 700 XP' },
      top2: { diamonds: 250, passXp: 500, label: '250 💎 + 500 XP' },
      top3: { diamonds: 180, passXp: 380, label: '180 💎 + 380 XP' },
      safe: { diamonds: 60, passXp: 150, label: '60 💎 + 150 XP' },
    },
  },
];

export interface WeeklyRewardPending {
  weekId: string;
  division: number;
  finalRank: number;
  diamonds: number;
  passXp: number;
  status: 'promoted' | 'demoted' | 'retained';
}

export interface LeagueState {
  division: number;
  weeklyScore: number;
  weekId: string;
  claimedWeekId?: string;
  pendingReward?: WeeklyRewardPending | null;
}

export interface LeagueCompetitor {
  id: string;
  name: string;
  score: number;
  avatar: string;
  isPlayer?: boolean;
}

export function getCurrentWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week: week starts on Monday (1) and ends on Sunday (7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekRemainingMs(now: Date = new Date()): number {
  const day = now.getUTCDay() || 7; // Monday = 1, ..., Sunday = 7
  const daysUntilSundayEnd = 7 - day;
  const nextSunday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSundayEnd,
    23, 59, 59, 999
  ));
  return Math.max(0, nextSunday.getTime() - now.getTime());
}

export function formatTimeRemaining(ms: number, lang: 'uk' | 'ru' = 'uk'): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / (24 * 3600));
  const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  if (days > 0) {
    return lang === 'uk' ? `${days} дн. ${hours} год.` : `${days} дн. ${hours} ч.`;
  }
  return lang === 'uk' ? `${hours} год. ${mins} хв.` : `${hours} ч. ${mins} мин.`;
}

const BOT_NAMES = [
  'Тарас Шевченко', 'Олена_Baker', 'Максим Круасан', 'Марія Фокачча', 'Дмитро_Тісто',
  'Вікторія Піч', 'Bogdan_Oven', 'Анна_Розмарин', 'Іван_Пекар', 'КітМурчик_фан',
  'Chef_Antonio', 'DoughMaster99', 'BakerPro', 'SuperCrust', 'GoldenChef',
  'FocacciaQueen', 'NightBaker', 'SourdoughKing', 'CrispyCrumb',
];

export function generateLeagueBracket(
  division: number,
  playerScore: number,
  playerName: string = 'Ти',
  weekKeyOverride?: string
): LeagueCompetitor[] {
  const weekKey = weekKeyOverride || getCurrentWeekKey();
  let seed = 0;
  for (let i = 0; i < weekKey.length; i++) {
    seed = (seed * 37 + weekKey.charCodeAt(i)) % 100000;
  }
  seed += division * 1000;

  const baseScale = Math.pow(10, division + 2) * 500;
  const list: LeagueCompetitor[] = [];

  for (let i = 0; i < 19; i++) {
    const pseudoRand = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    const scoreMult = 0.5 + pseudoRand * 1.5;
    const score = Math.floor(baseScale * scoreMult);
    list.push({
      id: `bot_${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      score,
      avatar: ['👨‍🍳', '👩‍🍳', '🥖', '✨', '🔥', '🫓', '🍕', '🐱'][i % 8],
    });
  }

  // Insert player
  list.push({
    id: 'player_me',
    name: playerName,
    score: playerScore,
    avatar: '⭐',
    isPlayer: true,
  });

  list.sort((a, b) => b.score - a.score);
  return list;
}

export function ensureLeagueState(
  current?: LeagueState,
  playerName: string = 'Ти'
): LeagueState {
  const curWeek = getCurrentWeekKey();
  if (!current) {
    return {
      division: 0,
      weeklyScore: 0,
      weekId: curWeek,
      pendingReward: null,
    };
  }

  // If week hasn't rolled over, return current (keeping any unclaimed pendingReward)
  if (current.weekId === curWeek) {
    return current;
  }

  // Week rolled over! Calculate outcomes from completed week
  const prevDiv = current.division ?? 0;
  const prevScore = current.weeklyScore ?? 0;
  const divInfo = DIVISIONS[prevDiv] || DIVISIONS[0];
  const bracket = generateLeagueBracket(prevDiv, prevScore, playerName, current.weekId);
  const pIndex = bracket.findIndex((c) => c.isPlayer);
  const finalRank = pIndex >= 0 ? pIndex + 1 : 20;

  let diamonds = 0;
  let passXp = 0;
  if (prevScore > 0) {
    if (finalRank === 1) {
      diamonds = divInfo.rewards.top1.diamonds;
      passXp = divInfo.rewards.top1.passXp;
    } else if (finalRank === 2) {
      diamonds = divInfo.rewards.top2.diamonds;
      passXp = divInfo.rewards.top2.passXp;
    } else if (finalRank <= divInfo.promoteTop) {
      diamonds = divInfo.rewards.top3.diamonds;
      passXp = divInfo.rewards.top3.passXp;
    } else {
      diamonds = divInfo.rewards.safe.diamonds;
      passXp = divInfo.rewards.safe.passXp;
    }
  }

  let nextDiv = prevDiv;
  let status: 'promoted' | 'demoted' | 'retained' = 'retained';
  if (prevScore > 0 && finalRank <= divInfo.promoteTop && divInfo.promoteTop > 0 && prevDiv < DIVISIONS.length - 1) {
    nextDiv = prevDiv + 1;
    status = 'promoted';
  } else if (divInfo.demoteBottom > 0 && finalRank > bracket.length - divInfo.demoteBottom && prevDiv > 0) {
    nextDiv = prevDiv - 1;
    status = 'demoted';
  }

  const pendingReward: WeeklyRewardPending | null = prevScore > 0 ? {
    weekId: current.weekId,
    division: prevDiv,
    finalRank,
    diamonds,
    passXp,
    status,
  } : current.pendingReward || null;

  return {
    division: nextDiv,
    weeklyScore: 0,
    weekId: curWeek,
    pendingReward,
  };
}
