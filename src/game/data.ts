export interface Building {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  baseCost: number;
  cps: number; // focaccia per second per unit
  requireRebirth?: number;
}

export interface ClickUpgrade {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  cost: number;
  clickAdd?: number; // flat add per click
  clickMult?: number; // multiplier for click
  cpsMult?: number; // multiplier for all cps
  energyRegen?: number; // multiplier for energy regen speed
  requireBuilding?: { id: string; count: number };
  requireRebirth?: number;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  check: (s: AchState) => boolean;
}

export interface AchState {
  total: number;
  clicks: number;
  cps: number;
  buildings: Record<string, number>;
  maxCombo: number;
  goldenCaught: number;
  prestige: number;
  diamonds?: number;
  diamondBuildings?: Record<string, number>;
  bossesDefeated?: number;
  pestsSquashed?: number;
}

export const BUILDINGS: Building[] = [
  { id: 'hand', name: 'Друга рука', emoji: '✋', desc: 'Їсти можна двома руками', baseCost: 15, cps: 0.1, requireRebirth: 0 },
  { id: 'grandma', name: 'Бабуся', emoji: '👵', desc: 'Пече фокачі з любов’ю', baseCost: 100, cps: 1, requireRebirth: 0 },
  { id: 'oven', name: 'Піч', emoji: '🔥', desc: 'Дров’яна піч на подвір’ї', baseCost: 1100, cps: 8, requireRebirth: 0 },
  { id: 'kiosk', name: 'Кіоск', emoji: '🏪', desc: 'Зелений кіоск біля зупинки', baseCost: 12000, cps: 47, requireRebirth: 0 },
  { id: 'bakery', name: 'Пекарня', emoji: '🥖', desc: 'Справжня фокачерія', baseCost: 130000, cps: 260, requireRebirth: 0 },
  { id: 'factory', name: 'Завод', emoji: '🏭', desc: 'Промислове виробництво фокач', baseCost: 1400000, cps: 1400, requireRebirth: 1 },
  { id: 'italy', name: 'Філія в Італії', emoji: '🇮🇹', desc: 'Прямо з Лігурії', baseCost: 20000000, cps: 7800, requireRebirth: 2 },
  { id: 'rocket', name: 'Космо-пекарня', emoji: '🚀', desc: 'Фокачі на орбіті', baseCost: 330000000, cps: 44000, requireRebirth: 3 },
  { id: 'portal', name: 'Портал фокач', emoji: '🌀', desc: 'Фокачі з паралельних всесвітів', baseCost: 5100000000, cps: 260000, requireRebirth: 4 },
  { id: 'god', name: 'Бог фокачі', emoji: '👑', desc: 'Все є фокача', baseCost: 75000000000, cps: 1600000, requireRebirth: 5 },
];

