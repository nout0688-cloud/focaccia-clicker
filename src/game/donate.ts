export const MONOBANK_JAR_URL = 'https://send.monobank.ua/jar/9jugPBu9om';
export const SUPPORT_USERNAME = 'hhimd';
export const SUPPORT_URL = 'https://t.me/hhimd';

export interface DonatePackage {
  id: string;
  titleUk: string;
  titleRu: string;
  descUk: string;
  descRu: string;
  stars: number;
  priceUah: number;
  diamonds: number;
  emoji: string;
  badge?: string;
  isStarter?: boolean;
}

export interface CartItem {
  packageId: string;
  count: number;
}

export interface JarOrderItem {
  packageId: string;
  title: string;
  count: number;
  priceUah: number;
  diamonds: number;
  emoji: string;
  isStarter?: boolean;
  isTip?: boolean;
}

export interface JarOrderRecord {
  orderId: string;
  amountUah: number;
  diamonds: number;
  isStarter?: boolean;
  isTip?: boolean;
  comment: string;
  jarUrl: string;
  title: string;
  items?: JarOrderItem[];
  createdAt: number;
  status: 'pending' | 'completed' | 'rejected';
}

export const DONATE_PACKAGES: DonatePackage[] = [
  {
    id: 'starter_pack',
    titleUk: '⚡ Стартовий набір',
    titleRu: '⚡ Стартовый набор',
    descUk: '100 💎 + зброя «Бойова скалка» 🪵 проти босів',
    descRu: '100 💎 + оружие «Боевая скалка» 🪵 против боссов',
    stars: 15,
    priceUah: 15,
    diamonds: 100,
    emoji: '⚡',
    badge: 'ВИГІДА -70%',
    isStarter: true,
  },
  {
    id: 'gems_50',
    titleUk: 'Жменя діамантів',
    titleRu: 'Горсть алмазов',
    descUk: '50 сяючих 💎 для швидких покупок',
    descRu: '50 сияющих 💎 для быстрых покупок',
    stars: 10,
    priceUah: 10,
    diamonds: 50,
    emoji: '💎',
  },
  {
    id: 'gems_150',
    titleUk: 'Мішечок діамантів',
    titleRu: 'Мешочек алмазов',
    descUk: '150 💎 (+15 бонусних каменів)',
    descRu: '150 💎 (+15 бонусных камней)',
    stars: 25,
    priceUah: 25,
    diamonds: 150,
    emoji: '💰',
    badge: 'ХІТ',
  },
  {
    id: 'gems_500',
    titleUk: 'Скриня діамантів',
    titleRu: 'Сундук алмазов',
    descUk: '500 💎 (+75 бонусних каменів)',
    descRu: '500 💎 (+75 бонусных камней)',
    stars: 75,
    priceUah: 60,
    diamonds: 500,
    emoji: '🧰',
    badge: '+20% БОНУС',
  },
  {
    id: 'gems_1500',
    titleUk: 'Скарбниця Фокачі',
    titleRu: 'Сокровищница Фокаччи',
    descUk: '1500 💎 (+300 бонусних каменів)',
    descRu: '1500 💎 (+300 бонусных камней)',
    stars: 199,
    priceUah: 150,
    diamonds: 1500,
    emoji: '👑',
    badge: 'МАКСИМУМ',
  },
  {
    id: 'tip_dev',
    titleUk: '☕ Чайові автору',
    titleRu: '☕ Чаевые автору',
    descUk: '25 💎 + титул 💖 Меценат у профілі',
    descRu: '25 💎 + титул 💖 Меценат в профиле',
    stars: 10,
    priceUah: 10,
    diamonds: 25,
    emoji: '💖',
  },
];
