export interface AvatarFrame {
  id: string;
  name: { uk: string; ru: string };
  desc: { uk: string; ru: string };
  cost: number; // 0 for default
  emoji: string;
  frameClass: string;
  glowClass?: string;
}

export interface NameColorStyle {
  id: string;
  name: { uk: string; ru: string };
  desc: { uk: string; ru: string };
  cost: number; // 0 for default
  colorClass: string;
  previewColor: string;
}

export interface ShowcaseMetric {
  id: string;
  name: { uk: string; ru: string };
  emoji: string;
  getValue: (state: any) => string | number;
}

/* =========================================================
   AVATAR FRAMES
========================================================= */
export const AVATAR_FRAMES: AvatarFrame[] = [
  {
    id: 'frame_default',
    name: { uk: 'Класична', ru: 'Классическая' },
    desc: { uk: 'Базова скляна рамка', ru: 'Базовая стеклянная рамка' },
    cost: 0,
    emoji: '⚪',
    frameClass: 'border-2 border-amber-500/30 bg-black/40',
  },
  {
    id: 'frame_neon_cyan',
    name: { uk: 'Крижаний кристал', ru: 'Ледяной кристалл' },
    desc: { uk: 'Морозне бірюзове неонове сяйво', ru: 'Морозное бирюзовое неоновое сияние' },
    cost: 25,
    emoji: '💎',
    frameClass: 'border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] bg-cyan-950/40',
    glowClass: 'animate-pulse',
  },
  {
    id: 'frame_fire',
    name: { uk: 'Пекельне полум’я', ru: 'Адское пламя' },
    desc: { uk: 'Анімоване вогняне полум’я та жарини', ru: 'Анимированное огненное пламя и угли' },
    cost: 35,
    emoji: '🔥',
    frameClass: 'border-2 border-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.7)] bg-orange-950/40 frame-fire-anim',
  },
  {
    id: 'frame_gold_crown',
    name: { uk: 'Королівське золото', ru: 'Королевское золото' },
    desc: { uk: 'Золота монарша корона та благородний блиск', ru: 'Золотая монаршая корона и благородный блеск' },
    cost: 50,
    emoji: '👑',
    frameClass: 'border-2 border-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.7)] bg-amber-950/40 frame-gold-anim',
  },
  {
    id: 'frame_cyber',
    name: { uk: 'Кіберпанк Матриця', ru: 'Киберпанк Матрица' },
    desc: { uk: 'Неонові ланцюги та цифровий пульс', ru: 'Неоновые цепи и цифровой пульс' },
    cost: 65,
    emoji: '⚡',
    frameClass: 'border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.7)] bg-emerald-950/40 frame-cyber-anim',
  },
  {
    id: 'frame_galaxy',
    name: { uk: 'Космічний вихор', ru: 'Космический вихрь' },
    desc: { uk: 'Глибока туманність далекого космосу', ru: 'Глубокая туманность далёкого космоса' },
    cost: 80,
    emoji: '🌌',
    frameClass: 'border-2 border-purple-500 shadow-[0_0_22px_rgba(168,85,247,0.75)] bg-purple-950/40 frame-galaxy-anim',
  },
  {
    id: 'frame_prismatic',
    name: { uk: 'Райдужний міфік', ru: 'Радужный мифик' },
    desc: { uk: 'Легендарний хроматичний спектр кольорів', ru: 'Легендарный хроматический спектр цветов' },
    cost: 100,
    emoji: '🌈',
    frameClass: 'border-2 border-transparent shadow-[0_0_25px_rgba(236,72,153,0.8)] frame-prismatic-anim',
  },
];