export const CLICK_UPGRADES: ClickUpgrade[] = [
  // Rebirth 0 (базові 4 прокачки)
  { id: 'c1', name: 'Голодний погляд', emoji: '👀', desc: '+1 фокача за клік', cost: 50, clickAdd: 1, requireRebirth: 0 },
  { id: 'c2', name: 'Язик назовні', emoji: '👅', desc: '+3 фокачі за клік', cost: 300, clickAdd: 3, requireRebirth: 0 },
  { id: 'e1', name: 'Енергетик', emoji: '🥤', desc: 'Відновлення енергії x2', cost: 500, energyRegen: 2, requireRebirth: 0 },
  { id: 'b1', name: 'Бабусині рецепти', emoji: '📖', desc: 'Виробництво x2', cost: 5000, cpsMult: 2, requireBuilding: { id: 'grandma', count: 5 }, requireRebirth: 0 },

  // Rebirth 1
  { id: 'c3', name: 'Чорна футболка', emoji: '👕', desc: 'Клік x2', cost: 1500, clickMult: 2, requireRebirth: 1 },
  { id: 'c4', name: 'Рюкзак з припасами', emoji: '🎒', desc: '+25 за клік', cost: 8000, clickAdd: 25, requireRebirth: 1 },
  { id: 'b2', name: 'Гаряча піч', emoji: '🌡️', desc: 'Виробництво x2', cost: 60000, cpsMult: 2, requireBuilding: { id: 'oven', count: 5 }, requireRebirth: 1 },
  { id: 'e2', name: 'Міцна кава', emoji: '☕', desc: 'Відновлення енергії x2', cost: 10000, energyRegen: 2, requireRebirth: 1 },

  // Rebirth 2
  { id: 'c5', name: 'Зачіска сили', emoji: '💇', desc: 'Клік x2', cost: 40000, clickMult: 2, requireRebirth: 2 },
  { id: 'c6', name: 'Томатний соус', emoji: '🍅', desc: '+250 за клік', cost: 200000, clickAdd: 250, requireRebirth: 2 },
  { id: 'b3', name: 'Реклама на кіоску', emoji: '📢', desc: 'Виробництво x2', cost: 500000, cpsMult: 2, requireBuilding: { id: 'kiosk', count: 5 }, requireRebirth: 2 },
  { id: 'e3', name: 'Протеїновий батончик', emoji: '💪', desc: 'Відновлення енергії x3', cost: 500000, energyRegen: 3, requireRebirth: 2 },

  // Rebirth 3
  { id: 'c7', name: 'Розмарин', emoji: '🌿', desc: 'Клік x3', cost: 1500000, clickMult: 3, requireRebirth: 3 },
  { id: 'b4', name: 'Франшиза', emoji: '📈', desc: 'Виробництво x2', cost: 6000000, cpsMult: 2, requireBuilding: { id: 'bakery', count: 5 }, requireRebirth: 3 },

  // Rebirth 4
  { id: 'c8', name: 'Оливкова олія', emoji: '🫒', desc: 'Клік x3', cost: 25000000, clickMult: 3, requireRebirth: 4 },
  { id: 'b5', name: 'Автоматизація', emoji: '🤖', desc: 'Виробництво x2', cost: 80000000, cpsMult: 2, requireBuilding: { id: 'factory', count: 5 }, requireRebirth: 4 },

  // Rebirth 5
  { id: 'c9', name: 'Легендарний апетит', emoji: '🐉', desc: 'Клік x5', cost: 500000000, clickMult: 5, requireRebirth: 5 },
  { id: 'b6', name: 'Італійська мафія', emoji: '🕶️', desc: 'Виробництво x3', cost: 1000000000, cpsMult: 3, requireBuilding: { id: 'italy', count: 5 }, requireRebirth: 5 },
];

export interface DiamondBuilding {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  baseCost: number; // cost in diamonds
  baseCps: number; // base flat CPS per unit
  percentBonus: number; // % bonus to total CPS per unit (e.g. 0.01 = +1%)
  requireRebirth?: number;
}

export const DIAMOND_BUILDINGS: DiamondBuilding[] = [
  {
    id: 'd_oven',
    name: 'Кристалічна піч',
    emoji: '💠',
    desc: 'Кристалічний жар пече стабільно та гаряче (+4% CPS)',
    baseCost: 10,
    baseCps: 5000,
    percentBonus: 0.04,
    requireRebirth: 0,
  },
  {
    id: 'd_mine',
    name: 'Діамантова копальня',
    emoji: '⛏️',
    desc: 'Добуває алмазний пил для надміцного тіста (+6% CPS)',
    baseCost: 25,
    baseCps: 35000,
    percentBonus: 0.06,
    requireRebirth: 0,
  },
  {
    id: 'd_palace',
    name: 'Смарагдовий палац',
    emoji: '🏛️',
    desc: 'Королівська резиденція елітних пекарів (+8% CPS)',
    baseCost: 50,
    baseCps: 250000,
    percentBonus: 0.08,
    requireRebirth: 1,
  },
  {
    id: 'd_lab',
    name: 'Квантова лабораторія',
    emoji: '🔬',
    desc: 'Синтез нано-фокач вищої проби (+12% CPS)',
    baseCost: 100,
    baseCps: 1800000,
    percentBonus: 0.12,
    requireRebirth: 2,
  },
  {
    id: 'd_colossus',
    name: 'Діамантовий колос',
    emoji: '🗿',
    desc: 'Древня статуя бога випічки (+18% CPS)',
    baseCost: 200,
    baseCps: 10000000,
    percentBonus: 0.18,
    requireRebirth: 3,
  },
  {
    id: 'd_citadel',
    name: 'Зоряна цитадель',
    emoji: '🌌',
    desc: 'Генерує фокачі з зоряного пилу (+25% CPS)',
    baseCost: 350,
    baseCps: 50000000,
    percentBonus: 0.25,
    requireRebirth: 4,
  },
];

