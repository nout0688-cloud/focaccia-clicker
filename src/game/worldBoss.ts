export interface WorldBossInfo {
  id: string;
  nameUk: string;
  nameRu: string;
  titleUk: string;
  titleRu: string;
  avatar: string;
  maxHp: number;
}

export const CURRENT_WORLD_BOSS: WorldBossInfo = {
  id: 'golem_yeast_v1',
  nameUk: 'Гігантський Дріжджовий Голем',
  nameRu: 'Гигантский Дрожжевой Голем',
  titleUk: 'Прадавній титан, породжений нескінченним бродінням',
  titleRu: 'Древний титан, порождённый бесконечным брожением',
  avatar: '👹',
  maxHp: 2000000,
};

export interface BossPhase {
  phase: number;
  nameUk: string;
  nameRu: string;
  descUk: string;
  descRu: string;
  hpPercentStart: number;
  hpPercentEnd: number;
  color: string;
  badge: string;
}

export const WORLD_BOSS_PHASES: BossPhase[] = [
  {
    phase: 1,
    nameUk: 'Сплячий Дріжджовий Голем',
    nameRu: 'Спящий Дрожжевой Голем',
    descUk: 'Тіло голема скуте товстою хрусткою кіркою. Завдавайте прямих ударів!',
    descRu: 'Тело голема сковано толстой хрустящей коркой. Наносите прямые удары!',
    hpPercentStart: 100,
    hpPercentEnd: 66,
    color: '#eab308',
    badge: '🥖 Фаза 1',
  },
  {
    phase: 2,
    nameUk: 'Розпечений Тістомант',
    nameRu: 'Раскалённый Тестомант',
    descUk: 'Голем палає внутрішнім жаром! З’являються вразливі точки — тапайте по них для 5x криту!',
    descRu: 'Голем пылает внутренним жаром! Появляются уязвимые точки — тапайте по ним для 5x крита!',
    hpPercentStart: 66,
    hpPercentEnd: 30,
    color: '#f97316',
    badge: '🌋 Фаза 2: Слабкі місця',
  },
  {
    phase: 3,
    nameUk: 'Первісний Пожирач Тіста',
    nameRu: 'Первозданный Пожиратель Теста',
    descUk: 'Лють титана максимальна! Всі атаки гравців прискорені, фінальний штурм!',
    descRu: 'Ярость титана максимальна! Все атаки игроков ускорены, финальный штурм!',
    hpPercentStart: 30,
    hpPercentEnd: 0,
    color: '#ef4444',
    badge: '💥 Фаза 3: Берсерк',
  },
];

export interface BossRewardTier {
  damageRequired: number;
  tier: number;
  titleUk: string;
  titleRu: string;
  diamonds: number;
  passXp: number;
  truffles: number;
  badgeTitle?: string;
  icon: string;
}

export const BOSS_REWARD_TIERS: BossRewardTier[] = [
  {
    tier: 1,
    damageRequired: 15000,
    titleUk: 'Сміливий Пекар',
    titleRu: 'Смелый Пекарь',
    diamonds: 15,
    passXp: 50,
    truffles: 2,
    icon: '🥉',
  },
  {
    tier: 2,
    damageRequired: 75000,
    titleUk: 'Нищівник Тіста',
    titleRu: 'Крушитель Теста',
    diamonds: 45,
    passXp: 120,
    truffles: 5,
    icon: '🥈',
  },
  {
    tier: 3,
    damageRequired: 250000,
    titleUk: 'Гроза Големів',
    titleRu: 'Гроза Големов',
    diamonds: 120,
    passXp: 300,
    truffles: 10,
    badgeTitle: 'Гроза Големів 👹',
    icon: '👑',
  },
];

export interface WorldBossState {
  bossId: string;
  currentHp: number;
  maxHp: number;
  playerDamage: number;
  claimedTiers: number[];
  stamina: number;
  maxStamina: number;
  lastStaminaRegen: number;
  isDefeated: boolean;
  defeatedAt?: number;
  respawnAt?: number;
}

const STORAGE_KEY = 'focaccia_world_boss_v2';

export function getBossPhase(currentHp: number, maxHp: number): BossPhase {
  const pct = (currentHp / maxHp) * 100;
  if (pct > 66) return WORLD_BOSS_PHASES[0];
  if (pct > 30) return WORLD_BOSS_PHASES[1];
  return WORLD_BOSS_PHASES[2];
}

export function tickWorldBossState(s: WorldBossState, now: number = Date.now()): WorldBossState {
  if (s.isDefeated && s.respawnAt && now >= s.respawnAt) {
    const fresh = createFreshWorldBossState();
    saveWorldBossState(fresh);
    return fresh;
  }

  const elapsed = now - (s.lastStaminaRegen || now);
  const maxStam = s.maxStamina || 10;
  const regenAmount = Math.floor(elapsed / 45000);
  if (regenAmount > 0 && s.stamina < maxStam) {
    const nextStamina = Math.min(maxStam, s.stamina + regenAmount);
    const nextLastRegen = (s.lastStaminaRegen || now) + regenAmount * 45000;
    const updated: WorldBossState = {
      ...s,
      stamina: nextStamina,
      lastStaminaRegen: nextLastRegen,
    };
    saveWorldBossState(updated);
    return updated;
  }

  return s;
}

export function loadWorldBossState(): WorldBossState {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return tickWorldBossState(parsed, now);
    }
  } catch {}
  return createFreshWorldBossState();
}

export function saveWorldBossState(s: WorldBossState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function createFreshWorldBossState(): WorldBossState {
  return {
    bossId: CURRENT_WORLD_BOSS.id,
    currentHp: CURRENT_WORLD_BOSS.maxHp,
    maxHp: CURRENT_WORLD_BOSS.maxHp,
    playerDamage: 0,
    claimedTiers: [],
    stamina: 10,
    maxStamina: 10,
    lastStaminaRegen: Date.now(),
    isDefeated: false,
  };
}