/* =========================================================
   NAME COLORS & GRADIENTS
========================================================= */
export const NAME_COLOR_STYLES: NameColorStyle[] = [
  {
    id: 'name_default',
    name: { uk: 'Золота класика', ru: 'Золотая классика' },
    desc: { uk: 'Теплий янтарно-золотистий відтінок', ru: 'Тёплый янтарно-золотистый оттенок' },
    cost: 0,
    colorClass: 'text-amber-100 font-bold',
    previewColor: '#fef3c7',
  },
  {
    id: 'name_cyan',
    name: { uk: 'Крижаний кристал', ru: 'Ледяной кристалл' },
    desc: { uk: 'Яскравий діамантовий бірюзовий колір', ru: 'Яркий алмазный бирюзовый цвет' },
    cost: 15,
    colorClass: 'text-cyan-300 font-bold drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]',
    previewColor: '#67e8f9',
  },
  {
    id: 'name_emerald',
    name: { uk: 'Смарагдове сяйво', ru: 'Изумрудное сияние' },
    desc: { uk: 'Глибокий благородний зелений нефрит', ru: 'Глубокий благородный зелёный нефрит' },
    cost: 20,
    colorClass: 'text-emerald-300 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]',
    previewColor: '#6ee7b7',
  },
  {
    id: 'name_amethyst',
    name: { uk: 'Королівський аметист', ru: 'Королевский аметист' },
    desc: { uk: 'Магічний фіолетово-пурпуровий блиск', ru: 'Магический фиолетово-пурпурный блеск' },
    cost: 30,
    colorClass: 'text-fuchsia-300 font-bold drop-shadow-[0_0_8px_rgba(217,70,239,0.4)]',
    previewColor: '#f0abfc',
  },
  {
    id: 'name_sunset',
    name: { uk: 'Захід сонця', ru: 'Закат солнца' },
    desc: { uk: 'Вогняний перелив персика та коралу', ru: 'Огненный перелив персика и коралла' },
    cost: 40,
    colorClass: 'text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-300 to-pink-400 font-black',
    previewColor: '#fb923c',
  },
  {
    id: 'name_cyberpunk',
    name: { uk: 'Неоновий кіберпанк', ru: 'Неоновый киберпанк' },
    desc: { uk: 'Контрастний бірюзово-малиновий градієнт', ru: 'Контрастный бирюзово-малиновый градиент' },
    cost: 50,
    colorClass: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-fuchsia-400 font-black',
    previewColor: '#a855f7',
  },
  {
    id: 'name_prismatic',
    name: { uk: 'Райдужний міфік', ru: 'Радужный мифик' },
    desc: { uk: 'Живий динамічний спектр усіх кольорів', ru: 'Живой динамический спектр всех цветов' },
    cost: 75,
    colorClass: 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-300 via-green-300 via-blue-400 to-purple-400 animate-rainbow font-black',
    previewColor: '#f43f5e',
  },
];

/* =========================================================
   SHOWCASE METRICS (ВІТРИНА)
========================================================= */
export const SHOWCASE_METRICS: ShowcaseMetric[] = [
  {
    id: 'clicks',
    name: { uk: 'Всього кліків', ru: 'Всего кликов' },
    emoji: '🖱️',
    getValue: (s) => (s.clicks || 0).toLocaleString(),
  },
  {
    id: 'total',
    name: { uk: 'З’їдено фокач', ru: 'Съедено фокачч' },
    emoji: '🫓',
    getValue: (s) => s.total || 0,
  },
  {
    id: 'prestige',
    name: { uk: 'Ребіртхів', ru: 'Ребиртхов' },
    emoji: '🔄',
    getValue: (s) => (s.prestige || 0).toLocaleString(),
  },
  {
    id: 'diamonds',
    name: { uk: 'Алмазів', ru: 'Алмазов' },
    emoji: '💎',
    getValue: (s) => (s.diamonds || 0).toLocaleString(),
  },
  {
    id: 'bosses',
    name: { uk: 'Переможено босів', ru: 'Побеждено боссов' },
    emoji: '⚔️',
    getValue: (s) => (s.bossesDefeated || 0).toLocaleString(),
  },
  {
    id: 'pests',
    name: { uk: 'Знищено шкідників', ru: 'Уничтожено вредителей' },
    emoji: '🪲',
    getValue: (s) => (s.pestsSquashed || 0).toLocaleString(),
  },
  {
    id: 'golden',
    name: { uk: 'Золотих фокач', ru: 'Золотых фокачч' },
    emoji: '✨',
    getValue: (s) => (s.goldenCaught || 0).toLocaleString(),
  },
  {
    id: 'maxCombo',
    name: { uk: 'Макс. комбо', ru: 'Макс. комбо' },
    emoji: '⚡',
    getValue: (s) => `x${s.maxCombo || 0}`,
  },
  {
    id: 'diamondBuildings',
    name: { uk: 'VIP-будівель', ru: 'VIP-зданий' },
    emoji: '🏛️',
    getValue: (s) => {
      const db = s.diamondBuildings || {};
      return Object.values(db).reduce((a: any, b: any) => a + (Number(b) || 0), 0) as number;
    },
  },
  {
    id: 'achievements',
    name: { uk: 'Досягнень', ru: 'Достижений' },
    emoji: '🏆',
    getValue: (s) => `${s.achievements?.length || 0}/20`,
  },
];

export function getAvatarFrame(id?: string): AvatarFrame {
  return AVATAR_FRAMES.find((f) => f.id === id) || AVATAR_FRAMES[0];
}

export function getNameColorStyle(id?: string): NameColorStyle {
  return NAME_COLOR_STYLES.find((c) => c.id === id) || NAME_COLOR_STYLES[0];
}

export function getShowcaseMetric(id: string): ShowcaseMetric {
  return SHOWCASE_METRICS.find((m) => m.id === id) || SHOWCASE_METRICS[0];
}