export const diamondBuildingCost = (b: DiamondBuilding, owned: number) =>
  Math.floor(b.baseCost * Math.pow(1.35, owned));

export interface VipUpgrade {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  cost: number; // cost in diamonds
}

export const VIP_UPGRADES: VipUpgrade[] = [
  { id: 'vip_knife', name: 'Шеф-ніж', emoji: '🗡️', desc: '+1 урон по босах (2 HP за тап)', cost: 5 },
  { id: 'vip_hammer', name: 'Бойова скалка', emoji: '🪵', desc: '+2 урону по босах (важка кулінарна зброя)', cost: 25 },
  { id: 'vip_sword', name: 'Меч піцайоло', emoji: '⚔️', desc: '+4 урону по босах (гострий клинок майстра)', cost: 60 },
  { id: 'vip_plasma', name: 'Плазмовий різак', emoji: '⚡', desc: '+7 урону по босах (розсікає навіть титанів)', cost: 120 },
  { id: 'vip_trap', name: 'Пастка для шкідників', emoji: '🪤', desc: 'Шкідники крадуть удвічі менше фокач', cost: 10 },
  { id: 'vip_energy', name: 'Надзаряд', emoji: '⚡', desc: '+25 до максимальної енергії', cost: 15 },
  { id: 'vip_golden', name: 'Золота конюшина', emoji: '🍀', desc: 'Золота фокача з’являється удвічі частіше', cost: 20 },
  { id: 'vip_tax', name: 'Власний бухгалтер', emoji: '💼', desc: 'Податки знижено з 5% до 1%', cost: 25 },
  { id: 'vip_crit', name: 'Алмазний фокус', emoji: '🎯', desc: 'Шанс криту 8% (було 5%), крит-урон x12 (було x10)', cost: 30 },
  { id: 'vip_chef', name: 'Зірка Мішлен', emoji: '👑', desc: '+30% до загального CPS назавжди', cost: 35 },
  { id: 'vip_combo', name: 'Майстер комбо', emoji: '🌪️', desc: 'Комбо тримається 2.2с (було 1.2с) і спадає повільніше', cost: 35 },
  { id: 'vip_magnet', name: 'Діамантовий магніт', emoji: '🧲', desc: '+50% шанс вибити 💎 зі шкідників, боси дають +1 💎', cost: 45 },
  { id: 'vip_frenzy', name: 'Гіпер-френзі', emoji: '🔥', desc: 'Френзі триває 25с (замість 20с) та дає x8 замість x7', cost: 50 },
  { id: 'vip_offline', name: 'Нічна пекарня', emoji: '🌙', desc: '75% доходу офлайн (замість 50%) до 12 годин', cost: 60 },
  { id: 'vip_polish', name: 'Діамантове огранювання', emoji: '💎', desc: '+25% до ефективності всіх діамантових будівель', cost: 75 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', name: 'Перший укус', emoji: '🥐', desc: 'Отримай першу фокачу', check: (s) => s.total >= 1 },
  { id: 'a2', name: 'Голодний', emoji: '😋', desc: '100 фокач', check: (s) => s.total >= 100 },
  { id: 'a3', name: 'Ситий', emoji: '😌', desc: '10 000 фокач', check: (s) => s.total >= 10000 },
  { id: 'a4', name: 'Мільйонер', emoji: '💰', desc: '1 000 000 фокач', check: (s) => s.total >= 1e6 },
  { id: 'a5', name: 'Мільярдер', emoji: '💎', desc: '1 000 000 000 фокач', check: (s) => s.total >= 1e9 },
  { id: 'a6', name: 'Клікер', emoji: '👆', desc: '100 кліків', check: (s) => s.clicks >= 100 },
  { id: 'a7', name: 'Тиснути!', emoji: '🔥', desc: '1000 кліків', check: (s) => s.clicks >= 1000 },
  { id: 'a8', name: 'Палець зі сталі', emoji: '🦾', desc: '10 000 кліків', check: (s) => s.clicks >= 10000 },
  { id: 'a9', name: 'Комбо-майстер', emoji: '⚡', desc: 'Комбо x25', check: (s) => s.maxCombo >= 25 },
  { id: 'a10', name: 'Шалене комбо', emoji: '🌪️', desc: 'Комбо x100', check: (s) => s.maxCombo >= 100 },
  { id: 'a11', name: 'Онук року', emoji: '👵', desc: '10 бабусь', check: (s) => (s.buildings.grandma || 0) >= 10 },
  { id: 'a12', name: 'Директор', emoji: '🏭', desc: 'Побудуй завод', check: (s) => (s.buildings.factory || 0) >= 1 },
  { id: 'a13', name: 'Золота рука', emoji: '✨', desc: 'Злови золоту фокачу', check: (s) => s.goldenCaught >= 1 },
  { id: 'a14', name: 'Мисливець', emoji: '🎯', desc: 'Злови 10 золотих фокач', check: (s) => s.goldenCaught >= 10 },
  { id: 'a15', name: 'Конвеєр', emoji: '⚙️', desc: '1000 фокач/сек', check: (s) => s.cps >= 1000 },
  { id: 'a16', name: 'Ребіртх', emoji: '🔄', desc: 'Зроби перший ребіртх', check: (s) => s.prestige >= 1 },
  { id: 'a17', name: 'Дезінсектор', emoji: '🪲', desc: 'Знищи 5 шкідників', check: (s) => (s.pestsSquashed || 0) >= 5 },
  { id: 'a18', name: 'Вбивця босів', emoji: '⚔️', desc: 'Переможи першого боса', check: (s) => (s.bossesDefeated || 0) >= 1 },
  { id: 'a19', name: 'Діамантовий магнат', emoji: '💎', desc: 'Збери 10 діамантів', check: (s) => (s.diamonds || 0) >= 10 },
  { id: 'a20', name: 'Діамантовий зодчий', emoji: '🏛️', desc: 'Побудуй першу діамантову будівлю', check: (s) => Object.values(s.diamondBuildings || {}).some((v) => v > 0) },
];

export const buildingCost = (b: Building, owned: number) => Math.floor(b.baseCost * Math.pow(1.25, owned));

export const getBuildingRepairCost = (b: Building) => Math.max(500, Math.floor(b.baseCost * 2.5));

export function formatNum(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return Math.floor(n).toString();
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  if (v >= 1000) return n.toExponential(2).replace('e+', 'e'); // за межами таблиці — науковий запис
  return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)}${units[i]}`;
}

export function formatCps(n: number): string {
  if (n < 10) return n.toFixed(1);
  return formatNum(n);
}

export function getBossDamage(vipUpgrades?: string[]): { damage: number; icon: string } {
  const v = vipUpgrades || [];
  let damage = 1;
  let icon = '👊';
  if (v.includes('vip_knife')) { damage += 1; icon = '🗡️'; }
  if (v.includes('vip_hammer')) { damage += 2; icon = '🪵'; }
  if (v.includes('vip_sword')) { damage += 4; icon = '⚔️'; }
  if (v.includes('vip_plasma')) { damage += 7; icon = '⚡'; }
  return { damage, icon };
}

