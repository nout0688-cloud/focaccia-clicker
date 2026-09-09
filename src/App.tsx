import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  BUILDINGS,
  CLICK_UPGRADES,
  DIAMOND_BUILDINGS,
  VIP_UPGRADES,
  buildingCost,
  diamondBuildingCost,
  formatCps,
  formatNum,
  getBossDamage,
} from './game/data';
import {
  Lang,
  TRANSLATIONS,
  PHRASES_I18N,
  formatTemplate,
  getBuildingText,
  getUpgradeText,
  getDiamondBuildingText,
  getVipUpgradeText,
  getAchievementText,
  getBossName,
  getBossDifficultyName,
  BossDifficulty,
  getPestName,
} from './game/i18n';
import { cn } from './utils/cn';
import {
  AVATAR_FRAMES,
  NAME_COLOR_STYLES,
  SHOWCASE_METRICS,
  getAvatarFrame,
  getNameColorStyle,
  getShowcaseMetric,
} from './game/cosmetics';
import type { AvatarFrame, NameColorStyle, ShowcaseMetric } from './game/cosmetics';
import {
  DONATE_PACKAGES,
  MONOBANK_JAR_URL,
  SUPPORT_URL,
  SUPPORT_USERNAME,
  type DonatePackage,
  type CartItem,
  type JarOrderRecord,
  type JarOrderItem,
} from './game/donate';
import focacciaImg from './assets/focaccia.png';
import goldenImg from './assets/golden.png';
import monoGuideImg from './assets/mono-guide.jpg';

/* ---- Telegram WebApp ---- */
const tg = window.Telegram?.WebApp;
const tgUser = (tg?.initDataUnsafe?.user || undefined) as {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
} | undefined;
const API_BASE = 'https://focaccia-bot.vercel.app';
const ADMIN_ID = 1975429762;

const isDevUser = (id?: number | string | null): boolean => {
  if (id === undefined || id === null) return false;
  return String(id) === String(ADMIN_ID);
};

const DevBadge = ({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) => {
  if (size === 'sm') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-red-600 via-amber-500 to-orange-500 text-white font-black text-[9px] tracking-wider uppercase shadow-[0_0_10px_rgba(239,68,68,0.45)] border border-amber-300/60 select-none shrink-0',
          className
        )}
        title="Офіційний розробник / Developer"
      >
        <span className="text-[10px] leading-none">⚡</span>
        <span className="font-mono leading-none">DEV</span>
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-red-950/80 via-amber-950/80 to-orange-950/80 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.3)] select-none',
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <span className="text-xs">⚡</span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-300 font-black text-[11px] tracking-widest uppercase font-mono">
          DEVELOPER
        </span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-red-600/30 via-amber-500/30 to-orange-500/30 border border-amber-400/60 shadow-[0_0_14px_rgba(245,158,11,0.35)] select-none shrink-0',
        className
      )}
      title="Офіційний розробник / Developer"
    >
      <span className="text-xs animate-pulse">⚡</span>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-300 font-black text-[10px] tracking-wider uppercase font-mono">
        DEV
      </span>
    </span>
  );
};

/* ---- Storage: Smart conflict resolver (localStorage + CloudStorage) ---- */
const storage = {
  async get(key: string): Promise<string | null> {
    const getLocal = (): string | null => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    };

    const localVal = getLocal();

    let cloudVal: string | null = null;
    if (tg?.CloudStorage) {
      try {
        cloudVal = await new Promise<string | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 1200);
          tg.CloudStorage.getItem(key, (err: any, value: string) => {
            clearTimeout(timer);
            if (!err && value) resolve(value);
            else resolve(null);
          });
        });
      } catch { cloudVal = null; }
    }

    if (!localVal && !cloudVal) return null;
    if (!localVal) return cloudVal;
    if (!cloudVal) return localVal;

    // Порівнюємо сейви за `lastSave` (і прогресом), щоб ніколи не затерти свіжіші покупки застарілим кешем
    try {
      const lObj = JSON.parse(localVal);
      const cObj = JSON.parse(cloudVal);
      const lTime = Number(lObj?.lastSave) || 0;
      const cTime = Number(cObj?.lastSave) || 0;

      // Якщо різниця в часі більше 1 секунди — безумовно перемагає новіший сейв!
      if (lTime > cTime + 1000) return localVal;
      if (cTime > lTime + 1000) return cloudVal;

      // Якщо час однаковий/близький — перемагає той, де більший загальний видобуток (total)
      const lTotal = Number(lObj?.total) || 0;
      const cTotal = Number(cObj?.total) || 0;
      return lTotal >= cTotal ? localVal : cloudVal;
    } catch {
      return localVal || cloudVal;
    }
  },
  set(key: string, value: string) {
    // 1. МИТТЄВИЙ синхронний запис у localStorage (0.05 мс, ніколи не губиться при швидкому закритті)
    try { window.localStorage.setItem(key, value); } catch { /* */ }
    // 2. Асинхронний бекап у Telegram CloudStorage
    try { if (tg?.CloudStorage) tg.CloudStorage.setItem(key, value, () => {}); } catch { /* WebApp unsupported */ }
  },
  remove(key: string) {
    try { window.localStorage.removeItem(key); } catch { /* */ }
    try { if (tg?.CloudStorage) tg.CloudStorage.removeItem(key, () => {}); } catch { /* WebApp unsupported */ }
  },
};

/* ---- Haptic feedback ---- */
const haptic = {
  light: () => tg?.HapticFeedback?.impactOccurred('light'),
  medium: () => tg?.HapticFeedback?.impactOccurred('medium'),
  heavy: () => tg?.HapticFeedback?.impactOccurred('heavy'),
  success: () => tg?.HapticFeedback?.notificationOccurred('success'),
  warning: () => tg?.HapticFeedback?.notificationOccurred('warning'),
  error: () => tg?.HapticFeedback?.notificationOccurred('error'),
  selection: () => tg?.HapticFeedback?.selectionChanged(),
};

/* ---- Types ---- */
interface SaveState {
  focaccia: number;
  total: number;
  clicks: number;
  buildings: Record<string, number>;
  diamondBuildings?: Record<string, number>;
  upgrades: string[];
  vipUpgrades: string[];
  achievements: string[];
  maxCombo: number;
  goldenCaught: number;
  prestige: number;
  energy: number;
  diamonds: number;
  bossesDefeated: number;
  pestsSquashed: number;
  luck?: number; // везіння в казино: мінус — не щастило, плюс — щастило
  karma?: number; // поведінковий рівень 0-100: чим менше — тим більше обмежень
  lang?: 'uk' | 'ru'; // мова інтерфейсу
  lastReset: number;
  lastSave: number;
  cosmetics?: {
    ownedFrames: string[];
    ownedNameColors: string[];
    equippedFrame: string;
    equippedNameColor: string;
    showcase: string[];
  };
}

interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  direction?: 'left' | 'right';
}

interface Toast {
  id: number;
  title: string;
  text: string;
  emoji: string;
}

interface Crumb {
  id: number;
  x: number;
  y: number;
  emoji: string;
  dx: number;
}

interface ConfirmModal {
  title: string;
  text: string;
  emoji: string;
  onConfirm: () => void;
  confirmText?: string;
  isAlert?: boolean;
}

interface Boss {
  id: string;
  name: string;
  emoji: string;
  maxHp: number;
  currentHp: number;
  timeLeft: number;
  rewardDiamonds: number;
  rewardFocaccia: number;
  difficulty?: BossDifficulty;
}

interface Pest {
  id: number;
  x: number;
  y: number;
  name: string;
  emoji: string;
  dir: 1 | -1;
}

interface ActiveEvent {
  title: string;
  emoji: string;
  timeLeft: number;
  cpsMult: number;
}

const SAVE_KEY = 'focaccia-clicker-v1';
const MAX_ENERGY_BASE = 50;

const defaultState = (): SaveState => ({
  focaccia: 0,
  total: 0,
  clicks: 0,
  buildings: {},
  diamondBuildings: {},
  upgrades: [],
  vipUpgrades: [],
  achievements: [],
  maxCombo: 0,
  goldenCaught: 0,
  prestige: 0,
  energy: MAX_ENERGY_BASE,
  diamonds: 0,
  bossesDefeated: 0,
  pestsSquashed: 0,
  luck: 0,
  karma: 100,
  lang: 'uk',
  lastReset: 0,
  lastSave: Date.now(),
  cosmetics: {
    ownedFrames: ['frame_default'],
    ownedNameColors: ['name_default'],
    equippedFrame: 'frame_default',
    equippedNameColor: 'name_default',
    showcase: ['clicks', 'total', 'diamonds'],
  },
});

async function loadState(): Promise<SaveState> {
  try {
    const raw = await storage.get(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    delete parsed.photo;
    const def = defaultState();
    return {
      ...def,
      ...parsed,
      cosmetics: {
        ...def.cosmetics!,
        ...(parsed.cosmetics || {}),
        ownedFrames: parsed.cosmetics?.ownedFrames?.length ? parsed.cosmetics.ownedFrames : def.cosmetics!.ownedFrames,
        ownedNameColors: parsed.cosmetics?.ownedNameColors?.length ? parsed.cosmetics.ownedNameColors : def.cosmetics!.ownedNameColors,
        showcase: parsed.cosmetics?.showcase?.length ? parsed.cosmetics.showcase : def.cosmetics!.showcase,
      },
    };
  } catch { return defaultState(); }
}

interface BossType {
  id: string;
  emoji: string;
  hp: number;
  time: number;
  diamonds: number;
  timeCps: number;
  difficulty: BossDifficulty;
  minTotal?: number;
  minPrestige?: number;
}

const BOSS_TYPES: BossType[] = [
  // Легкі
  { id: 'rat', emoji: '🐀', hp: 30, time: 20, diamonds: 3, timeCps: 60, difficulty: 'easy', minTotal: 3000 },
  { id: 'mold', emoji: '🦠', hp: 45, time: 22, diamonds: 5, timeCps: 120, difficulty: 'easy', minTotal: 10000 },

  // Середні
  { id: 'fire', emoji: '🔥', hp: 65, time: 25, diamonds: 8, timeCps: 180, difficulty: 'medium', minTotal: 30000 },
  { id: 'mafia', emoji: '🤵', hp: 90, time: 28, diamonds: 12, timeCps: 300, difficulty: 'medium', minTotal: 80000 },
  { id: 'chef', emoji: '👨‍🍳', hp: 120, time: 30, diamonds: 16, timeCps: 450, difficulty: 'medium', minTotal: 250000 },
  { id: 'inspector', emoji: '🕵️‍♂️', hp: 155, time: 30, diamonds: 22, timeCps: 650, difficulty: 'medium', minTotal: 1000000 },

  // Важкі та Епічні
  { id: 'dragon', emoji: '🐉', hp: 220, time: 32, diamonds: 35, timeCps: 1000, difficulty: 'hard', minTotal: 5000000 },
  { id: 'golem', emoji: '🗿', hp: 300, time: 35, diamonds: 50, timeCps: 1600, difficulty: 'epic', minTotal: 25000000, minPrestige: 1 },
];

const PEST_TYPES = [
  { emoji: '🪳' },
  { emoji: '🐜' },
  { emoji: '🐁' },
];

type Page = 'shop' | 'casino' | 'clicker' | 'leaders' | 'settings';
const PAGE_ORDER: Page[] = ['shop', 'casino', 'clicker', 'leaders', 'settings'];
type ShopTab = 'buildings' | 'upgrades' | 'vip' | 'achievements';
type LeaderCategory = 'focaccia' | 'diamonds' | 'rebirth';

interface LeaderRow {
  id: string;
  name: string;
  username: string;
  total: number;
  prestige: number;
  diamonds?: number;
  clicks?: number;
  bosses?: number;
  achievements?: number;
  showcase?: string[];
  flag?: boolean;
  online?: boolean;
  frame?: string;
  color?: string;
  avatar?: string;
  isDev?: boolean;
}

// TapSentinel v5.1: сырой тап — performance.now() для ритма, Date.now() для сессий
interface Tap {
  t: number;    // performance.now() — монотонные часы для интервалов
  wall: number; // Date.now() — настенные часы для сессий/кулдауна
  x: number;
  y: number;
}

/* ---- Казино «Однарука бабуся» ---- */
const CASINO_SYMBOLS = ['💎', '👵', '⭐', '🍅', '🫓', '🧄'];
const CASINO_PAYOUTS: Record<string, number> = { '💎': 50, '👵': 15, '⭐': 8, '🍅': 4, '🫓': 2, '🧄': 1.5 };
const CASINO_PAIR_MULT = 1.4;
const CASINO_BETS = [100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
const CASINO_BETS_GEM = [1, 2, 5, 10, 25, 50, 100];
const randSymbol = () => CASINO_SYMBOLS[Math.floor(Math.random() * CASINO_SYMBOLS.length)];
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
// Колесо: 10 секторів, сума = 9.5 → повернення ~95%
const WHEEL_SEGMENTS = [0, 0.5, 1.5, 0, 2, 0, 0.5, 0, 5, 0];
const WHEEL_EDGE = 360 / WHEEL_SEGMENTS.length;
const wheelGradient = WHEEL_SEGMENTS.map((m, i) => {
  const color = m === 0 ? '#160f05' : m >= 5 ? '#f59e0b' : m >= 2 ? '#b45309' : '#6b3f0e';
  return `${color} ${i * WHEEL_EDGE}deg ${(i + 1) * WHEEL_EDGE}deg`;
}).join(', ');

export default function App() {
  const [state, setState] = useState<SaveState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [combo, setCombo] = useState(0);
  const [squish, setSquish] = useState(false);
  const [page, setPage] = useState<Page>('clicker');
  const [pageDir, setPageDir] = useState<1 | -1>(1);
  const goPage = (p: Page) => {
    if (p === page) return;
    setPageDir(PAGE_ORDER.indexOf(p) > PAGE_ORDER.indexOf(page) ? 1 : -1);
    setPage(p);
    if (p === 'leaders') loadLeaders();
    haptic.light();
  };
  const [shopTab, setShopTab] = useState<ShopTab>('buildings');
  const [vipSubTab, setVipSubTab] = useState<'buildings' | 'upgrades'>('buildings');
  const [lastBoughtId, setLastBoughtId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState(PHRASES_I18N.uk[0]);
  const [golden, setGolden] = useState<{ x: number; y: number } | null>(null);
  const [frenzy, setFrenzy] = useState(0);
  const [offlineGain, setOfflineGain] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
  const [recharging, setRecharging] = useState(false);
  const [clickRipple, setClickRipple] = useState<{x: number; y: number; id: number} | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; x: number; delay: number; emoji: string; size: number }[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [flash, setFlash] = useState<{ type: string; id: number } | null>(null);
  const [milestone, setMilestone] = useState<{ text: string; id: number } | null>(null);
  const [bossSlain, setBossSlain] = useState<{ emoji: string; id: number } | null>(null);
  const [toastsLeaving, setToastsLeaving] = useState<number[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [leaderCategory, setLeaderCategory] = useState<LeaderCategory>('focaccia');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'overview' | 'shop'>('overview');
  const [cosmeticShopTab, setCosmeticShopTab] = useState<'frames' | 'colors'>('frames');
  const [showcasePickerSlot, setShowcasePickerSlot] = useState<number | null>(null);
  const [viewingProfile, setViewingProfile] = useState<LeaderRow | null>(null);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [showPublicPreview, setShowPublicPreview] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateTab, setDonateTab] = useState<'shop' | 'cart' | 'pending'>('shop');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('focaccia_cart_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [savedOrders, setSavedOrders] = useState<JarOrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('focaccia_jar_orders_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('focaccia_cart_v1', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('focaccia_jar_orders_v1', JSON.stringify(savedOrders));
    } catch {}
  }, [savedOrders]);

  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState<number>(25);
  const [activeJarOrder, setActiveJarOrder] = useState<JarOrderRecord | null>(null);
  const [checkingOrderStatus, setCheckingOrderStatus] = useState(false);
  const [copiedOrderCode, setCopiedOrderCode] = useState(false);
  const [showMonoHelp, setShowMonoHelp] = useState(false);

  /* Hold-to-buy (затискання для швидкої покупки з прискоренням) */
  const [holdingBuyId, setHoldingBuyId] = useState<string | null>(null);
  const [holdingBuyCount, setHoldingBuyCount] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdInitialTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isHoldingRef = useRef(false);
  const wasHoldingRef = useRef(false);
  const holdCountRef = useRef(0);

  /* Античит v5: R/C/B evidence + challenge */
  const [challenge, setChallenge] = useState<null | { caught: number; x: number; y: number; timeLeft: number; result: null | 'pending' | 'win' | 'fail' | 'denied' }>(null);
  const [karma, setKarma] = useState(100); // поведінковий рівень 0-100 (синхронізується з сервером)
  const tapRing = useRef<{ buf: Tap[]; head: number; count: number }>({ buf: new Array(360), head: 0, count: 0 });
  const lastRawTap = useRef(0); // performance.now()
  const challengeOpening = useRef(false); // guard от double-flag race
  const activeNoBreakMs = useRef(0); // час гри без жодної паузи ≥ 20с
  const fastStreakMs = useRef(0); // безперервна серія дотиків швидше 8/с
  const bLongSession = useRef(false);  // 90+ хв без пауз — слабкий сигнал у B
  const bFastStreak = useRef(false);   // 3+ хв швидше 8/с — слабкий сигнал у B
  const suspicion = useRef(0);         // сглажений suspicion 0..100
  const recentEvidence = useRef<number[]>([]); // останні 5 значень evidence
  const extremeSpeedBoost = useRef(0); // імпульс за 22+/с, забувається ×0.75
  const suspicionCooldownUntil = useRef(0); // після пройденого challenge
  const syntheticTaps = useRef<number[]>([]); // ts скриптових подій (isTrusted=false)
  const [karmaInfo, setKarmaInfo] = useState(false); // меню «що це?» біля спідометра
  const [lang, setLang] = useState<Lang>('uk'); // мова інтерфейсу
  const langRef = useRef<Lang>('uk');
  langRef.current = lang;
  const t = TRANSLATIONS[lang];

  /* Казино */
  const [casinoGame, setCasinoGame] = useState<'slots' | 'dice' | 'wheel'>('slots');
  const [casinoBet, setCasinoBet] = useState(100);
  const [casinoCur, setCasinoCur] = useState<'foc' | 'gem'>('foc');
  const casinoMaxBet = karma < 50 ? 0 : karma < 75 ? (casinoCur === 'gem' ? 10 : 1000) : Infinity; // дотівська лестниця обмежень
  const [casinoCustomBet, setCasinoCustomBet] = useState('100');
  const [casinoReels, setCasinoReels] = useState<[string, string, string]>(['🫓', '👵', '💎']);
  const [casinoSpinning, setCasinoSpinning] = useState(false);
  const [casinoMsg, setCasinoMsg] = useState<null | { text: string; win: boolean }>(null);
  const [diceRoll, setDiceRoll] = useState<null | { mine: number; house: number }>(null);
  const [wheelAngle, setWheelAngle] = useState(0);

  /* New mechanics state */
  const [boss, setBoss] = useState<Boss | null>(null);
  const [pest, setPest] = useState<Pest | null>(null);
  const [brokenBuilding, setBrokenBuilding] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);

  const floatId = useRef(0);
  const lastClick = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const saveNow = useCallback((customState?: SaveState) => {
    const cur = customState || stateRef.current;
    if (!cur) return;
    const toSave: SaveState = { ...cur, lastSave: Date.now() };
    stateRef.current = toSave;
    storage.set(SAVE_KEY, JSON.stringify(toSave));
    storage.set('focaccia-balance', JSON.stringify({ f: toSave.focaccia, d: toSave.diamonds, ts: Date.now() }));
  }, []);

  const reportSync = useCallback(() => {
    if (!tgUser?.id) return Promise.resolve(null);
    const cur = stateRef.current;
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || (langRef.current === 'uk' ? 'Гравець' : 'Игрок');
    return fetch(`${API_BASE}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: tgUser.id,
        name: fullName,
        username: tgUser.username || '',
        total: Math.floor(cur.total),
        prestige: cur.prestige,
        clicks: Math.floor(cur.clicks),
        focaccia: Math.floor(cur.focaccia),
        diamonds: Math.floor(cur.diamonds),
        bosses: cur.bossesDefeated || 0,
        achievements: cur.achievements?.length || 0,
        showcase: cur.cosmetics?.showcase || ['clicks', 'total', 'diamonds'],
        frame: cur.cosmetics?.equippedFrame || 'frame_default',
        color: cur.cosmetics?.equippedNameColor || 'name_default',
        avatar: tgUser.photo_url || '',
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.karma === 'number') setKarma(data.karma);
        if (data?.rank) setMyRank(data.rank);
        return data;
      })
      .catch(() => null);
  }, [tgUser]);

  /* ---- Init ---- */
  useEffect(() => {
    if (tg) { tg.ready(); tg.expand(); }
    // Ref for the admin polling interval so it can be cleared on unmount
    let adminIv: ReturnType<typeof setInterval> | undefined;

    loadState().then((s) => {
      const maxHours = s.vipUpgrades?.includes('vip_offline') ? 12 : 8;
      const elapsed = Math.min((Date.now() - s.lastSave) / 1000, 60 * 60 * maxHours);
      if (elapsed > 30) {
        let base = 0;
        for (const b of BUILDINGS) base += (s.buildings[b.id] || 0) * b.cps;
        const dPolish = s.vipUpgrades?.includes('vip_polish') ? 1.25 : 1.0;
        let dPercentTotal = 0;
        for (const db of DIAMOND_BUILDINGS) {
          const owned = s.diamondBuildings?.[db.id] || 0;
          base += owned * db.baseCps * dPolish;
          dPercentTotal += owned * db.percentBonus * dPolish;
        }
        let mult = 1;
        for (const u of CLICK_UPGRADES)
          if (u.cpsMult && s.upgrades.includes(u.id)) mult *= u.cpsMult;
        if (s.vipUpgrades?.includes('vip_chef')) mult *= 1.3;
        mult *= (1 + dPercentTotal);
        const karmaMult = (s.karma ?? 100) < 50 ? 0.5 : 1; // погана карма — офлайн-дохід −50%
        const offlineRate = s.vipUpgrades?.includes('vip_offline') ? 0.75 : 0.5;
        const gain = base * mult * (1 + s.prestige * 0.1) * elapsed * offlineRate * karmaMult;
        if (gain > 1) { s.focaccia += gain; s.total += gain; setOfflineGain(gain); }
      }
      setState(s);
      setKarma(s.karma ?? 100);
      setLang(s.lang ?? 'uk');
      setLoading(false);
      stateRef.current = s;
      saveNow(s);
      setTimeout(reportSync, 100);

      // Check for admin rewards or reset order
      const checkAdmin = (userState: SaveState) => {
        if (!tgUser?.id) return;
        fetch(`https://focaccia-bot.vercel.app/api/reward?userId=${tgUser.id}&lastReset=${userState.lastReset || 0}`)
          .then((r) => r.json())
          .then((data) => {
            if (typeof data?.karma === 'number') setKarma(data.karma);
            if (data?.reset) {
              const fresh = defaultState();
              if (data.resetTime) fresh.lastReset = data.resetTime;
              storage.set(SAVE_KEY, JSON.stringify(fresh));
              stateRef.current = fresh;
              setState(fresh);
              const curT = TRANSLATIONS[langRef.current];
              setConfirmModal({
                title: langRef.current === 'uk' ? 'Скидання акаунту' : 'Сброс аккаунта',
                text: langRef.current === 'uk'
                  ? 'Адміністратор провів скидання гри. Твій прогрес розпочато спочатку!'
                  : 'Администратор произвёл сброс игры. Твой прогресс начат сначала!',
                emoji: '🗑️',
                isAlert: true,
                confirmText: curT.confirmOk,
                onConfirm: () => setConfirmModal(null),
              });
              haptic.error();
              setTimeout(reportSync, 100);
            } else {
              const curT = TRANSLATIONS[langRef.current];
              if (data?.reward && data.reward > 0) {
                setState((p) => {
                  const next = { ...p, focaccia: p.focaccia + data.reward, total: p.total + data.reward };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                addToast(curT.toastReward, formatTemplate(curT.toastRewardDesc, formatNum(data.reward)), '🎁');
                setTimeout(reportSync, 100);
              }
              if (data?.diamonds && data.diamonds > 0) {
                setState((p) => {
                  const next = { ...p, diamonds: (p.diamonds || 0) + data.diamonds };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                const isDuel = data?.gemSource === 'duel';
                const isDonate = data?.gemSource === 'donate';
                const toastTitle = isDonate ? (curT.toastDonateReward || '🌟 Покупка успішна!') : (isDuel ? curT.toastDuelReward : curT.toastDiamondReward);
                const toastDesc = isDonate ? (curT.toastDonateRewardDesc || '+{0} 💎 зараховано!') : (isDuel ? curT.toastDuelRewardDesc : curT.toastDiamondRewardDesc);
                addToast(toastTitle, formatTemplate(toastDesc, formatNum(data.diamonds)), isDonate ? '🌟' : '💎');
                haptic.success();
                setTimeout(reportSync, 100);
              }
              if (data?.extraUpgrade) {
                setState((p) => {
                  const curVip = p.vipUpgrades || [];
                  if (!curVip.includes(data.extraUpgrade)) {
                    const next = { ...p, vipUpgrades: [...curVip, data.extraUpgrade] };
                    stateRef.current = next;
                    saveNow(next);
                    return next;
                  }
                  return p;
                });
              }
              if (data?.rebirth && data.rebirth > 0) {
                setState((p) => {
                  const next = { ...p, prestige: p.prestige + data.rebirth };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                addToast(curT.toastRebirthReward, formatTemplate(curT.toastRebirthRewardDesc, data.rebirth), '🔄');
                haptic.success();
                setTimeout(reportSync, 100);
              }
              if (data?.deduct && data.deduct > 0) {
                setState((p) => {
                  const next = { ...p, focaccia: Math.max(0, p.focaccia - data.deduct) };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                addToast(curT.toastDeduct, formatTemplate(curT.toastDeductDesc, formatNum(data.deduct)), '⚠️');
                haptic.warning();
                setTimeout(reportSync, 100);
              }
            }
          })
          .catch(() => { /* silent fail */ });
      };

      checkAdmin(s);

      // Check every 25 seconds while playing
      adminIv = setInterval(() => checkAdmin(stateRef.current), 25000);
    });

    // Cleanup: clear the admin polling interval on component unmount
    return () => clearInterval(adminIv);
  }, []);

  /* Sync Telegram WebApp BackButton with fullscreen modals */
  useEffect(() => {
    if (!tg?.BackButton) return;
    if (showPublicPreview || profileModalOpen || viewingProfile !== null) {
      try {
        tg.BackButton.show();
        const handleBack = () => {
          if (showPublicPreview) {
            setShowPublicPreview(false);
          } else if (showcasePickerSlot !== null) {
            setShowcasePickerSlot(null);
          } else if (profileModalOpen) {
            setProfileModalOpen(false);
            setPreviewFrame(null);
            setPreviewColor(null);
          } else if (viewingProfile !== null) {
            setViewingProfile(null);
          }
        };
        tg.BackButton.onClick(handleBack);
        return () => {
          tg.BackButton.offClick(handleBack);
          tg.BackButton.hide();
        };
      } catch (_) { /* ignore */ }
    } else {
      try {
        tg.BackButton.hide();
      } catch (_) { /* ignore */ }
    }
  }, [showPublicPreview, profileModalOpen, viewingProfile, showcasePickerSlot]);

  /* ---- Derived ---- */
  const prestigeMult = 1 + state.prestige * 0.1;

  const clickPower = useMemo(() => {
    let add = 1, mult = 1;
    for (const u of CLICK_UPGRADES) {
      if (!state.upgrades.includes(u.id)) continue;
      if (u.clickAdd) add += u.clickAdd;
      if (u.clickMult) mult *= u.clickMult;
    }
    return add * mult * prestigeMult;
  }, [state.upgrades, prestigeMult]);

  const cps = useMemo(() => {
    let base = 0;
    for (const b of BUILDINGS) {
      const isBroken = brokenBuilding === b.id;
      base += (state.buildings[b.id] || 0) * b.cps * (isBroken ? 0.5 : 1);
    }
    const dPolish = state.vipUpgrades?.includes('vip_polish') ? 1.25 : 1.0;
    let dPercentTotal = 0;
    for (const db of DIAMOND_BUILDINGS) {
      const owned = state.diamondBuildings?.[db.id] || 0;
      base += owned * db.baseCps * dPolish;
      dPercentTotal += owned * db.percentBonus * dPolish;
    }
    let mult = 1;
    for (const u of CLICK_UPGRADES) {
      if (u.cpsMult && state.upgrades.includes(u.id)) mult *= u.cpsMult;
    }
    if (state.vipUpgrades?.includes('vip_chef')) mult *= 1.3;
    mult *= (1 + dPercentTotal);
    if (activeEvent) mult *= activeEvent.cpsMult;
    return base * mult * prestigeMult;
  }, [state.buildings, state.diamondBuildings, state.upgrades, state.vipUpgrades, brokenBuilding, activeEvent, prestigeMult]);

  const frenzyMult = frenzy > 0 ? (state.vipUpgrades?.includes('vip_frenzy') ? 8 : 7) : 1;
  const comboMult = 1 + Math.min(combo, 100) * 0.02;
  const cpsRef = useRef(cps);
  cpsRef.current = cps * frenzyMult;
  const prestigeGain = Math.floor(Math.cbrt(state.total / 1e6));
  const nextRebirthTarget = Math.pow(Math.max(1, prestigeGain + 1), 3) * 1e6;
  const prevRebirthTarget = prestigeGain > 0 ? Math.pow(prestigeGain, 3) * 1e6 : 0;
  const rebirthProgress = Math.min(
    100,
    Math.max(0, ((state.total - prevRebirthTarget) / (nextRebirthTarget - prevRebirthTarget)) * 100)
  );

  const maxEnergy = useMemo(() => {
    let cap = MAX_ENERGY_BASE + state.prestige * 5;
    if (state.vipUpgrades?.includes('vip_energy')) cap += 25;
    return cap;
  }, [state.prestige, state.vipUpgrades]);

  const energyRegenSpeed = useMemo(() => {
    let mult = 1;
    for (const u of CLICK_UPGRADES) {
      if (u.energyRegen && state.upgrades.includes(u.id)) mult *= u.energyRegen;
    }
    return mult;
  }, [state.upgrades]);

  /* ---- Active cosmetics & Live Try-on ---- */
  const effectiveFrameId = previewFrame || state.cosmetics?.equippedFrame || 'frame_default';
  const effectiveColorId = previewColor || state.cosmetics?.equippedNameColor || 'name_default';
  const isTryingOn = (previewFrame !== null && previewFrame !== (state.cosmetics?.equippedFrame || 'frame_default')) ||
                     (previewColor !== null && previewColor !== (state.cosmetics?.equippedNameColor || 'name_default'));

  /* ---- Helpers ---- */
  const addFloat = useCallback((x: number, y: number, text: string, color = 'text-amber-300') => {
    const id = ++floatId.current;
    const direction = Math.random() < 0.5 ? 'left' : 'right';
    setFloats((f) => [...f, { id, x, y, text, color, direction }]);
    setTimeout(() => setFloats((f) => f.filter((t) => t.id !== id)), 850);
  }, []);

  const closeToast = useCallback((id: number) => {
    setToastsLeaving((l) => (l.includes(id) ? l : [...l, id]));
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      setToastsLeaving((l) => l.filter((x) => x !== id));
    }, 300);
  }, []);

  const addToast = useCallback((title: string, text: string, emoji: string) => {
    const id = ++floatId.current;
    setToasts((t) => [...t, { id, title, text, emoji }]);
    setTimeout(() => closeToast(id), 4000);
  }, [closeToast]);

  const doFlash = useCallback((type: string) => {
    const id = ++floatId.current;
    setFlash({ type, id });
    setTimeout(() => setFlash((f) => (f && f.id === id ? null : f)), 500);
  }, []);

  const burstConfetti = useCallback((emojis: string[] = ['🫓', '✨', '⭐', '🔥', '💎']) => {
    const base = ++floatId.current;
    setConfetti(
      Array.from({ length: 14 }, (_, i) => ({
        id: base * 100 + i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        size: 13 + Math.random() * 14,
      })),
    );
    setTimeout(() => setConfetti([]), 2700);
  }, []);

  const showMilestone = useCallback((text: string) => {
    const id = ++floatId.current;
    setMilestone({ text, id });
    setTimeout(() => setMilestone((m) => (m && m.id === id ? null : m)), 950);
  }, []);

  /* ---- TapSentinel v5.1 — Behavioral Anti-Cheat: R/C/B evidence ---- */
  // Кольцевой буфер сырых тапов — без shift на каждый тап
  const pushTap = (tap: Tap) => {
    const ring = tapRing.current;
    ring.buf[ring.head] = tap;
    ring.head = (ring.head + 1) % 360;
    ring.count = Math.min(ring.count + 1, 360);
  };
  const getTaps = (n: number): Tap[] => {
    const ring = tapRing.current;
    const count = Math.min(ring.count, n);
    const out: Tap[] = [];
    for (let i = count - 1; i >= 0; i--) out.push(ring.buf[(ring.head - 1 - i + 720) % 360]);
    return out;
  };

  // R — ритм-скор 0..100 для заданного окна (формула: скорость 30%, регулярность 20%,
  // кучкование 15%, структура шума 25%, пауза 10%). Интервалы — по performance.now().
  const rhythmScore = (taps: Tap[]): number => {
    if (taps.length < 10) return 0;
    const ivs: number[] = [];
    for (let i = 1; i < taps.length; i++) ivs.push(taps[i].t - taps[i - 1].t);
    const mean = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    const sd = Math.sqrt(ivs.reduce((a, b) => a + (b - mean) ** 2, 0) / ivs.length);
    const cv = sd / mean;
    const sorted = [...ivs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const tol = Math.max(8, median * 0.15);
    const clusterFrac = ivs.filter((iv) => Math.abs(iv - median) <= tol).length / ivs.length;
    const hasPause = ivs.some((iv) => iv > 2500);

    // Однородность локальных темпов: независимый шум джиттера vs дрейф человека.
    // ratio = subCv/cv: у бота ≈ 0.3, у человека ≥ 0.5. 0.35 → 100, 0.90 → 0.
    const subSize = Math.max(5, Math.min(10, Math.floor(ivs.length / 4)));
    const subMeans: number[] = [];
    for (let s = 0; s + subSize <= ivs.length; s += subSize) {
      const sub = ivs.slice(s, s + subSize);
      subMeans.push(sub.reduce((a, b) => a + b, 0) / sub.length);
    }
    let noiseStructure = 0;
    if (cv < 0.05) {
      noiseStructure = 100; // идеальный метроном — максимальная структура
    } else if (subMeans.length >= 2) {
      const smMean = subMeans.reduce((a, b) => a + b, 0) / subMeans.length;
      const smSd = Math.sqrt(subMeans.reduce((a, b) => a + (b - smMean) ** 2, 0) / subMeans.length);
      const ratio = smSd / smMean / cv;
      // 0.32 (независимый шум бота) → 100, 0.50 (дрейф человека) → 0. Откалибровано симуляциями.
      noiseStructure = Math.max(0, Math.min(100, ((0.50 - ratio) / (0.50 - 0.32)) * 100));
    }

    const speedScore = mean >= 125 ? 0 : mean >= 100 ? 25 : mean >= 70 ? 45 : mean >= 55 ? 60 : mean >= 45 ? 75 : mean >= 35 ? 85 : mean >= 25 ? 92 : 100;
    const regularityScore = cv >= 0.25 ? 0 : cv >= 0.18 ? 20 : cv >= 0.12 ? 40 : cv >= 0.08 ? 60 : cv >= 0.05 ? 80 : 100;
    const clusterScore = clusterFrac < 0.55 ? 0 : clusterFrac < 0.70 ? 30 : clusterFrac < 0.80 ? 55 : clusterFrac < 0.90 ? 75 : 100;
    const pauseScore = hasPause ? 0 : 20;

    return Math.round(0.30 * speedScore + 0.20 * regularityScore + 0.15 * clusterScore + 0.25 * noiseStructure + 0.10 * pauseScore);
  };

  // C — координати 0..100: статистика руху.
  // Клікання в 1 точку — це абсолютно нормальна людська поведінка в клікері (миша на ПК або палець на булку)!
  const coordScore = (taps: Tap[]): number => {
    if (taps.length < 60) return 0;
    const xs = taps.map((t) => t.x);
    const ys = taps.map((t) => t.y);

    const bbox = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
    const steps: number[] = [];
    for (let i = 1; i < taps.length; i++) steps.push(Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    const stMean = steps.reduce((a, b) => a + b, 0) / steps.length;

    // Якщо гравець клікає в одну точку (миша на ПК або палець на булку: bbox <= 35 або stMean < 2.5) —
    // це звичайна нормальна гра, координати НЕ є підозрою на бота!
    if (bbox <= 35 || stMean < 2.5) {
      return 0;
    }

    const ivsC: number[] = [];
    for (let i = 1; i < taps.length; i++) ivsC.push(taps[i].t - taps[i - 1].t);
    const cMean = ivsC.reduce((a, b) => a + b, 0) / ivsC.length;
    const cSd = Math.sqrt(ivsC.reduce((a, b) => a + (b - cMean) ** 2, 0) / ivsC.length);
    const cvHere = cMean > 0 ? cSd / cMean : 1;

    // repeatScore: ловить виключно макроси-стрибуни між різними позиціями (A -> B -> A на відстані)
    const close = (i: number, j: number) => Math.abs(xs[i] - xs[j]) <= 8 && Math.abs(ys[i] - ys[j]) <= 8;
    let rep2 = 0;
    for (let i = 2; i < taps.length; i++) {
      if (close(i, i - 2) && !close(i, i - 1)) {
        rep2++;
      }
    }
    const patternFraction = rep2 / (taps.length - 2);
    let repeatScore = cvHere < 0.08 ? 0 : patternFraction > 0.60 ? 100 : patternFraction > 0.40 ? 60 : 0;

    const stVar = steps.reduce((a, b) => a + (b - stMean) ** 2, 0) / steps.length;
    const dirs = new Set<number>();
    let flips = 0, lastSign = 0;
    for (let i = 1; i < taps.length; i++) {
      const dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1];
      if (Math.hypot(dx, dy) < 0.5) continue;
      dirs.add(Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4))) % 8);
      const s = Math.sign(dx);
      if (s !== 0) { if (lastSign !== 0 && s !== lastSign) flips++; lastSign = s; }
    }

    const cells = new Set<string>();
    for (let i = 0; i < taps.length; i++) {
      cells.add(`${Math.round(xs[i] / 16)}:${Math.round(ys[i] / 16)}`);
    }
    const cellCount = cells.size;
    const sortedXs = [...xs].sort((a, b) => a - b);
    const sortedYs = [...ys].sort((a, b) => a - b);
    let gapX = 0, gapY = 0;
    for (let i = 1; i < sortedXs.length; i++) gapX = Math.max(gapX, sortedXs[i] - sortedXs[i - 1]);
    for (let i = 1; i < sortedYs.length; i++) gapY = Math.max(gapY, sortedYs[i] - sortedYs[i - 1]);
    const bboxX = sortedXs[sortedXs.length - 1] - sortedXs[0];
    const bboxY = sortedYs[sortedYs.length - 1] - sortedYs[0];
    const multiFinger = cellCount <= 6 && bbox > 8 && ((bboxX > 0 && gapX > bboxX * 0.4) || (bboxY > 0 && gapY > bboxY * 0.4));

    let movementScore = stVar < 4 && taps.length > 100 && stMean >= 2.5 ? 80 : 0;
    let directionScore = (dirs.size <= 2 && steps.length > 20 && stMean >= 2.5) || (flips > 60 && stMean >= 2.5 && stMean < 6) ? 70 : 0;
    let pathScore = stMean >= 2.5 && stMean < 5 && bbox > 25 ? 60 : 0;
    if (multiFinger) {
      repeatScore = Math.min(repeatScore, 20);
      movementScore = Math.min(movementScore, 20);
      directionScore = Math.min(directionScore, 20);
      pathScore = Math.min(pathScore, 20);
    }

    return Math.round(0.35 * repeatScore + 0.25 * movementScore + 0.20 * directionScore + 0.20 * pathScore);
  };

  // B — поведение 0..100: слабые сессионные факторы + скрипты (лестница: ≥8 → 60, ≥20 → 100)
  const behaviourScore = (): number => {
    let b = 0;
    const now = Date.now();
    const syntheticRate = syntheticTaps.current.filter((ts) => now - ts < 60000).length;
    if (syntheticRate >= 20) b = 100;
    else if (syntheticRate >= 8) b += 60;
    if (bLongSession.current) b += 10;   // 90+ мин без пауз
    if (bFastStreak.current) b += 10;    // 3+ мин быстрее 8/с
    const big = getTaps(300);
    if (big.length >= 300) {
      const span = big[big.length - 1].wall - big[0].wall;
      if (span > 8 * 60 * 1000) b += 10; // темп не менялся 8+ минут реального времени
    }
    return Math.min(100, b);
  };

  // H — «человечность» 0..100: естественность снижает suspicion
  const humanScore = (taps: Tap[]): number => {
    if (taps.length < 20) return 45;
    const ivs: number[] = [];
    for (let i = 1; i < taps.length; i++) ivs.push(taps[i].t - taps[i - 1].t);
    const mean = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    const sd = Math.sqrt(ivs.reduce((a, b) => a + (b - mean) ** 2, 0) / ivs.length);
    const cv = sd / mean;

    // tempoDrift: дрейф средних темпов на подокнах
    const subSize = Math.max(5, Math.min(25, Math.floor(ivs.length / 8)));
    const subMeans: number[] = [];
    for (let s = 0; s + subSize <= ivs.length; s += subSize) {
      const sub = ivs.slice(s, s + subSize);
      subMeans.push(sub.reduce((a, b) => a + b, 0) / sub.length);
    }
    let tempoDrift = 30;
    if (subMeans.length >= 2) {
      const smMean = subMeans.reduce((a, b) => a + b, 0) / subMeans.length;
      const smSd = Math.sqrt(subMeans.reduce((a, b) => a + (b - smMean) ** 2, 0) / subMeans.length);
      tempoDrift = Math.min(100, (smMean > 0 ? smSd / smMean : 0) * 250);
    }
    const intervalVariation = Math.min(100, cv * 400);

    // pauseNaturalness: природні паузи різної довжини (при активній серії тапів даємо базові 30)
    const pauses = ivs.filter((iv) => iv > 800);
    const pauseNaturalness = pauses.length === 0 ? 30 : pauses.length === 1 ? 60 : Math.min(100, 40 + pauses.length * 10);

    // pathVariation: клікання в 1 точку — стандартна норма, базовий нейтральний рівень 45
    const xs = taps.map((t) => t.x);
    const ys = taps.map((t) => t.y);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const stdX = Math.sqrt(xs.reduce((a, b) => a + (b - mx) ** 2, 0) / xs.length);
    const stdY = Math.sqrt(ys.reduce((a, b) => a + (b - my) ** 2, 0) / ys.length);
    const pathVariation = Math.min(100, 45 + (stdX + stdY) * 3);

    // sessionVariation: если окно растянуто по времени — были перерывы (настенные часы)
    const span = taps[taps.length - 1].wall - taps[0].wall;
    const sessionVariation = span > 15 * 60000 ? 100 : span > 8 * 60000 ? 60 : 30;

    return Math.round(0.30 * tempoDrift + 0.20 * intervalVariation + 0.15 * pauseNaturalness + 0.20 * pathVariation + 0.15 * sessionVariation);
  };

  // Полный анализ: мульти-масштабы R → C, B, H (мульти-масштаб) → evidence → suspicion → challenge
  const analyzeIntegrity = () => {
    const tAll = getTaps(360);
    const t300 = tAll.slice(-300);
    const t100 = tAll.slice(-100);
    const t40 = tAll.slice(-40);
    const t10 = tAll.slice(-10);

    // Мульти-масштабы: вес только у тех, где хватает данных
    let rSum = 0, wSum = 0;
    const scales = [
      { w: 0.15, taps: t10, need: 10 },
      { w: 0.30, taps: t40, need: 40 },
      { w: 0.30, taps: t100, need: 100 },
      { w: 0.25, taps: t300, need: 300 },
    ];
    for (const s of scales) {
      if (s.taps.length >= s.need) { rSum += s.w * rhythmScore(s.taps); wSum += s.w; }
    }
    const R = wSum > 0 ? rSum / wSum : 0;
    const C = coordScore(t300);
    const B = behaviourScore();

    // Нормалізований мульти-масштаб H: захищає гравця з перших секунд гри
    let hSum = 0, hwSum = 0;
    if (t40.length >= 20) { hSum += 0.20 * humanScore(t40); hwSum += 0.20; }
    if (t100.length >= 100) { hSum += 0.35 * humanScore(t100); hwSum += 0.35; }
    if (t300.length >= 300) { hSum += 0.45 * humanScore(t300); hwSum += 0.45; }
    const H = hwSum > 0 ? hSum / hwSum : 45;

    // Импульс за экстремальную скорость (22+/с на коротком окне), быстро забывается
    if (t10.length >= 10) {
      const iv10: number[] = [];
      for (let i = 1; i < t10.length; i++) iv10.push(t10[i].t - t10[i - 1].t);
      const m10 = iv10.reduce((a, b) => a + b, 0) / iv10.length;
      if (m10 < 45) extremeSpeedBoost.current = Math.min(25, extremeSpeedBoost.current + 12);
    }

    // H гасит, но не более 25 — высокая человечность не может похоронить сигнал
    const humanMitigation = Math.min(25, 0.35 * H);
    const evidenceRaw = 0.50 * R + 0.25 * C + 0.25 * B - humanMitigation + extremeSpeedBoost.current;
    const evidence = Math.max(0, Math.min(100, evidenceRaw));

    // Временное сглаживание + забывание
    suspicion.current = suspicion.current * 0.90 + evidence * 0.10;
    recentEvidence.current.push(evidence);
    if (recentEvidence.current.length > 5) recentEvidence.current.shift();
    extremeSpeedBoost.current *= 0.75;

    // Триггер: ratio вместо count (не зависит от длины буфера) + ≥2 независимых сигнала.
    // Метроном (R ≥ 60 при cv < 0.08) — самостоятельный двойной сигнал: так тапает только машина.
    // Пороги откалиброваны симуляциями (гипотезы до реальных записей):
    // человек evidence 5-6, indep ≤ 1 (никогда); джиттер-боты → триггер за 10-50с.
    const recent = recentEvidence.current;
    const enoughHistory = recent.length >= 5;
    const strongRatio = recent.length === 0 ? 0 : recent.filter((v) => v >= 12).length / recent.length;
    const veryStrongRatio = recent.length === 0 ? 0 : recent.filter((v) => v >= 20).length / recent.length;

    let cv40 = 1;
    if (t40.length >= 20) {
      const ivs40: number[] = [];
      for (let i = 1; i < t40.length; i++) ivs40.push(t40[i].t - t40[i - 1].t);
      const m40 = ivs40.reduce((a, b) => a + b, 0) / ivs40.length;
      const s40 = Math.sqrt(ivs40.reduce((a, b) => a + (b - m40) ** 2, 0) / ivs40.length);
      cv40 = m40 > 0 ? s40 / m40 : 1;
    }
    const metronome = R >= 60 && cv40 < 0.08;
    const independentSignals = (R >= 45 ? 1 : 0) + (C >= 45 ? 1 : 0) + (B >= 45 ? 1 : 0) + (metronome ? 1 : 0);
    const inCooldown = Date.now() < suspicionCooldownUntil.current;
    if (
      !inCooldown &&
      challenge === null &&
      !challengeOpening.current &&
      enoughHistory &&
      suspicion.current >= 16 &&
      strongRatio >= 0.60 &&
      veryStrongRatio >= 0.35 &&
      independentSignals >= 2
    ) {
      // Збираємо дебаг-снапшот для адміна
      const ivs: number[] = [];
      for (let i = 1; i < t40.length; i++) ivs.push(Math.round(t40[i].t - t40[i - 1].t));
      const debugSnap = {
        R: Math.round(R), C: Math.round(C), B: Math.round(B), H: Math.round(H),
        evidence: Math.round(evidence), suspicion: Math.round(suspicion.current),
        independentSignals,
        strongRatio: Math.round(strongRatio * 100) / 100,
        veryStrongRatio: Math.round(veryStrongRatio * 100) / 100,
        metronome,
        cv40: Math.round(cv40 * 1000) / 1000,
        ivs40: ivs.join('-'),
        taps40count: t40.length,
        taps300count: t300.length,
        extremeSpeedBoost: Math.round(extremeSpeedBoost.current * 10) / 10,
        ts: Date.now(),
      };
      triggerChallenge(debugSnap);
    }
  };

  const triggerChallenge = (debugSnap?: Record<string, unknown>) => {
    if (challenge !== null || challengeOpening.current) return;
    challengeOpening.current = true; // guard від double-flag race
    setChallenge({ caught: 0, x: 20 + Math.random() * 55, y: 30 + Math.random() * 32, timeLeft: 5, result: null });
    const curT = TRANSLATIONS[langRef.current];
    addToast(curT.toastBotDetect, curT.toastBotDetectDesc, '👵');
    haptic.error();
    const uid = tgUser?.id || (window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
    if (uid) {
      fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, event: 'flag', debug: debugSnap }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data?.karma === 'number') setKarma(data.karma);
          challengeOpening.current = false;
        })
        .catch(() => { challengeOpening.current = false; });
    } else {
      challengeOpening.current = false;
    }
  };

  // Кожен фізичний дотик до булки
  const markRawTap = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.nativeEvent.isTrusted) {
      // скриптові події — окремий потік для B, миттєвого тригера немає
      syntheticTaps.current.push(Date.now());
      if (syntheticTaps.current.length > 40) syntheticTaps.current.shift();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const perfT = performance.now();
    const wallT = Date.now();
    const prev = lastRawTap.current;
    lastRawTap.current = perfT;

    // Історія поведінки (слабкі сигнали для B, не тригери)
    if (prev && perfT - prev < 20000) activeNoBreakMs.current += perfT - prev;
    else activeNoBreakMs.current = 0;
    if (activeNoBreakMs.current > 90 * 60 * 1000) bLongSession.current = true;
    if (prev && perfT - prev < 125) fastStreakMs.current += perfT - prev;
    else fastStreakMs.current = 0;
    if (fastStreakMs.current > 3 * 60 * 1000) bFastStreak.current = true;

    pushTap({ t: perfT, wall: wallT, x: e.clientX - rect.left, y: e.clientY - rect.top });
    analyzeIntegrity();
  };

  /* ---- Leaderboard: report my stats + load top players ---- */
  const loadLeaders = useCallback(() => {
    setLeadersLoading(true);
    const syncPromise = tgUser?.id ? reportSync() : Promise.resolve(null);
    syncPromise.finally(() => {
      fetch(`${API_BASE}/api/leaderboard?sort=${leaderCategory}`)
        .then((r) => r.json())
        .then((data) => {
          const list: LeaderRow[] = data?.players || [];
          setLeaders(list);
          if (tgUser?.id && list.length > 0) {
            const myIdx = list.findIndex((p) => String(p.id) === String(tgUser.id));
            if (myIdx >= 0) setMyRank(myIdx + 1);
          }
        })
        .catch(() => setLeaders([]))
        .finally(() => setLeadersLoading(false));
    });
  }, [reportSync, tgUser, leaderCategory]);

  const sortedLeaders = useMemo(() => {
    if (!leaders) return null;
    const list = [...leaders];
    if (leaderCategory === 'diamonds') {
      list.sort((a, b) => ((b.diamonds || 0) - (a.diamonds || 0)) || (b.total > a.total ? 1 : b.total < a.total ? -1 : 0) || (b.prestige - a.prestige));
    } else if (leaderCategory === 'rebirth') {
      list.sort((a, b) => (b.prestige - a.prestige) || (b.total > a.total ? 1 : b.total < a.total ? -1 : 0) || ((b.diamonds || 0) - (a.diamonds || 0)));
    } else {
      list.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : (b.prestige - a.prestige) || ((b.diamonds || 0) - (a.diamonds || 0))));
    }
    return list;
  }, [leaders, leaderCategory]);

  const activeCategoryRank = useMemo(() => {
    if (!tgUser?.id || !sortedLeaders) return myRank;
    const idx = sortedLeaders.findIndex((p) => String(p.id) === String(tgUser.id));
    return idx >= 0 ? idx + 1 : null;
  }, [sortedLeaders, tgUser, myRank]);

  useEffect(() => {
    if (page === 'leaders') {
      loadLeaders();
      const iv = setInterval(loadLeaders, 15000); // авто-оновлення кожні 15с при відкритому лідерборді
      return () => clearInterval(iv);
    }
  }, [page, loadLeaders]);

  useEffect(() => {
    if (loading) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        saveNow();
        reportSync();
      }
    };
    const onExit = () => {
      saveNow();
      reportSync();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onExit);
    window.addEventListener('pagehide', onExit);

    let iv: ReturnType<typeof setInterval> | undefined;
    if (tgUser?.id) {
      reportSync();
      iv = setInterval(reportSync, 30000);
    }

    return () => {
      if (iv) clearInterval(iv);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onExit);
      window.removeEventListener('pagehide', onExit);
    };
  }, [loading, tgUser, reportSync, saveNow]);

  /* ---- Game tick ---- */
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      const gain = cpsRef.current / 10;
      if (gain > 0) setState((p) => ({ ...p, focaccia: p.focaccia + gain, total: p.total + gain }));
    }, 100);
    return () => clearInterval(iv);
  }, [loading]);

  /* ---- Combo decay ---- */
  useEffect(() => {
    const iv = setInterval(() => {
      const hasComboUp = stateRef.current.vipUpgrades?.includes('vip_combo');
      const decayDelay = hasComboUp ? 2200 : 1200;
      const decayAmount = hasComboUp ? 1 : 3;
      if (Date.now() - lastClick.current > decayDelay) setCombo((c) => (c > 0 ? Math.max(0, c - decayAmount) : 0));
    }, 200);
    return () => clearInterval(iv);
  }, []);

  /* ---- Energy regen ---- */
  useEffect(() => {
    if (!loading && state.energy <= 0 && !recharging) setRecharging(true);
  }, [loading, state.energy, recharging]);

  useEffect(() => {
    if (!recharging) return;
    const interval = Math.max(50, Math.floor(1000 / energyRegenSpeed));
    const iv = setInterval(() => {
      setState((p) => {
        let cap = MAX_ENERGY_BASE + p.prestige * 5;
        if (p.vipUpgrades?.includes('vip_energy')) cap += 25;
        const next = p.energy + 1;
        if (next >= cap) { setRecharging(false); return { ...p, energy: cap }; }
        return { ...p, energy: next };
      });
    }, interval);
    return () => clearInterval(iv);
  }, [recharging, energyRegenSpeed]);

  /* ---- Frenzy ---- */
  useEffect(() => {
    if (frenzy <= 0) return;
    const t = setTimeout(() => setFrenzy((f) => f - 1), 1000);
    return () => clearTimeout(t);
  }, [frenzy]);

  /* ---- Golden Focaccia ---- */
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let goldenHideTimeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const hasGoldenUpgrade = stateRef.current.vipUpgrades?.includes('vip_golden');
      const baseDelay = hasGoldenUpgrade ? 25000 : 50000;
      const randomExtra = hasGoldenUpgrade ? 30000 : 55000;
      timeout = setTimeout(() => {
        setGolden({ x: 10 + Math.random() * 80, y: 15 + Math.random() * 55 });
        goldenHideTimeout = setTimeout(() => setGolden(null), 9000);
        schedule();
      }, baseDelay + Math.random() * randomExtra);
    };
    schedule();
    return () => {
      clearTimeout(timeout);
      clearTimeout(goldenHideTimeout);
    };
  }, []);

  /* ---- Active Event countdown ---- */
  useEffect(() => {
    if (!activeEvent) return;
    const iv = setInterval(() => {
      setActiveEvent((e) => {
        if (!e) return null;
        if (e.timeLeft <= 1) return null;
        return { ...e, timeLeft: e.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [activeEvent]);

  /* ---- Random Events / Taxes (every 90s) ---- */
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      const roll = Math.random();
      const cur = stateRef.current;
      if (cur.total < 1000) return;
      const curT = TRANSLATIONS[langRef.current];

      if (roll < 0.35 && cur.focaccia >= 500) {
        // Tax inspection
        const hasAccountant = cur.vipUpgrades?.includes('vip_tax');
        const taxRate = hasAccountant ? 0.01 : 0.05;
        const tax = Math.max(1, Math.floor(cur.focaccia * taxRate));
        setState((p) => ({ ...p, focaccia: Math.max(0, p.focaccia - tax) }));
        addToast(curT.toastTax, formatTemplate(curT.toastTaxDesc, taxRate * 100, formatNum(tax)), '📋');
        doFlash('tax');
        haptic.medium();
      } else if (roll < 0.6) {
        // Baking Festival
        setActiveEvent({ title: langRef.current === 'uk' ? 'Свято випічки' : 'Праздник выпечки', emoji: '☀️', timeLeft: 25, cpsMult: 2.0 });
        addToast(curT.toastBakingFest, curT.toastBakingFestDesc, '🎉');
        haptic.success();
      } else if (roll < 0.8) {
        // Damp weather
        setActiveEvent({ title: langRef.current === 'uk' ? 'Сирість у печі' : 'Сырость на кухне', emoji: '🌧️', timeLeft: 20, cpsMult: 0.7 });
        addToast(curT.toastDampWeather, curT.toastDampWeatherDesc, '💨');
        haptic.error();
      } else {
        // Grandma surprise gift
        const bonus = Math.max(100, Math.floor((cpsRef.current || 10) * 90));
        setState((p) => ({ ...p, focaccia: p.focaccia + bonus, total: p.total + bonus }));
        addToast(curT.toastGrandmaGift, formatTemplate(curT.toastGrandmaGiftDesc, formatNum(bonus)), '🥐');
        haptic.success();
      }
    }, 90000);
    return () => clearInterval(iv);
  }, [loading, addToast]);

  /* ---- Pest spawner & nibble ---- */
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      if (pest || stateRef.current.total < 500) return;
      const curT = TRANSLATIONS[langRef.current];
      const pType = PEST_TYPES[Math.floor(Math.random() * PEST_TYPES.length)];
      const pName = getPestName(pType.emoji, langRef.current);
      setPest({
        id: Date.now(),
        x: 15 + Math.random() * 70,
        y: 25 + Math.random() * 45,
        name: pName,
        emoji: pType.emoji,
        dir: Math.random() < 0.5 ? 1 : -1,
      });
      addToast(curT.toastPestArrived, formatTemplate(curT.toastPestArrivedDesc, pName), pType.emoji);
      haptic.medium();
    }, 45000);
    return () => clearInterval(iv);
  }, [loading, pest, addToast]);

  // Pest auto-escape and focaccia stealing
  useEffect(() => {
    if (!pest) return;
    const escapeTimer = setTimeout(() => {
      setPest(null);
      const curT = TRANSLATIONS[langRef.current];
      addToast(curT.toastPestEscaped, curT.toastPestEscapedDesc, '🏃');
    }, 14000);

    const stealInterval = setInterval(() => {
      setState((p) => {
        if (p.focaccia <= 10) return p;
        const hasTrap = p.vipUpgrades?.includes('vip_trap');
        const loss = Math.max(1, Math.floor(p.focaccia * (hasTrap ? 0.002 : 0.005)));
        return { ...p, focaccia: Math.max(0, p.focaccia - loss) };
      });
    }, 2000);

    return () => {
      clearTimeout(escapeTimer);
      clearInterval(stealInterval);
    };
  }, [pest, addToast]);

  // Pest crawl — wanders around the screen, flipping to face its direction
  useEffect(() => {
    if (!pest) return;
    const iv = setInterval(() => {
      setPest((p) => {
        if (!p) return null;
        const dx = (Math.random() - 0.5) * 26;
        const dy = (Math.random() - 0.5) * 18;
        return {
          ...p,
          x: Math.min(82, Math.max(8, p.x + dx)),
          y: Math.min(68, Math.max(22, p.y + dy)),
          dir: dx > 0 ? -1 : 1,
        };
      });
    }, 1200);
    return () => clearInterval(iv);
  }, [pest?.id]);

  /* ---- Boss battle spawner ---- */
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      if (boss || stateRef.current.total < 3000) return;
      // Filter available bosses based on progression
      const total = stateRef.current.total;
      const prestige = stateRef.current.prestige || 0;
      const available = BOSS_TYPES.filter(
        (b) => (b.minTotal || 0) <= total && (b.minPrestige || 0) <= prestige
      );
      const pool = available.length > 0 ? available : BOSS_TYPES.slice(0, 2);
      const bType = pool[Math.floor(Math.random() * pool.length)];
      const currentCps = Math.max(10, cpsRef.current);
      const bName = getBossName(bType.id, langRef.current);
      setBoss({
        id: bType.id,
        name: bName,
        emoji: bType.emoji,
        maxHp: bType.hp,
        currentHp: bType.hp,
        timeLeft: bType.time,
        rewardDiamonds: bType.diamonds,
        rewardFocaccia: Math.max(100, Math.floor(currentCps * bType.timeCps)),
        difficulty: bType.difficulty,
      });
      addToast(curT.toastBossArrived, formatTemplate(curT.toastBossArrivedDesc, bName), bType.emoji);
      haptic.heavy();
    }, 180000);
    return () => clearInterval(iv);
  }, [loading, boss, addToast]);

  // Boss timer — deadline-based: the countdown follows wall-clock time, so it
  // keeps working even if the webview throttles or freezes background timers.
  useEffect(() => {
    if (!boss) return;
    const deadline = Date.now() + boss.timeLeft * 1000;
    let fled = false;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (!fled) setBoss((b) => (b ? { ...b, timeLeft: left } : b));
      if (left <= 0 && !fled) {
        fled = true;
        clearInterval(iv);
        const curT = TRANSLATIONS[langRef.current];
        const stolen = Math.floor(stateRef.current.focaccia * 0.1);
        if (stolen > 0) {
          setState((p) => ({ ...p, focaccia: Math.max(0, p.focaccia - stolen) }));
          addToast(curT.toastBossEscaped, formatTemplate(curT.toastBossEscapedStolen, formatNum(stolen)), '😱');
        } else {
          addToast(curT.toastBossEscaped, curT.toastBossEscapedEmpty, '😱');
        }
        haptic.error();
        setBoss(null);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [boss?.id, addToast]);

  /* ---- Building maintenance (wear & tear) ---- */
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      if (brokenBuilding) return;
      const owned = BUILDINGS.filter((b) => (stateRef.current.buildings[b.id] || 0) > 0);
      if (owned.length === 0) return;
      const target = owned[Math.floor(Math.random() * owned.length)];
      setBrokenBuilding(target.id);
      const curT = TRANSLATIONS[langRef.current];
      const bText = getBuildingText(target.id, langRef.current);
      addToast(curT.toastBuildingBroken, formatTemplate(curT.toastBuildingBrokenDesc, bText.name), '⚠️');
      haptic.error();
    }, 140000);
    return () => clearInterval(iv);
  }, [loading, brokenBuilding, addToast]);

  /* ---- Autosave ---- */
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      saveNow();
    }, 2000);
    return () => clearInterval(iv);
  }, [loading, saveNow]);

  /* ---- Achievements ---- */
  useEffect(() => {
    if (loading) return;
    const achState: AchState = {
      total: state.total, clicks: state.clicks, cps,
      buildings: state.buildings, maxCombo: state.maxCombo,
      goldenCaught: state.goldenCaught, prestige: state.prestige,
      diamonds: state.diamonds, bossesDefeated: state.bossesDefeated,
      pestsSquashed: state.pestsSquashed,
      diamondBuildings: state.diamondBuildings,
    };
    const newly = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.check(achState));
    if (newly.length) {
      setState((p) => ({
        ...p,
        achievements: [...p.achievements, ...newly.map((a) => a.id)],
      }));
      newly.forEach((a) => {
        const curT = TRANSLATIONS[langRef.current];
        const aText = getAchievementText(a.id, langRef.current);
        addToast(curT.toastAchievement, aText.name, a.emoji);
        haptic.success();
      });
    }
  }, [loading, state.total, state.clicks, cps, state.buildings, state.maxCombo, state.goldenCaught, state.prestige, state.diamonds, state.diamondBuildings, state.bossesDefeated, state.pestsSquashed, state.achievements, addToast]);

  /* ---- Випробування TapSentinel v5: таймер + авто-відкриття при підозрі ---- */
  const challengeActive = !!challenge && challenge.result === null;
  useEffect(() => {
    if (!challengeActive) return;
    const iv = setInterval(() => {
      setChallenge((c) => {
        if (!c || c.result !== null) return c;
        if (c.timeLeft <= 0.1) return { ...c, result: 'fail' };
        return { ...c, timeLeft: Math.max(0, Math.round((c.timeLeft - 0.1) * 10) / 10) };
      });
    }, 100);
    return () => clearInterval(iv);
  }, [challengeActive]);

  // Challenge провалено → карма −5 на сервері + cooldown 45с (не можна спамити спробами)
  useEffect(() => {
    if (challenge?.result !== 'fail') return;
    suspicion.current = Math.max(0, suspicion.current * 0.50);
    recentEvidence.current = [];
    suspicionCooldownUntil.current = Date.now() + 45 * 1000;
    const uid = tgUser?.id || (window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
    if (uid) {
      fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, event: 'fail' }),
      })
        .then((r) => r.json())
        .then((data) => { if (typeof data?.karma === 'number') setKarma(data.karma); })
        .catch(() => {});
    }
    const curT = TRANSLATIONS[langRef.current];
    addToast(curT.toastChallengeFail, curT.toastChallengeFailDesc, '💔');
  }, [challenge?.result, tgUser]);

  useEffect(() => {
    if (loading || karma >= 25) return;
    // «Тінь бабусі» — нагадування при глибоко посадженій кармі
    const iv = setInterval(() => {
      const curT = TRANSLATIONS[langRef.current];
      addToast(curT.toastShadowReminder, formatTemplate(curT.toastShadowReminderDesc, karma), '⏳');
    }, 90000);
    return () => clearInterval(iv);
  }, [loading, karma, addToast]);

  const catchChallengeTarget = (e: React.MouseEvent) => {
    if (!e.nativeEvent.isTrusted) return;
    if (!challenge || challenge.result !== null) return;
    haptic.light();
    const caught = challenge.caught + 1;
    if (caught >= 3) {
      setChallenge((c) => (c ? { ...c, caught, result: 'pending' } : c));
      const finishLocal = () => {
        // Cooldown PASS: suspicion гаситься, таймер кулдауну 60с
        suspicion.current *= 0.25;
        recentEvidence.current = [];
        suspicionCooldownUntil.current = Date.now() + 60 * 1000;
        setChallenge((c) => (c ? { ...c, result: 'win' } : c));
        const curT = TRANSLATIONS[langRef.current];
        addToast(curT.toastChallengeSuccess, curT.toastChallengeSuccessDesc, '🫓');
        haptic.success();
      };
      const uid = tgUser?.id || (window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
      if (uid) {
        fetch(`${API_BASE}/api/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, event: 'clear' }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (typeof data?.karma === 'number') setKarma(data.karma);
            if (data?.ok === false) {
              // «Тінь бабусі» — випробування не діє
              setChallenge((c) => (c ? { ...c, result: 'denied' } : c));
              haptic.error();
            } else {
              finishLocal();
            }
          })
          .catch(finishLocal);
      } else {
        finishLocal();
      }
    } else {
      setChallenge((c) => (c ? { ...c, caught, x: 20 + Math.random() * 55, y: 30 + Math.random() * 32 } : c));
    }
  };

  /* ---- Казино: система везіння + три ігри ---- */

  // Валюта казино: фокачі або алмази
  const casinoCurSym = casinoCur === 'gem' ? '💎' : '🫓';
  const casinoBalance = casinoCur === 'gem' ? state.diamonds : Math.floor(state.focaccia);
  const casinoTake = (b: number) => {
    const cur = stateRef.current;
    const next: SaveState = casinoCur === 'gem'
      ? { ...cur, diamonds: Math.max(0, cur.diamonds - b) }
      : { ...cur, focaccia: Math.max(0, cur.focaccia - b) };
    stateRef.current = next;
    setState(next);
    saveNow(next);
  };
  const casinoGive = (curType: 'foc' | 'gem', a: number) => {
    const cur = stateRef.current;
    const next: SaveState = curType === 'gem'
      ? { ...cur, diamonds: cur.diamonds + a }
      : { ...cur, focaccia: cur.focaccia + a };
    stateRef.current = next;
    setState(next);
    saveNow(next);
  };

  // Після кожної гри: виграш гріє «везіння», програш охолоджує
  const updateLuck = (mult: number) => {
    setState((p) => ({ ...p, luck: Math.max(-8, Math.min(12, (p.luck || 0) + mult - 0.95)) }));
  };

  const creditWin = (mult: number, combo: string, jackpot: boolean) => {
    const winAmt = Math.floor(casinoBet * mult);
    casinoGive(casinoCur, winAmt);
    const curT = TRANSLATIONS[langRef.current];
    setCasinoMsg({ text: formatTemplate(curT.winText, formatNum(winAmt), casinoCurSym, mult), win: true });
    updateLuck(mult);
    if (jackpot || mult >= 5) {
      burstConfetti(['🫓', '💎', '⭐', '✨']);
      doFlash('golden');
      addToast(curT.toastJackpot, formatTemplate(curT.toastJackpotDesc, combo, formatNum(winAmt), casinoCurSym), '💎');
      haptic.heavy();
    } else {
      haptic.success();
    }
  };

  const slotsScore = (r: [string, string, string]) => {
    if (r[0] === r[1] && r[1] === r[2]) return CASINO_PAYOUTS[r[0]];
    if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) return CASINO_PAIR_MULT;
    return 0;
  };

  const spinCasino = () => {
    if (casinoSpinning) return;
    const curT = TRANSLATIONS[langRef.current];
    if (casinoBet > casinoMaxBet) {
      addToast(curT.toastKarmaLow, formatTemplate(curT.toastKarmaMaxBet, formatNum(casinoMaxBet), casinoCurSym), '❌');
      return;
    }
    if (casinoBalance < casinoBet) {
      const curName = casinoCur === 'gem' ? curT.curDiamonds.toLowerCase() : curT.curFocaccia.toLowerCase();
      addToast(formatTemplate(curT.toastNotEnough, curName), formatTemplate(curT.toastNotEnoughDesc, formatNum(casinoBet), casinoCurSym), '❌');
      return;
    }
    setCasinoSpinning(true);
    setCasinoMsg(null);
    casinoTake(casinoBet);
    haptic.medium();

    // Фінальні барабани — з урахуванням везіння (може кинути двічі)
    let final: [string, string, string] = [randSymbol(), randSymbol(), randSymbol()];
    let finalMult = slotsScore(final);
    const luck = stateRef.current.luck || 0;
    if (luck >= 4 || luck <= -4) {
      const alt: [string, string, string] = [randSymbol(), randSymbol(), randSymbol()];
      const altMult = slotsScore(alt);
      const takeAlt = luck >= 4 ? altMult <= finalMult : altMult >= finalMult;
      if (takeAlt) { final = alt; finalMult = altMult; }
    }

    const iv = setInterval(() => {
      setCasinoReels([randSymbol(), randSymbol(), randSymbol()]);
    }, 70);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setCasinoReels((r) => [final[0], r[1], r[2]]), 500));
    timers.push(setTimeout(() => setCasinoReels((r) => [r[0], final[1], r[2]]), 950));
    timers.push(setTimeout(() => setCasinoReels((r) => [r[0], r[1], final[2]]), 1400));
    timers.push(setTimeout(() => {
      clearInterval(iv);
      timers.forEach(clearTimeout);
      setCasinoReels(final);
      setCasinoSpinning(false);

      if (finalMult > 0) {
        const winAmt = Math.floor(casinoBet * finalMult);
        casinoGive(casinoCur, winAmt);
        setCasinoMsg({ text: formatTemplate(curT.winText, formatNum(winAmt), casinoCurSym, finalMult), win: true });
        updateLuck(finalMult);
        if (finalMult >= 8) {
          burstConfetti(['🫓', '💎', '⭐', '✨']);
          doFlash('golden');
          addToast(curT.toastJackpot, formatTemplate(curT.toastJackpotDesc, `${final[0]}${final[1]}${final[2]}`, formatNum(winAmt), casinoCurSym), '💎');
          haptic.heavy();
        } else {
          haptic.success();
        }
      } else {
        setCasinoMsg({ text: curT.slotsLoss, win: false });
        updateLuck(0);
        haptic.light();
      }
    }, 1500));
  };

  const rollDice = () => {
    if (casinoSpinning) return;
    const curT = TRANSLATIONS[langRef.current];
    if (casinoBet > casinoMaxBet) {
      addToast(curT.toastKarmaLow, formatTemplate(curT.toastKarmaMaxBet, formatNum(casinoMaxBet), casinoCurSym), '❌');
      return;
    }
    if (casinoBalance < casinoBet) {
      const curName = casinoCur === 'gem' ? curT.curDiamonds.toLowerCase() : curT.curFocaccia.toLowerCase();
      addToast(formatTemplate(curT.toastNotEnough, curName), formatTemplate(curT.toastNotEnoughDesc, formatNum(casinoBet), casinoCurSym), '❌');
      return;
    }
    setCasinoSpinning(true);
    setCasinoMsg(null);
    casinoTake(casinoBet);
    haptic.medium();

    // генеруємо дуель: свій кістяк vs бабуся; рахуємо множник
    const duelMult = (mine: number, house: number) => (mine > house ? 1.9 : mine === house ? 1 : 0);
    let result = { mine: 1 + Math.floor(Math.random() * 6), house: 1 + Math.floor(Math.random() * 6) };
    let mult = duelMult(result.mine, result.house);
    const luck = stateRef.current.luck || 0;
    if (luck >= 4 || luck <= -4) {
      const alt = { mine: 1 + Math.floor(Math.random() * 6), house: 1 + Math.floor(Math.random() * 6) };
      const altMult = duelMult(alt.mine, alt.house);
      const takeAlt = luck >= 4 ? altMult <= mult : altMult >= mult;
      if (takeAlt) { result = alt; mult = altMult; }
    }

    // анімація кидка
    const iv = setInterval(() => {
      setDiceRoll({ mine: 1 + Math.floor(Math.random() * 6), house: 1 + Math.floor(Math.random() * 6) });
    }, 90);
    setTimeout(() => {
      clearInterval(iv);
      setDiceRoll(result);
      setCasinoSpinning(false);

      if (mult === 1.9) {
        const winAmt = Math.floor(casinoBet * 1.9);
        casinoGive(casinoCur, winAmt);
        setCasinoMsg({ text: formatTemplate(curT.diceWin, DICE_FACES[result.mine - 1], DICE_FACES[result.house - 1], formatNum(winAmt), casinoCurSym), win: true });
        updateLuck(1.9);
        haptic.success();
      } else if (mult === 1) {
        casinoGive(casinoCur, casinoBet); // ничья — ставка возвращается
        setCasinoMsg({ text: curT.diceTie, win: false });
        updateLuck(1);
        haptic.light();
      } else {
        setCasinoMsg({ text: formatTemplate(curT.diceLoss, DICE_FACES[result.house - 1], DICE_FACES[result.mine - 1]), win: false });
        updateLuck(0);
        haptic.light();
      }
    }, 1100);
  };

  const spinWheel = () => {
    if (casinoSpinning) return;
    const curT = TRANSLATIONS[langRef.current];
    if (casinoBet > casinoMaxBet) {
      addToast(curT.toastKarmaLow, formatTemplate(curT.toastKarmaMaxBet, formatNum(casinoMaxBet), '🫓'), '❌');
      return;
    }
    if (state.focaccia < casinoBet) {
      addToast(formatTemplate(curT.toastNotEnough, curT.curFocaccia.toLowerCase()), formatTemplate(curT.toastNotEnoughDesc, formatNum(casinoBet), '🫓'), '❌');
      return;
    }
    setCasinoSpinning(true);
    setCasinoMsg(null);
    casinoTake(casinoBet);
    haptic.medium();

    // вибір сектора з урахуванням везіння
    const pick = () => Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    let idx = pick();
    let mult = WHEEL_SEGMENTS[idx];
    const luck = stateRef.current.luck || 0;
    if (luck >= 4 || luck <= -4) {
      const alt = pick();
      const altMult = WHEEL_SEGMENTS[alt];
      const takeAlt = luck >= 4 ? altMult <= mult : altMult >= mult;
      if (takeAlt) { idx = alt; mult = altMult; }
    }

    // обертання: 4 повних оберти + докрутка до сектора (вказівник зверху)
    const current = wheelAngle;
    const targetOffset = (360 - ((idx * WHEEL_EDGE + WHEEL_EDGE / 2) % 360)) % 360;
    const target = current + 1440 + ((targetOffset - (current % 360)) % 360);
    setWheelAngle(target);

    setTimeout(() => {
      setCasinoSpinning(false);
      if (mult > 0) {
        creditWin(mult, formatTemplate(curT.wheelWin, mult), false);
      } else {
        setCasinoMsg({ text: curT.wheelLoss, win: false });
        updateLuck(0);
        haptic.light();
      }
    }, 2500);
  };

  /* ---- Actions ---- */
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!e.nativeEvent.isTrusted) {
      // Скриптовые клики не вознаграждаются и копят сигнал B (через поведение)
      syntheticTaps.current.push(Date.now());
      if (syntheticTaps.current.length > 40) syntheticTaps.current.shift();
      return;
    }
    if (state.energy <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = Date.now();
    const burning = karma < 25; // «фокачі пригорають» — Тінь бабусі
    const hasComboUp = stateRef.current.vipUpgrades?.includes('vip_combo');
    const comboDelay = hasComboUp ? 2200 : 1200;
    const newCombo = burning ? combo : (now - lastClick.current < comboDelay ? combo + 1 : 1);
    lastClick.current = now;
    setCombo(newCombo);
    if (!burning && [25, 50, 75, 100].includes(newCombo)) {
      const curT = TRANSLATIONS[langRef.current];
      showMilestone(formatTemplate(curT.milestoneCombo, newCombo));
      burstConfetti(newCombo >= 100 ? ['🔥', '💥', '⭐', '🫓'] : ['✨', '⭐']);
      haptic.success();
    }

    const hasCritUp = stateRef.current.vipUpgrades?.includes('vip_crit');
    const critChance = hasCritUp ? 0.08 : 0.05;
    const critMultVal = hasCritUp ? 12 : 10;
    const crit = !burning && Math.random() < critChance;
    const gain = clickPower * comboMult * frenzyMult * (crit ? critMultVal : 1) * (burning ? 0.05 : 1);

    setState((p) => {
      const newEnergy = p.energy - 1;
      if (newEnergy <= 0) setRecharging(true);
      return {
        ...p,
        focaccia: p.focaccia + gain,
        total: p.total + gain,
        clicks: p.clicks + 1,
        maxCombo: Math.max(p.maxCombo, newCombo),
        energy: Math.max(0, newEnergy),
      };
    });

    setClickRipple({ x, y, id: floatId.current + 1 });
    setTimeout(() => setClickRipple(null), 500);

    addFloat(x, y, `+${formatNum(gain)}${crit ? ' 💥' : ''}`, crit ? 'text-red-400 text-3xl font-black' : 'text-amber-300');
    setSquish(true);
    setTimeout(() => setSquish(false), 120);

    if (crit) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      doFlash('crit');
      const crumbBase = ++floatId.current;
      const newCrumbs: Crumb[] = Array.from({ length: 4 }, (_, i) => ({
        id: crumbBase * 10 + i,
        x, y,
        emoji: ['🫓', '🍞', '🥖', '🍪'][i],
        dx: (Math.random() - 0.5) * 70,
      }));
      setCrumbs((c) => [...c, ...newCrumbs]);
      newCrumbs.forEach((cr) => setTimeout(() => setCrumbs((c) => c.filter((x) => x.id !== cr.id)), 720));
      haptic.heavy();
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          addFloat(
            x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80,
            ['💥', '⭐', '✨', '🔥'][Math.floor(Math.random() * 4)],
            'text-2xl',
          );
        }, i * 60);
      }
    } else {
      haptic.light();
    }

    if (Math.random() < 0.15) {
      const phs = PHRASES_I18N[langRef.current];
      setPhrase(phs[Math.floor(Math.random() * phs.length)]);
    }
  };

  const attackBoss = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.heavy();

    setBoss((currentBoss) => {
      if (!currentBoss) return null;

      // Read damage from the current stateRef to avoid stale closure on vipUpgrades
      const { damage, icon } = getBossDamage(stateRef.current.vipUpgrades);
      const newHp = currentBoss.currentHp - damage;

      addFloat(window.innerWidth / 2, window.innerHeight * 0.35, `-${damage} ${icon}`, 'text-red-400 text-2xl font-black');

      if (newHp <= 0) {
        // Boss defeated — apply rewards outside this setter via setState
        const hasMagnet = stateRef.current.vipUpgrades?.includes('vip_magnet');
        const rDiamonds = currentBoss.rewardDiamonds + (hasMagnet ? 1 : 0);
        const rFocaccia = currentBoss.rewardFocaccia;
        setBossSlain({ emoji: currentBoss.emoji, id: ++floatId.current });
        doFlash('success');
        burstConfetti(['💥', '⚔️', '🏆', '✨', '🫓']);
        const cur = stateRef.current;
        const next: SaveState = {
          ...cur,
          focaccia: cur.focaccia + rFocaccia,
          total: cur.total + rFocaccia,
          diamonds: cur.diamonds + rDiamonds,
          bossesDefeated: cur.bossesDefeated + 1,
        };
        stateRef.current = next;
        setState(next);
        saveNow(next);
        const curT = TRANSLATIONS[langRef.current];
        addToast(curT.toastBossSlain, formatTemplate(curT.toastBossSlainDesc, rDiamonds, formatNum(rFocaccia)), '⚔️');
        haptic.success();
        return null; // boss cleared
      }

      return { ...currentBoss, currentHp: newHp };
    });
  };

  const squashPest = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pest) return;
    setPest(null);
    haptic.heavy();
    burstConfetti(['💀', '🪲', '✨', '⭐']);

    const hasMagnet = stateRef.current.vipUpgrades?.includes('vip_magnet');
    const gotDiamond = Math.random() < (hasMagnet ? 0.6 : 0.4);
    const bonus = Math.max(50, Math.floor((cpsRef.current || 10) * 15));
    const cur = stateRef.current;
    const next: SaveState = {
      ...cur,
      focaccia: cur.focaccia + bonus,
      total: cur.total + bonus,
      diamonds: cur.diamonds + (gotDiamond ? 1 : 0),
      pestsSquashed: cur.pestsSquashed + 1,
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);

    const curT = TRANSLATIONS[langRef.current];
    addToast(
      curT.toastPestSquashed,
      gotDiamond ? formatTemplate(curT.toastPestSquashedDiamond, formatNum(bonus)) : formatTemplate(curT.toastPestSquashedNoDiamond, formatNum(bonus)),
      '🪲',
    );
  };

  const fixBuilding = (id: string) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;
    const cur = stateRef.current;
    const cost = Math.max(50, Math.floor(b.baseCost * 0.3));
    const curT = TRANSLATIONS[langRef.current];
    const bText = getBuildingText(b.id, langRef.current);
    if (cur.focaccia < cost) {
      addToast(curT.toastNotEnoughFocaccia, formatTemplate(curT.toastRepairCost, formatNum(cost)), '❌');
      return;
    }
    const next: SaveState = { ...cur, focaccia: cur.focaccia - cost };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    setBrokenBuilding(null);
    addToast(curT.toastRepaired, formatTemplate(curT.toastRepairedDesc, bText.name), '🔧');
    haptic.success();
  };

  const buyBuilding = (id: string, isRepeat = false): boolean => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return false;
    const cur = stateRef.current;
    if ((b.requireRebirth || 0) > cur.prestige) return false;
    const cost = buildingCost(b, cur.buildings[id] || 0);
    if (cur.focaccia < cost) return false;
    const next: SaveState = {
      ...cur,
      focaccia: cur.focaccia - cost,
      buildings: { ...cur.buildings, [id]: (cur.buildings[id] || 0) + 1 },
    };
    stateRef.current = next;
    setState(next);
    setLastBoughtId(id);

    if (!isRepeat) {
      saveNow(next);
      setTimeout(() => setLastBoughtId((prev) => (prev === id ? null : prev)), 400);
      haptic.medium();
    } else {
      if (holdCountRef.current % 3 === 0) {
        haptic.light();
      }
    }
    return true;
  };

  const buyUpgrade = (id: string) => {
    const u = CLICK_UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const cur = stateRef.current;
    if (cur.focaccia < u.cost || cur.upgrades.includes(id)) return;
    const next: SaveState = {
      ...cur,
      focaccia: cur.focaccia - u.cost,
      upgrades: [...cur.upgrades, id],
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    const curT = TRANSLATIONS[langRef.current];
    const uText = getUpgradeText(u.id, langRef.current);
    addToast(curT.toastBought, uText.name, u.emoji);
    haptic.success();
  };

  const buyVipUpgrade = (id: string) => {
    const u = VIP_UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const cur = stateRef.current;
    if (cur.diamonds < u.cost || cur.vipUpgrades?.includes(id)) return;
    const next: SaveState = {
      ...cur,
      diamonds: cur.diamonds - u.cost,
      vipUpgrades: [...(cur.vipUpgrades || []), id],
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    const curT = TRANSLATIONS[langRef.current];
    const vuText = getVipUpgradeText(u.id, langRef.current);
    addToast(curT.toastVipBought, vuText.name, u.emoji);
    haptic.success();
  };

  const buyDiamondBuilding = (id: string, isRepeat = false): boolean => {
    const b = DIAMOND_BUILDINGS.find((x) => x.id === id);
    if (!b) return false;
    const cur = stateRef.current;
    if ((b.requireRebirth || 0) > cur.prestige) return false;
    const owned = cur.diamondBuildings?.[id] || 0;
    const cost = diamondBuildingCost(b, owned);
    const curT = TRANSLATIONS[langRef.current];
    const dbText = getDiamondBuildingText(b.id, langRef.current);
    if (cur.diamonds < cost) {
      if (!isRepeat) {
        addToast(curT.toastNotEnoughDiamonds, formatTemplate(curT.toastNeedDiamonds, cost), '❌');
      }
      return false;
    }
    const next: SaveState = {
      ...cur,
      diamonds: cur.diamonds - cost,
      diamondBuildings: {
        ...(cur.diamondBuildings || {}),
        [id]: owned + 1,
      },
    };
    stateRef.current = next;
    setState(next);
    setLastBoughtId(id);

    if (!isRepeat) {
      saveNow(next);
      setTimeout(() => setLastBoughtId((prev) => (prev === id ? null : prev)), 400);
      addToast(curT.toastBuilt, `${dbText.name} (${owned + 1})`, b.emoji);
      haptic.success();
    } else {
      if (holdCountRef.current % 2 === 0) {
        haptic.light();
      }
    }
    return true;
  };

  const openSupport = () => {
    haptic.selection();
    if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      (window as any).Telegram.WebApp.openTelegramLink(SUPPORT_URL);
    } else {
      window.open(SUPPORT_URL, '_blank');
    }
  };

  const addToCart = (pkgId: string) => {
    haptic.selection();
    setCart((prev) => {
      const existing = prev.find((item) => item.packageId === pkgId);
      if (pkgId === 'starter_pack') {
        if (existing) {
          addToast(
            lang === 'uk' ? 'ℹ️ Обмеження' : 'ℹ️ Ограничение',
            lang === 'uk' ? 'Стартовий набір можна додати лише 1 раз' : 'Стартовый набор можно добавить только 1 раз',
            '⚡'
          );
          return prev;
        }
        return [...prev, { packageId: pkgId, count: 1 }];
      }
      if (existing) {
        return prev.map((item) =>
          item.packageId === pkgId ? { ...item, count: Math.min(99, item.count + 1) } : item
        );
      }
      return [...prev, { packageId: pkgId, count: 1 }];
    });
    addToast(
      lang === 'uk' ? '🛒 Додано в кошик' : '🛒 Добавлено в корзину',
      lang === 'uk' ? 'Товар збережено в кошику' : 'Товар сохранён в корзине',
      '🛍️'
    );
  };

  const updateCartCount = (pkgId: string, delta: number) => {
    haptic.selection();
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.packageId === pkgId) {
            const nextCount = item.count + delta;
            return nextCount > 0 ? { ...item, count: nextCount } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (pkgId: string) => {
    haptic.light();
    setCart((prev) => prev.filter((item) => item.packageId !== pkgId));
  };

  const clearCart = () => {
    haptic.light();
    setCart([]);
  };

  const cancelOrder = (orderId: string) => {
    haptic.light();
    setSavedOrders((prev) => prev.filter((o) => o.orderId !== orderId));
    if (activeJarOrder?.orderId === orderId) setActiveJarOrder(null);
    addToast(
      lang === 'uk' ? '🗑️ Замовлення скасовано' : '🗑️ Заказ отменён',
      lang === 'uk' ? `Замовлення #${orderId} видалено зі списку` : `Заказ #${orderId} удалён из списка`,
      'ℹ️'
    );
  };

  const cartSummary = useMemo(() => {
    let totalUah = 0;
    let totalDiamonds = 0;
    let hasStarter = false;
    let hasTip = false;
    let itemsCount = 0;

    for (const it of cart) {
      const pkg = DONATE_PACKAGES.find((p) => p.id === it.packageId);
      if (pkg) {
        totalUah += pkg.priceUah * it.count;
        totalDiamonds += pkg.diamonds * it.count;
        if (pkg.isStarter) hasStarter = true;
        if (pkg.id === 'tip_dev') hasTip = true;
        itemsCount += it.count;
      }
    }

    return { totalUah, totalDiamonds, hasStarter, hasTip, itemsCount };
  }, [cart]);

  const handleBuyMono = async (pkgId: string, customVal?: number) => {
    const curUserId = tgUser?.id || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const curUsername = tgUser?.username || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username || '';
    if (!curUserId) {
      addToast(
        lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
        lang === 'uk' ? 'Не вдалося визначити Telegram ID' : 'Не удалось определить Telegram ID',
        '❌',
      );
      return;
    }

    setBuyingPackageId(pkgId);
    haptic.selection();

    try {
      const res = await fetch(`https://focaccia-bot.vercel.app/api/donate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'jar_order',
          userId: String(curUserId),
          username: curUsername,
          packageId: pkgId,
          customAmount: customVal || undefined,
        }),
      });
      const data = await res.json();

      if (!data?.ok || !data?.orderId) {
        addToast(
          lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
          data?.error || (lang === 'uk' ? 'Не вдалося створити замовлення' : 'Не удалось создать заказ'),
          '❌',
        );
        haptic.error();
        return;
      }

      const newOrder: JarOrderRecord = {
        orderId: data.orderId,
        amountUah: data.amountUah,
        diamonds: data.diamonds,
        isStarter: data.isStarter,
        isTip: data.isTip,
        comment: data.comment,
        jarUrl: data.jarUrl || MONOBANK_JAR_URL,
        title: data.title,
        items: data.items,
        createdAt: data.createdAt || Date.now(),
        status: 'pending',
      };

      setSavedOrders((prev) => [newOrder, ...prev.filter((o) => o.orderId !== newOrder.orderId)]);
      setActiveJarOrder(newOrder);
      setDonateTab('pending');
      haptic.success();
    } catch {
      addToast(
        lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
        lang === 'uk' ? 'Помилка зв’язку з сервером' : 'Ошибка связи с сервером',
        '❌',
      );
      haptic.error();
    } finally {
      setBuyingPackageId(null);
    }
  };

  const handleCheckoutCart = async () => {
    if (cart.length === 0) return;
    const curUserId = tgUser?.id || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const curUsername = tgUser?.username || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username || '';
    if (!curUserId) {
      addToast(
        lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
        lang === 'uk' ? 'Не вдалося визначити Telegram ID' : 'Не удалось определить Telegram ID',
        '❌',
      );
      return;
    }

    setBuyingPackageId('cart_checkout');
    haptic.medium();

    try {
      const res = await fetch(`https://focaccia-bot.vercel.app/api/donate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'jar_order',
          userId: String(curUserId),
          username: curUsername,
          cartItems: cart,
        }),
      });
      const data = await res.json();

      if (!data?.ok || !data?.orderId) {
        addToast(
          lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
          data?.error || (lang === 'uk' ? 'Не вдалося створити замовлення' : 'Не удалось создать заказ'),
          '❌',
        );
        haptic.error();
        return;
      }

      const newOrder: JarOrderRecord = {
        orderId: data.orderId,
        amountUah: data.amountUah,
        diamonds: data.diamonds,
        isStarter: data.isStarter,
        isTip: data.isTip,
        comment: data.comment,
        jarUrl: data.jarUrl || MONOBANK_JAR_URL,
        title: data.title,
        items: data.items,
        createdAt: data.createdAt || Date.now(),
        status: 'pending',
      };

      setSavedOrders((prev) => [newOrder, ...prev.filter((o) => o.orderId !== newOrder.orderId)]);
      setActiveJarOrder(newOrder);
      setCart([]);
      setDonateTab('pending');
      haptic.success();
    } catch {
      addToast(
        lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
        lang === 'uk' ? 'Помилка зв’язку з сервером' : 'Ошибка связи с сервером',
        '❌',
      );
      haptic.error();
    } finally {
      setBuyingPackageId(null);
    }
  };

  const awardOrderRewards = (order: { diamonds: number; isStarter?: boolean; isTip?: boolean }) => {
    burstConfetti(['💎', '💖', '✨', '👑', '🎉']);
    haptic.success();
    const diamondsToAdd = order.diamonds || 0;

    setState((p) => {
      let next = { ...p, diamonds: (p.diamonds || 0) + diamondsToAdd };
      if (order.isStarter) {
        const curVip = p.vipUpgrades || [];
        if (!curVip.includes('rolling_pin')) {
          next = { ...next, vipUpgrades: [...curVip, 'rolling_pin'] };
        }
      }
      stateRef.current = next;
      saveNow(next);
      return next;
    });

    addToast(
      lang === 'uk' ? '🎉 Оплату підтверджено!' : '🎉 Оплата подтверждена!',
      lang === 'uk'
        ? `Нараховано +${diamondsToAdd} 💎! Дякуємо за підтримку!`
        : `Начислено +${diamondsToAdd} 💎! Спасибо за поддержку!`,
      '💎',
    );
    reportSync();
  };

  const checkSingleOrder = async (orderId: string, isManual = false) => {
    if (isManual) setCheckingOrderStatus(true);
    const curUserId = tgUser?.id || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;

    try {
      const res = await fetch(
        `https://focaccia-bot.vercel.app/api/donate?action=check_order&orderId=${orderId}&userId=${curUserId || ''}`
      );
      const data = await res.json();

      if (data?.ok) {
        if (data.status === 'completed') {
          const prevOrder = savedOrders.find((o) => o.orderId === orderId);
          const wasPending = prevOrder?.status === 'pending';

          setSavedOrders((prev) =>
            prev.map((o) => (o.orderId === orderId ? { ...o, status: 'completed' } : o))
          );

          if (activeJarOrder?.orderId === orderId) {
            setActiveJarOrder((prev) => (prev ? { ...prev, status: 'completed' } : null));
          }

          if (wasPending) {
            awardOrderRewards(data);
          } else if (isManual) {
            addToast(
              lang === 'uk' ? '✅ Замовлення схвалено' : '✅ Заказ одобрен',
              lang === 'uk' ? 'Нагороду вже було нараховано' : 'Награда уже была начислена',
              '✅',
            );
          }
        } else if (data.status === 'rejected') {
          setSavedOrders((prev) =>
            prev.map((o) => (o.orderId === orderId ? { ...o, status: 'rejected' } : o))
          );
          if (activeJarOrder?.orderId === orderId) {
            setActiveJarOrder((prev) => (prev ? { ...prev, status: 'rejected' } : null));
          }
          if (isManual) {
            haptic.error();
            addToast(
              lang === 'uk' ? '❌ Замовлення відхилено' : '❌ Заказ отклонён',
              lang === 'uk'
                ? 'Кошти не надійшли на банку або невірний коментар'
                : 'Средства не поступили на банку или неверный комментарий',
              '⚠️',
            );
          }
        } else if (isManual) {
          addToast(
            lang === 'uk' ? '⏳ Очікуємо підтвердження' : '⏳ Ожидаем подтверждения',
            lang === 'uk' ? 'Автор ще перевіряє оплату в додатку Monobank' : 'Автор ещё проверяет оплату в приложении Monobank',
            '⏳',
          );
        }
      }
    } catch {
      if (isManual) {
        addToast(
          lang === 'uk' ? '⚠️ Помилка' : '⚠️ Ошибка',
          lang === 'uk' ? 'Не вдалося перевірити статус' : 'Не удалось проверить статус',
          '❌',
        );
      }
    } finally {
      if (isManual) setCheckingOrderStatus(false);
    }
  };

  useEffect(() => {
    const pending = savedOrders.filter((o) => o.status === 'pending');
    if (pending.length === 0 && (!activeJarOrder || activeJarOrder.status !== 'pending')) return;

    const interval = setInterval(() => {
      for (const ord of pending) {
        checkSingleOrder(ord.orderId, false);
      }
      if (activeJarOrder && activeJarOrder.status === 'pending' && !pending.some((o) => o.orderId === activeJarOrder.orderId)) {
        checkSingleOrder(activeJarOrder.orderId, false);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [savedOrders, activeJarOrder]);

  const copyOrderCode = (code: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement('input');
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedOrderCode(true);
      haptic.light();
      setTimeout(() => setCopiedOrderCode(false), 2500);
    } catch {
      // fallback
    }
  };

  const openMonobankJar = (url: string) => {
    haptic.selection();
    if ((window as any).Telegram?.WebApp?.openLink) {
      (window as any).Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const buyCosmetic = useCallback((type: 'frame' | 'color', id: string, cost: number) => {
    const cur = stateRef.current;
    const curT = TRANSLATIONS[langRef.current];
    if (cur.diamonds < cost) {
      addToast(curT.toastNotEnoughDiamonds, formatTemplate(curT.toastNeedDiamonds, cost), '💎');
      haptic.error();
      return;
    }
    const curCosmetics = cur.cosmetics || {
      ownedFrames: ['frame_default'],
      ownedNameColors: ['name_default'],
      equippedFrame: 'frame_default',
      equippedNameColor: 'name_default',
      showcase: ['clicks', 'total', 'diamonds'],
    };

    let nextCosmetics = { ...curCosmetics };
    let itemName = '';
    if (type === 'frame') {
      if (nextCosmetics.ownedFrames.includes(id)) return;
      nextCosmetics.ownedFrames = [...nextCosmetics.ownedFrames, id];
      nextCosmetics.equippedFrame = id;
      const f = getAvatarFrame(id);
      itemName = f.name[langRef.current];
    } else {
      if (nextCosmetics.ownedNameColors.includes(id)) return;
      nextCosmetics.ownedNameColors = [...nextCosmetics.ownedNameColors, id];
      nextCosmetics.equippedNameColor = id;
      const c = getNameColorStyle(id);
      itemName = c.name[langRef.current];
    }

    const next: SaveState = {
      ...cur,
      diamonds: cur.diamonds - cost,
      cosmetics: nextCosmetics,
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    haptic.success();
    burstConfetti(['✨', '💎', '👑', '⭐']);
    addToast(curT.toastCosmeticBought, formatTemplate(curT.toastCosmeticBoughtDesc, itemName), '💎');
    reportSync();
  }, [saveNow, addToast, reportSync]);

  const equipCosmetic = useCallback((type: 'frame' | 'color', id: string) => {
    const cur = stateRef.current;
    const curT = TRANSLATIONS[langRef.current];
    const curCosmetics = cur.cosmetics || {
      ownedFrames: ['frame_default'],
      ownedNameColors: ['name_default'],
      equippedFrame: 'frame_default',
      equippedNameColor: 'name_default',
      showcase: ['clicks', 'total', 'diamonds'],
    };

    let nextCosmetics = { ...curCosmetics };
    let itemName = '';
    if (type === 'frame') {
      if (!nextCosmetics.ownedFrames.includes(id)) return;
      nextCosmetics.equippedFrame = id;
      const f = getAvatarFrame(id);
      itemName = f.name[langRef.current];
    } else {
      if (!nextCosmetics.ownedNameColors.includes(id)) return;
      nextCosmetics.equippedNameColor = id;
      const c = getNameColorStyle(id);
      itemName = c.name[langRef.current];
    }

    const next: SaveState = {
      ...cur,
      cosmetics: nextCosmetics,
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    haptic.selection();
    addToast(curT.toastCosmeticEquipped, formatTemplate(curT.toastCosmeticEquippedDesc, itemName), '🎨');
    reportSync();
  }, [saveNow, addToast, reportSync]);

  const changeShowcaseMetric = useCallback((slotIdx: number, metricId: string) => {
    const cur = stateRef.current;
    const curCosmetics = cur.cosmetics || {
      ownedFrames: ['frame_default'],
      ownedNameColors: ['name_default'],
      equippedFrame: 'frame_default',
      equippedNameColor: 'name_default',
      showcase: ['clicks', 'total', 'diamonds'],
    };

    const nextShowcase = [...(curCosmetics.showcase || ['clicks', 'total', 'diamonds'])];
    nextShowcase[slotIdx] = metricId;

    const next: SaveState = {
      ...cur,
      cosmetics: {
        ...curCosmetics,
        showcase: nextShowcase,
      },
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    setShowcasePickerSlot(null);
    haptic.selection();
  }, [saveNow]);

  /* Hold-to-buy controllers (контролери затискання з наростаючим прискоренням) */
  const stopHoldBuy = useCallback(() => {
    if (holdInitialTimerRef.current) {
      clearTimeout(holdInitialTimerRef.current);
      holdInitialTimerRef.current = null;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldingRef.current) {
      wasHoldingRef.current = true;
      setTimeout(() => { wasHoldingRef.current = false; }, 150);
      saveNow();
      haptic.medium();
    }
    isHoldingRef.current = false;
    setHoldingBuyId(null);
    setHoldingBuyCount(0);
    holdStartPosRef.current = null;
    holdCountRef.current = 0;
  }, [saveNow]);

  const handlePointerDownBuy = useCallback((id: string, type: 'building' | 'diamond', e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (holdInitialTimerRef.current) clearTimeout(holdInitialTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    holdStartPosRef.current = { x: e.clientX, y: e.clientY };
    holdCountRef.current = 0;
    isHoldingRef.current = false;

    const buyFn = type === 'building' ? buyBuilding : buyDiamondBuilding;

    // 260ms поріг затискання без значного руху пальця
    holdInitialTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setHoldingBuyId(id);

      // Перша покупка в режимі затискання
      const initialOk = buyFn(id, true);
      if (!initialOk) {
        stopHoldBuy();
        return;
      }
      holdCountRef.current = 1;
      setHoldingBuyCount(1);
      haptic.medium();

      // Рекурсивний таймер з експоненціальним прискоренням від 220мс до 25мс
      const runLoop = () => {
        const count = holdCountRef.current;
        const delay = Math.max(25, Math.floor(220 * Math.pow(0.84, count)));

        holdTimerRef.current = setTimeout(() => {
          if (!isHoldingRef.current) return;
          const ok = buyFn(id, true);
          if (!ok) {
            stopHoldBuy();
            return;
          }
          holdCountRef.current += 1;
          setHoldingBuyCount(holdCountRef.current);
          runLoop();
        }, delay);
      };

      runLoop();
    }, 260);
  }, [saveNow, stopHoldBuy]);

  const handlePointerMoveBuy = useCallback((e: React.PointerEvent) => {
    if (holdStartPosRef.current) {
      const dist = Math.hypot(e.clientX - holdStartPosRef.current.x, e.clientY - holdStartPosRef.current.y);
      if (dist > 10) {
        // Якщо палець посунувся більше ніж на 10px (прокрутка списку) — скасовуємо затискання
        stopHoldBuy();
      }
    }
  }, [stopHoldBuy]);

  const handleClickBuilding = useCallback((id: string) => {
    if (wasHoldingRef.current || isHoldingRef.current) {
      return;
    }
    buyBuilding(id, false);
  }, []);

  const handleClickDiamondBuilding = useCallback((id: string) => {
    if (wasHoldingRef.current || isHoldingRef.current) {
      return;
    }
    buyDiamondBuilding(id, false);
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isHoldingRef.current || holdInitialTimerRef.current) {
        stopHoldBuy();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      if (holdInitialTimerRef.current) clearTimeout(holdInitialTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [stopHoldBuy]);

  const catchGolden = () => {
    setGolden(null);
    haptic.heavy();
    doFlash('golden');
    burstConfetti(['🫓', '⭐', '✨', '🌟', '💛']);
    const roll = Math.random();
    let bonus = 0;
    let dGain = 0;
    const curT = TRANSLATIONS[langRef.current];
    if (roll < 0.45) {
      const hasFrenzyUp = stateRef.current.vipUpgrades?.includes('vip_frenzy');
      const dur = hasFrenzyUp ? 25 : 20;
      const mult = hasFrenzyUp ? 8 : 7;
      setFrenzy(dur);
      addToast(curT.toastFrenzy, formatTemplate(curT.toastFrenzyDesc, mult, dur), '🔥');
    } else if (roll < 0.8) {
      bonus = Math.max(cps * 60 * 3, clickPower * 200, 50);
      addToast(curT.toastLuck, formatTemplate(curT.toastLuckDesc, formatNum(bonus)), '✨');
    } else {
      // Golden gives diamonds!
      dGain = 2;
      addToast(curT.toastDiamondTreasure, formatTemplate(curT.toastDiamondTreasureDesc, dGain), '💎');
    }
    const cur = stateRef.current;
    const next: SaveState = {
      ...cur,
      focaccia: cur.focaccia + bonus,
      total: cur.total + bonus,
      diamonds: cur.diamonds + dGain,
      goldenCaught: cur.goldenCaught + 1,
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
  };

  const doPrestige = () => {
    if (prestigeGain < 1) return;
    const curT = TRANSLATIONS[langRef.current];
    setConfirmModal({
      title: curT.modalRebirthTitle, emoji: '🔄',
      text: formatTemplate(curT.modalRebirthDesc, prestigeGain, prestigeGain * 10, prestigeGain * 5),
      confirmText: curT.confirmYes,
      onConfirm: () => {
        const cur = stateRef.current;
        const next: SaveState = {
          ...defaultState(),
          prestige: cur.prestige + prestigeGain,
          diamonds: cur.diamonds,
          vipUpgrades: cur.vipUpgrades,
          diamondBuildings: cur.diamondBuildings,
          achievements: cur.achievements,
          goldenCaught: cur.goldenCaught,
          maxCombo: cur.maxCombo,
          bossesDefeated: cur.bossesDefeated,
          pestsSquashed: cur.pestsSquashed,
          lang: cur.lang,
          lastReset: cur.lastReset,
        };
        stateRef.current = next;
        setState(next);
        saveNow(next);
        reportSync();
        addToast(curT.toastRebirthDone, formatTemplate(curT.toastRebirthDoneDesc, (cur.prestige + prestigeGain) * 10), '🔄');
        doFlash('golden');
        burstConfetti(['🔄', '💎', '✨', '⭐', '🫓']);
        haptic.success();
        setConfirmModal(null);
      },
    });
  };

  const resetGame = () => {
    const curT = TRANSLATIONS[langRef.current];
    setConfirmModal({
      title: curT.modalResetTitle, emoji: '🗑️',
      text: curT.modalResetDesc,
      confirmText: curT.confirmYes,
      onConfirm: () => {
        setConfirmModal({
          title: curT.modalResetWarnTitle, emoji: '💀',
          text: formatTemplate(curT.modalResetWarnDesc, formatNum(state.total), state.achievements.length, state.diamonds, state.prestige),
          confirmText: curT.confirmYes,
          onConfirm: () => { storage.remove(SAVE_KEY); setState(defaultState()); haptic.error(); setConfirmModal(null); },
        });
      },
    });
  };

  const totalRegularBuildings = Object.values(state.buildings).reduce((a, b) => a + b, 0);
  const totalDiamondBuildings = Object.values(state.diamondBuildings || {}).reduce((a, b) => a + b, 0);
  const totalBuildings = totalRegularBuildings + totalDiamondBuildings;
  const energyPercent = (state.energy / maxEnergy) * 100;

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6" style={{ animation: 'bob 1.5s ease-in-out infinite' }}>🫓</div>
          <div className="text-amber-400 font-black text-xl tracking-widest">{t.loading}</div>
          <div className="mt-4 w-48 h-1 bg-amber-900/50 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full" style={{ animation: 'shimmer 1.5s ease-in-out infinite', width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-screen bg-[#0d0a04] text-amber-50 font-sans select-none overflow-hidden relative flex flex-col', frenzy > 0 && 'frenzy-bg')}>
      {/* Animated BG */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.04]" style={{ background: 'radial-gradient(ellipse at 30% 20%, #fbbf24, transparent 50%), radial-gradient(ellipse at 70% 80%, #f97316, transparent 50%)', animation: 'gradient-bg 8s ease-in-out infinite', backgroundSize: '200% 200%' }} />
        {[...Array(frenzy > 0 ? 14 : 6)].map((_, i) => (
          <div
            key={i}
            className={cn('absolute text-xs', frenzy > 0 ? 'text-orange-400/30' : 'text-amber-500/20')}
            style={{
              left: `${5 + ((i * 37) % 90)}%`,
              bottom: '-10px',
              animation: `float-particle ${7 + (i % 4) * 2}s linear infinite`,
              animationDelay: `${i * 0.8}s`,
            }}
          >
            {(frenzy > 0 ? ['🔥', '💥', '⭐', '🫓'] : ['🫓', '✨', '•', '🫓', '⭐', '•'])[i % (frenzy > 0 ? 4 : 6)]}
          </div>
        ))}
      </div>

      {/* Pest crawl on screen — only on the clicker page */}
      {pest && page === 'clicker' && (
        <button
          onClick={squashPest}
          className="pest-crawl fixed z-40 p-2 cursor-pointer transition-transform active:scale-75 animate-pest"
          style={{ left: `${pest.x}%`, top: `${pest.y}%`, filter: 'drop-shadow(0 0 14px rgba(239,68,68,0.95))' }}
          title={t.pestTitle}
        >
          <span className="text-3xl inline-block" style={{ transform: `scaleX(${pest.dir})` }}>{pest.emoji}</span>
          <div className="text-[9px] bg-red-600/90 text-white font-black px-1.5 py-0.5 rounded-full whitespace-nowrap shadow mt-0.5 animate-bounce">
            {t.tapPest}
          </div>
        </button>
      )}

      {/* Golden focaccia */}
      {golden && (
        <button
          onClick={catchGolden}
          className="fixed z-40 w-18 h-18 animate-golden cursor-pointer"
          style={{ left: `${golden.x}%`, top: `${golden.y}%`, filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.8)) drop-shadow(0 0 40px rgba(251,191,36,0.4))' }}
        >
          <img src={goldenImg} alt="" className="w-full h-full object-contain" draggable={false} />
          <div className="absolute inset-[-8px] rounded-full border-2 border-amber-300/50" style={{ animation: 'ring-pulse 1.5s ease-out infinite' }} />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="animate-orbit absolute left-1/2 top-1/2 text-xs" style={{ animationDelay: `${-i * 0.55}s` }}>✨</span>
          ))}
        </button>
      )}

      {/* Screen flash */}
      {flash && (
        <div
          key={flash.id}
          className={cn(
            'animate-flash pointer-events-none fixed inset-0 z-[45]',
            flash.type === 'crit' && 'bg-red-500/20',
            flash.type === 'golden' && 'bg-amber-300/25',
            flash.type === 'success' && 'bg-emerald-400/20',
            flash.type === 'tax' && 'bg-red-600/25',
          )}
        />
      )}

      {/* Confetti rain */}
      {confetti.map((c) => (
        <span
          key={c.id}
          className="animate-confetti pointer-events-none fixed top-0 z-[46]"
          style={{ left: `${c.x}%`, fontSize: c.size, animationDelay: `${c.delay}s` }}
        >
          {c.emoji}
        </span>
      ))}

      {/* Boss slain explosion */}
      {bossSlain && (
        <div key={bossSlain.id} className="pointer-events-none fixed inset-0 z-[45] flex items-center justify-center">
          <span className="animate-boss-defeat text-[7rem]">{bossSlain.emoji}</span>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-2 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            onClick={() => { closeToast(toastItem.id); haptic.light(); }}
            className={cn(
              'animate-toast glass rounded-2xl p-3 flex items-center gap-3 shadow-2xl border border-amber-500/30 cursor-pointer active:scale-95 transition-transform',
              toastsLeaving.includes(toastItem.id) && 'toast-exit',
            )}
            title={t.toastCloseTip}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl shrink-0">{toastItem.emoji}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">{toastItem.title}</div>
              <div className="text-xs font-semibold truncate text-amber-100">{toastItem.text}</div>
            </div>
            <div className="text-amber-500/40 text-xs font-bold px-1">✕</div>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setConfirmModal(null)}>
          <div className="glass border border-amber-500/40 rounded-3xl p-7 text-center max-w-xs w-full shadow-[0_0_60px_rgba(251,191,36,0.1)]" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl mb-3">{confirmModal.emoji}</div>
            <h2 className="text-xl font-black mb-2 text-amber-100">{confirmModal.title}</h2>
            <p className="text-amber-300/80 mb-6 text-sm leading-relaxed">{confirmModal.text}</p>
            {confirmModal.isAlert ? (
              <button
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl transition active:scale-95 shadow-lg shadow-amber-500/25"
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText || t.confirmOk}
              </button>
            ) : (
              <div className="flex gap-3">
                <button className="flex-1 glass border border-amber-500/20 text-amber-200 font-bold py-3 rounded-2xl transition active:scale-95" onClick={() => setConfirmModal(null)}>{t.confirmNo}</button>
                <button className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl transition active:scale-95 shadow-lg shadow-amber-500/25" onClick={confirmModal.onConfirm}>{confirmModal.confirmText || t.confirmYes}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline modal */}
      {offlineGain !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setOfflineGain(null)}>
          <div className="glass border border-amber-500/40 rounded-3xl p-7 text-center max-w-xs w-full shadow-[0_0_60px_rgba(251,191,36,0.15)]" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className="text-6xl mb-3">😴</div>
            <h2 className="text-xl font-black mb-1 text-amber-100">{t.offlineTitle}</h2>
            <p className="text-amber-300/70 mb-3 text-sm">{t.offlineSub}</p>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300 mb-6">+{formatNum(offlineGain)} 🫓</div>
            <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl w-full transition active:scale-95 shadow-lg shadow-amber-500/25" onClick={() => { setOfflineGain(null); doFlash('golden'); burstConfetti(['🫓', '🥐', '⭐', '✨']); }}>{t.claimBtn}</button>
          </div>
        </div>
      )}

      {/* Античит-випробування «Бабуся не вірить» */}
      {challenge && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          <div className="text-5xl mb-2">👵</div>
          <h2 className="text-xl font-black text-amber-100 mb-1 text-center">{t.challengeTitle}</h2>
          {challenge.result === null && (
            <>
              <p className="text-amber-300/70 text-sm mb-4 text-center">{t.challengeDesc}</p>
              <div className="text-amber-200 font-black text-2xl tabular-nums mb-1">{challenge.caught}/3</div>
              <div className="w-48 h-2 bg-black/50 rounded-full overflow-hidden mb-6 border border-amber-500/20">
                <div className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-100" style={{ width: `${(challenge.timeLeft / 5) * 100}%` }} />
              </div>
            </>
          )}
          {challenge.result === null && (
            <button
              onClick={catchChallengeTarget}
              className="absolute w-20 h-20 rounded-full overflow-hidden border-4 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.6)] animate-bob active:scale-90 transition-transform cursor-pointer"
              style={{ left: `calc(${challenge.x}% - 40px)`, top: `calc(${challenge.y}% - 40px)` }}
            >
              <img src={focacciaImg} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
            </button>
          )}
          {challenge.result === 'pending' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3 animate-bob">⏳</div>
              <p className="text-amber-200 font-bold mb-4">{t.challengeChecking}</p>
            </div>
          )}
          {challenge.result === 'win' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3">✅</div>
              <p className="text-emerald-300 font-bold mb-5">{t.challengeWin}</p>
              <button onClick={() => setChallenge(null)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 px-8 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25">{t.challengePlayOn}</button>
            </div>
          )}
          {challenge.result === 'denied' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3">🔴</div>
              <p className="text-red-300 font-bold mb-1">{t.challengeDeniedTitle}</p>
              <p className="text-amber-300/60 text-[11px] mb-5">{t.challengeDeniedDesc}</p>
              <button onClick={() => setChallenge(null)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 px-8 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25">{t.modalUnderstand}</button>
            </div>
          )}
          {challenge.result === 'fail' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3">💀</div>
              <p className="text-red-300 font-bold mb-5">{t.challengeFailTitle}</p>
              <button
                onClick={() => setChallenge({ caught: 0, x: 20 + Math.random() * 55, y: 30 + Math.random() * 32, timeLeft: 5, result: null })}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 px-8 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25"
              >
                {t.challengeRetry}
              </button>
              <button onClick={() => setChallenge(null)} className="block mx-auto mt-3 text-xs text-amber-500/50 font-bold">{t.challengeLater}</button>
            </div>
          )}
        </div>
      )}

      {/* Меню «Що це?» — пояснення карми та зон */}
      {karmaInfo && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setKarmaInfo(false)}>
          <div
            className="glass border border-amber-500/40 rounded-3xl p-5 max-w-xs w-full max-h-[85vh] overflow-y-auto"
            style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-2 text-center">🛡</div>
            <h2 className="text-lg font-black text-amber-100 text-center mb-1">{t.karmaModalTitle}</h2>
            <p className="text-[11px] text-amber-300/70 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: t.karmaModalDesc }} />
            <div className="space-y-1.5 text-[11px] leading-relaxed mb-3">
              <div className="flex items-start gap-2">
                <span>🟢</span>
                <span><b className="text-emerald-300">{t.karmaZoneClean}</b> {t.karmaZoneCleanDesc}</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🟡</span>
                <span><b className="text-yellow-300">{t.karmaZoneSuspicious}</b> {t.karmaZoneSuspiciousDesc}</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🟠</span>
                <span><b className="text-orange-300">{t.karmaZoneBad}</b> {t.karmaZoneBadDesc}</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🔴</span>
                <span><b className="text-red-300">{t.karmaZoneShadow}</b> {t.karmaZoneShadowDesc}</span>
              </div>
            </div>
            <div className="bg-black/30 rounded-xl p-2.5 text-[11px] text-amber-300/70 leading-relaxed mb-3">
              <div className="font-black text-amber-300/80 mb-1">{t.karmaRestoreTitle}</div>
              <div dangerouslySetInnerHTML={{ __html: t.karmaRestore1 }} />
              <div dangerouslySetInnerHTML={{ __html: t.karmaRestore2 }} />
            </div>
            <button
              onClick={() => { setKarmaInfo(false); haptic.light(); }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-2.5 rounded-2xl transition active:scale-95 shadow-lg shadow-amber-500/25"
            >
              {t.modalUnderstand}
            </button>
          </div>
        </div>
      )}

      {/* ===== 💎 MONOBANK DONATE / DIAMOND STORE MODAL ===== */}
      {showDonateModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none safe-bottom animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#0c0905] border-t sm:border border-cyan-500/35 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden">
            {/* Top Ambient Glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-32 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-purple-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative shrink-0 px-4 py-3.5 border-b border-cyan-500/25 bg-gradient-to-r from-cyan-950/70 via-[#0c0905] to-blue-950/70 flex items-center justify-between z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(6,182,212,0.45)] border border-cyan-300/40 animate-diamond">
                    💎
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 border-2 border-[#0c0905]" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-amber-200 truncate tracking-wide">
                      {t.donateTitle || '💎 Банк Діамантів'}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase tracking-wider border border-cyan-500/30 shrink-0 font-mono">
                      MONO
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-300/90 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>{lang === 'uk' ? 'Банка Monobank • Миттєве зарахування' : 'Банка Monobank • Мгновенное начисление'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={openSupport}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-cyan-200 flex items-center gap-1 text-xs font-bold border border-cyan-500/35 transition active:scale-95 cursor-pointer shadow-sm"
                  title="Підтримка @hhimd"
                >
                  <span>💬</span>
                  <span className="hidden xs:inline font-mono">@{SUPPORT_USERNAME}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMonoHelp(true); haptic.selection(); }}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 flex items-center gap-1 text-xs font-bold border border-emerald-500/30 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  <span>❓</span>
                  <span className="hidden xs:inline">{lang === 'uk' ? 'Допомога' : 'Помощь'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDonateModal(false); haptic.light(); }}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold border border-white/10 transition active:scale-95 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Магазин, Кошик, Очікують) */}
            <div className="shrink-0 p-1.5 mx-3.5 my-2 rounded-2xl bg-black/60 border border-white/10 flex gap-1 shadow-inner z-10">
              <button
                type="button"
                onClick={() => { setDonateTab('shop'); haptic.selection(); }}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  donateTab === 'shop'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <span>🛍️</span>
                <span>{t.donateTabShop || 'Товари'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setDonateTab('cart'); haptic.selection(); }}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer relative',
                  donateTab === 'cart'
                    ? 'bg-gradient-to-r from-pink-500/30 to-rose-500/30 text-pink-200 border border-pink-400/50 shadow-[0_0_15px_rgba(236,72,153,0.25)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <span className={cn(cartSummary.itemsCount > 0 && 'animate-bounce-scale')}>🛒</span>
                <span>{t.donateTabCart || 'Кошик'}</span>
                {cartSummary.itemsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-mono text-[9px] font-black leading-none shadow-sm animate-badge-pop">
                    {cartSummary.itemsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setDonateTab('pending'); haptic.selection(); }}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer relative',
                  donateTab === 'pending'
                    ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <span>⏳</span>
                <span>{t.donateTabPending || 'Очікують'}</span>
                {savedOrders.filter((o) => o.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-mono text-[9px] font-black leading-none animate-pulse shadow-sm">
                    {savedOrders.filter((o) => o.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body Tabs */}
            {donateTab === 'shop' && (
              /* ===== TAB 1: SHOP PRODUCTS ===== */
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                {/* Monobank Trust Banner */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0c0905] to-teal-950/30 border border-emerald-500/30 flex items-center justify-between gap-2.5 text-[11px] shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-base shrink-0 shadow-inner">
                      💳
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="font-black text-emerald-200 truncate">
                        {lang === 'uk' ? 'Оплата на Банку Monobank' : 'Оплата на Банку Monobank'}
                      </div>
                      <div className="text-[10px] text-emerald-300/70 truncate mt-0.5">
                        {lang === 'uk' ? 'Скопіюйте код замовлення та вкажіть у коментарі' : 'Скопируйте код заказа и укажите в комментарии'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowMonoHelp(true); haptic.selection(); }}
                    className="shrink-0 px-2.5 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 font-black text-[10px] border border-emerald-500/35 active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span>❓</span>
                    <span>{lang === 'uk' ? 'Як оплатити' : 'Как платить'}</span>
                  </button>
                </div>

                {/* Hero Starter Pack Spotlight */}
                {(() => {
                  const starterPkg = DONATE_PACKAGES.find((p) => p.id === 'starter_pack');
                  if (!starterPkg) return null;
                  const isBuying = buyingPackageId === starterPkg.id;
                  const inCartItem = cart.find((it) => it.packageId === starterPkg.id);
                  const title = lang === 'uk' ? starterPkg.titleUk : starterPkg.titleRu;
                  const desc = lang === 'uk' ? starterPkg.descUk : starterPkg.descRu;

                  return (
                    <div className="relative overflow-hidden rounded-3xl p-4 donate-card-starter shadow-[0_0_30px_rgba(245,158,11,0.18)] border border-amber-400/50 group transition-all duration-300">
                      {/* Animated light sweep */}
                      <div className="animate-sheen-fast" />

                      {/* Header Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black text-[10px] tracking-wider uppercase shadow-sm shadow-amber-500/30 animate-float-badge">
                          <span>👑</span>
                          <span>{starterPkg.badge || 'ВИГІДА -70%'}</span>
                        </div>
                        <span className="text-[10px] text-amber-300/80 font-mono font-bold bg-black/40 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          {lang === 'uk' ? 'Тільки для новачків' : 'Только для новичков'}
                        </span>
                      </div>

                      {/* Main info row */}
                      <div className="flex items-start gap-3.5 mb-3 relative z-10">
                        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400/25 via-yellow-500/15 to-transparent border border-amber-400/40 flex items-center justify-center text-3xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                          ⚡
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-amber-100 flex items-center gap-1.5">
                            <span>{title}</span>
                          </h4>
                          <p className="text-[11px] text-amber-200/70 leading-snug mt-0.5">
                            {desc}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-[10px] font-black">
                              <span>💎</span>
                              <span>+100 Діамантів</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[10px] font-black">
                              <span>🪵</span>
                              <span>Бойова скалка</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-black">
                              <span>⚔️</span>
                              <span>x2 шкоди босам</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-amber-500/20 gap-3 relative z-10">
                        <div>
                          <div className="text-[10px] text-amber-400/60 uppercase font-bold tracking-wider">
                            {lang === 'uk' ? 'Ціна набору:' : 'Цена набора:'}
                          </div>
                          <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 font-mono">
                            {starterPkg.priceUah} ₴
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {inCartItem ? (
                            <div className="flex items-center gap-1.5 bg-black/70 rounded-xl px-2.5 py-1.5 border border-pink-500/50 shadow-sm">
                              <span className="text-xs font-bold text-pink-300">
                                ✓ {lang === 'uk' ? 'У кошику' : 'В корзине'}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(starterPkg.id)}
                                className="text-[10px] text-white/50 hover:text-red-300 px-1 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(starterPkg.id)}
                              className="px-3.5 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40 text-xs font-black active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                              title="Додати в кошик"
                            >
                              <span>🛒</span>
                              <span>{lang === 'uk' ? 'В кошик' : 'В корзину'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleBuyMono(starterPkg.id)}
                            disabled={!!buyingPackageId}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-amber-950 font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/25 flex items-center gap-1.5"
                          >
                            <span>⚡</span>
                            <span>{isBuying ? '...' : (lang === 'uk' ? 'Купити зараз' : 'Купить сейчас')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Diamond Bundles Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-amber-200/80 px-1 pt-1">
                    <span className="flex items-center gap-1.5">
                      <span>💎</span>
                      <span>{lang === 'uk' ? 'Набори діамантів' : 'Наборы алмазов'}</span>
                    </span>
                    <span className="text-[10px] font-medium text-emerald-400/80 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{lang === 'uk' ? 'Миттєве зарахування' : 'Мгновенное зачисление'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DONATE_PACKAGES.filter((p) => p.id !== 'tip_dev' && p.id !== 'starter_pack').map((pkg, idx) => {
                      const title = lang === 'uk' ? pkg.titleUk : pkg.titleRu;
                      const desc = lang === 'uk' ? pkg.descUk : pkg.descRu;
                      const isBuying = buyingPackageId === pkg.id;
                      const inCartItem = cart.find((it) => it.packageId === pkg.id);

                      // Card styling variant based on tier
                      let cardClass = 'donate-card-cyan';
                      if (pkg.id === 'gems_50') cardClass = 'donate-card-emerald';
                      else if (pkg.id === 'gems_150') cardClass = 'donate-card-cyan';
                      else if (pkg.id === 'gems_500') cardClass = 'donate-card-purple';
                      else if (pkg.id === 'gems_1500') cardClass = 'donate-card-starter';

                      return (
                        <div
                          key={pkg.id}
                          style={{ animationDelay: `${idx * 60}ms` }}
                          className={cn(
                            'relative overflow-hidden rounded-2xl p-3.5 transition-all duration-200 flex flex-col justify-between group animate-card hover:scale-[1.01] active:scale-[0.99]',
                            cardClass
                          )}
                        >
                          {/* Sheen sweep effect on high tiers */}
                          {(pkg.id === 'gems_500' || pkg.id === 'gems_1500') && (
                            <div className="animate-sheen-fast" />
                          )}

                          {pkg.badge && (
                            <div className={cn(
                              'absolute top-0 right-0 px-2 py-0.5 rounded-bl-xl text-[9px] font-black tracking-wider shadow-sm uppercase z-10',
                              pkg.id === 'gems_1500'
                                ? 'bg-amber-400 text-amber-950'
                                : pkg.id === 'gems_500'
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-cyan-500 text-slate-950'
                            )}>
                              {pkg.badge}
                            </div>
                          )}

                          <div className="flex items-start gap-3 mb-2.5 relative z-10">
                            <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                              {pkg.emoji}
                            </div>
                            <div className="flex-1 pr-6 min-w-0">
                              <div className="text-xs font-black text-white/90 truncate">
                                {title}
                              </div>
                              <div className="text-[10px] text-white/50 leading-snug mt-0.5 line-clamp-2">
                                {desc}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1 gap-2 relative z-10">
                            <div>
                              <div className="text-sm font-black text-cyan-300 flex items-center gap-1 font-mono">
                                <span>+{pkg.diamonds}</span>
                                <span className="text-xs">💎</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Cart stepper or add button */}
                              {inCartItem ? (
                                <div className="flex items-center gap-1 bg-black/70 rounded-xl p-0.5 border border-pink-500/40 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => updateCartCount(pkg.id, -1)}
                                    className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black cursor-pointer active:scale-95"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-black text-pink-300 px-1.5 font-mono">
                                    {inCartItem.count}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateCartCount(pkg.id, 1)}
                                    className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black cursor-pointer active:scale-95"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => addToCart(pkg.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-200 border border-pink-500/35 font-bold text-xs active:scale-95 transition cursor-pointer flex items-center gap-1"
                                  title="Додати в кошик"
                                >
                                  <span>🛒</span>
                                  <span className="text-[10px] font-black">+</span>
                                </button>
                              )}

                              {/* Direct Buy button */}
                              <button
                                type="button"
                                onClick={() => handleBuyMono(pkg.id)}
                                disabled={!!buyingPackageId}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-black text-xs transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-500/20 flex items-center gap-1"
                              >
                                {isBuying ? (
                                  <span>...</span>
                                ) : (
                                  <span>{pkg.priceUah} ₴</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ===== INTERACTIVE CUSTOM TIP SECTION (1 - 9999 ₴) ===== */}
                <div className="p-4 rounded-3xl bg-gradient-to-br from-pink-950/40 via-[#0c0905] to-purple-950/30 border border-pink-500/35 space-y-3.5 relative overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.12)]">
                  {/* Subtle ambient rose blur */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/15 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/35 flex items-center justify-center text-2xl shadow-inner shrink-0 animate-bounce-scale">
                        💖
                      </div>
                      <div>
                        <div className="text-xs font-black text-pink-200 flex items-center gap-1.5">
                          <span>{lang === 'uk' ? 'Чайові розробнику на Банку' : 'Чаевые разработчику на Банку'}</span>
                        </div>
                        <div className="text-[10px] text-pink-300/70 leading-snug mt-0.5">
                          {lang === 'uk'
                            ? '+2.5 💎 за кожну 1 ₴ та титул «Меценат» у профілі!'
                            : '+2.5 💎 за каждую 1 ₴ и титул «Меценат» в профиле!'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-500/35 text-pink-300 text-[10px] font-black font-mono shrink-0">
                      1–9999 ₴
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5 relative z-10">
                    <div className="text-[10px] font-bold text-pink-300/60 flex items-center justify-between">
                      <span>{lang === 'uk' ? 'Швидкий вибір суми:' : 'Быстрый выбор суммы:'}</span>
                      <span className="font-mono text-pink-300">{tipAmount} ₴</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[10, 25, 50, 100, 250, 500].map((preset) => {
                        const isActive = tipAmount === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => { setTipAmount(preset); haptic.selection(); }}
                            className={cn(
                              'py-1.5 px-2 rounded-xl text-[11px] font-black font-mono transition-all active:scale-95 cursor-pointer border',
                              isActive
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-300 shadow-md shadow-pink-500/30'
                                : 'bg-black/50 hover:bg-white/10 text-pink-200/80 border-pink-500/20 hover:border-pink-500/40'
                            )}
                          >
                            {preset} ₴
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Slider and Input row */}
                  <div className="space-y-2.5 relative z-10 pt-1">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={9999}
                        step={1}
                        value={tipAmount}
                        onChange={(e) => setTipAmount(Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)))}
                        style={{
                          background: `linear-gradient(to right, #ec4899 0%, #a855f7 ${((tipAmount - 1) / 9998) * 100}%, rgba(255,255,255,0.1) ${((tipAmount - 1) / 9998) * 100}%, rgba(255,255,255,0.1) 100%)`,
                        }}
                        className="flex-1 accent-pink-500 cursor-pointer h-2.5 rounded-lg appearance-none"
                      />
                      <div className="flex items-center gap-1.5 bg-black/70 border border-pink-500/40 rounded-xl px-3 py-1.5 shrink-0 shadow-inner">
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={tipAmount}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setTipAmount(isNaN(v) ? 1 : Math.max(1, Math.min(9999, v)));
                          }}
                          className="w-16 bg-transparent text-pink-100 font-black text-sm text-right focus:outline-none font-mono"
                        />
                        <span className="text-xs font-black text-pink-400">₴</span>
                      </div>
                    </div>

                    {/* Live Reward Calculation Banner */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-pink-500/20 text-xs">
                      <span className="text-white/60 font-medium">
                        {lang === 'uk' ? 'Ваша винагорода:' : 'Ваша награда:'}
                      </span>
                      <div className="flex items-center gap-2 font-black">
                        <span className="text-cyan-300 font-mono flex items-center gap-1">
                          <span>+{Math.max(1, Math.round(tipAmount * 2.5))}</span>
                          <span>💎</span>
                        </span>
                        <span className="text-pink-300 text-[11px] bg-pink-500/15 px-2 py-0.5 rounded-md border border-pink-500/30">
                          💖 {lang === 'uk' ? 'Титул «Меценат»' : 'Титул «Меценат»'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tip Donate Button */}
                  <button
                    type="button"
                    onClick={() => handleBuyMono('custom_tip', tipAmount)}
                    disabled={!!buyingPackageId}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:brightness-110 text-white font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    <span className="animate-bounce-scale">💖</span>
                    <span>
                      {buyingPackageId === 'custom_tip'
                        ? (lang === 'uk' ? 'Створення замовлення…' : 'Создание заказа…')
                        : (lang === 'uk' ? `Надіслати ${tipAmount} ₴ на Банку` : `Отправить ${tipAmount} ₴ на Банку`)}
                    </span>
                    <span>➔</span>
                  </button>
                </div>

                {/* Sticky Bottom Cart Floating Bar */}
                {cartSummary.itemsCount > 0 && (
                  <div className="sticky bottom-0 p-3 rounded-2xl bg-[#0c0905]/95 border border-pink-500/50 flex items-center justify-between gap-3 shadow-[0_0_30px_rgba(236,72,153,0.3)] animate-slide-up backdrop-blur-md z-20">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-lg shrink-0 animate-bounce-scale">
                        🛒
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-pink-200 flex items-center gap-1.5 truncate">
                          <span>{lang === 'uk' ? `У кошику ${cartSummary.itemsCount} тов.` : `В корзине ${cartSummary.itemsCount} тов.`}</span>
                          <span className="text-white/40">•</span>
                          <span className="text-emerald-400 font-mono font-black">{cartSummary.totalUah} ₴</span>
                        </div>
                        <div className="text-[10px] text-cyan-300 font-bold font-mono truncate">
                          +{cartSummary.totalDiamonds} 💎 {cartSummary.hasStarter ? '• 🪵 Скалка' : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setDonateTab('cart'); haptic.selection(); }}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:brightness-110 text-white text-xs font-black active:scale-95 transition cursor-pointer shadow-md shadow-pink-500/30 flex items-center gap-1.5"
                    >
                      <span>{lang === 'uk' ? 'До кошика' : 'В корзину'}</span>
                      <span>➔</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {donateTab === 'cart' && (
              /* ===== TAB 2: SHOPPING CART ===== */
              <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="py-12 text-center space-y-3.5 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-4xl animate-bob shadow-[0_0_30px_rgba(236,72,153,0.15)]">
                      🛒
                    </div>
                    <div>
                      <div className="text-sm font-black text-pink-200">
                        {t.cartEmpty || 'Кошик порожній'}
                      </div>
                      <p className="text-xs text-white/50 max-w-xs mt-1 leading-relaxed">
                        {t.cartEmptyDesc || 'Оберіть товари в магазині та додайте їх до кошика!'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setDonateTab('shop'); haptic.selection(); }}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 text-pink-200 border border-pink-500/40 text-xs font-black transition active:scale-95 cursor-pointer shadow-sm"
                    >
                      🛍️ {lang === 'uk' ? 'Перейти до товарів' : 'Перейти к товарам'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white/70 px-1">
                      <span>{lang === 'uk' ? 'Товари в замовленні:' : 'Товары в заказе:'}</span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-pink-400 hover:text-pink-300 text-[11px] underline cursor-pointer"
                      >
                        {lang === 'uk' ? 'Очистити все' : 'Очистить всё'}
                      </button>
                    </div>

                    {/* Cart Items List */}
                    <div className="space-y-2">
                      {cart.map((item, idx) => {
                        const pkg = DONATE_PACKAGES.find((p) => p.id === item.packageId);
                        if (!pkg) return null;
                        const title = lang === 'uk' ? pkg.titleUk : pkg.titleRu;
                        const isStarter = !!pkg.isStarter;

                        return (
                          <div
                            key={item.packageId}
                            style={{ animationDelay: `${idx * 40}ms` }}
                            className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-pink-500/30 flex items-center justify-between gap-3 transition-all animate-card"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                                {pkg.emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-black text-amber-100 truncate">
                                  {title}
                                </div>
                                <div className="text-[11px] text-cyan-300 font-bold font-mono mt-0.5">
                                  +{pkg.diamonds * item.count} 💎
                                </div>
                                <div className="text-[10px] text-white/50 font-mono">
                                  {pkg.priceUah} ₴ / шт.
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 bg-black/60 rounded-xl p-1 border border-white/10 shadow-inner">
                                <button
                                  type="button"
                                  onClick={() => updateCartCount(item.packageId, -1)}
                                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black cursor-pointer active:scale-95 transition"
                                >
                                  -
                                </button>
                                <span className="text-xs font-black text-pink-300 px-2 font-mono">
                                  {item.count}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartCount(item.packageId, 1)}
                                  disabled={isStarter}
                                  className={cn(
                                    'w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black cursor-pointer active:scale-95 transition',
                                    isStarter && 'opacity-30 cursor-not-allowed'
                                  )}
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeFromCart(item.packageId)}
                                className="w-8 h-8 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 flex items-center justify-center text-xs cursor-pointer active:scale-95 transition border border-red-500/20"
                                title="Видалити"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cart Summary Card */}
                    <div className="p-4 rounded-3xl bg-gradient-to-br from-pink-950/40 via-[#0c0905] to-rose-950/30 border border-pink-500/35 space-y-2.5 shadow-lg">
                      <div className="text-xs font-black text-pink-200 tracking-wide uppercase">
                        {lang === 'uk' ? 'Підсумок замовлення:' : 'Итог заказа:'}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-white/80">
                          <span>{lang === 'uk' ? 'Товарів у кошику:' : 'Товаров в корзине:'}</span>
                          <span className="font-bold font-mono">{cartSummary.itemsCount} шт.</span>
                        </div>
                        <div className="flex items-center justify-between text-cyan-300 font-bold font-mono">
                          <span>{lang === 'uk' ? 'Разом діамантів:' : 'Всего алмазов:'}</span>
                          <span>+{cartSummary.totalDiamonds} 💎</span>
                        </div>
                        {cartSummary.hasStarter && (
                          <div className="flex items-center justify-between text-amber-300 font-bold text-[11px]">
                            <span>{lang === 'uk' ? 'Бонус набору:' : 'Бонус набора:'}</span>
                            <span>🪵 Бойова скалка (x2 шкоди)</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm font-black">
                          <span className="text-white">{t.cartTotal || 'Всього до сплати:'}</span>
                          <span className="text-emerald-400 text-lg font-mono font-black">{cartSummary.totalUah} ₴</span>
                        </div>
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <button
                      type="button"
                      onClick={handleCheckoutCart}
                      disabled={buyingPackageId === 'cart_checkout'}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 text-white font-black text-sm transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 relative overflow-hidden"
                    >
                      <div className="animate-sheen-fast" />
                      <span>🏦</span>
                      <span>
                        {buyingPackageId === 'cart_checkout'
                          ? (lang === 'uk' ? 'Створення замовлення…' : 'Создание заказа…')
                          : (lang === 'uk' ? `Оформити замовлення (${cartSummary.totalUah} ₴)` : `Оформить заказ (${cartSummary.totalUah} ₴)`)}
                      </span>
                      <span>➔</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {donateTab === 'pending' && (
              /* ===== TAB 3: PENDING & COMPLETED ORDERS ===== */
              <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                {/* Notice banner */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-[11px] text-amber-200/90 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-black text-amber-300">
                      <span>ℹ️</span>
                      <span>{lang === 'uk' ? 'Як працює підтвердження:' : 'Как работает подтверждение:'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={openSupport}
                      className="text-[10px] text-cyan-300 underline font-bold cursor-pointer font-mono"
                    >
                      💬 @{SUPPORT_USERNAME}
                    </button>
                  </div>
                  <p className="leading-relaxed text-amber-200/80">
                    {lang === 'uk'
                      ? 'Автор перевіряє оплату в Monobank за номером замовлення та натискає «Підтвердити». Нагорода зараховується автоматично!'
                      : 'Автор проверяет оплату в Monobank по номеру заказа и нажимает «Подтвердить». Награда зачисляется автоматически!'}
                  </p>
                </div>

                {savedOrders.length === 0 ? (
                  <div className="py-12 text-center space-y-3.5 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-4xl animate-bob shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                      ⏳
                    </div>
                    <div>
                      <div className="text-sm font-black text-amber-200">
                        {t.pendingNone || 'Немає замовлень на перевірці'}
                      </div>
                      <p className="text-xs text-white/50 max-w-xs mt-1 leading-relaxed">
                        {t.pendingNoneDesc || 'Оберіть товари та оплатіть на Банку Monobank.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setDonateTab('shop'); haptic.selection(); }}
                      className="px-5 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-black transition active:scale-95 cursor-pointer shadow-sm"
                    >
                      🛍️ {lang === 'uk' ? 'Перейти до товарів' : 'Перейти к товарам'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {savedOrders.map((ord, idx) => {
                      const isPending = ord.status === 'pending';
                      const isCompleted = ord.status === 'completed';
                      const isRejected = ord.status === 'rejected';

                      return (
                        <div
                          key={ord.orderId}
                          style={{ animationDelay: `${idx * 40}ms` }}
                          className={cn(
                            'rounded-3xl p-4 border transition-all space-y-3 relative overflow-hidden animate-card',
                            isPending
                              ? 'bg-gradient-to-br from-amber-950/40 via-[#0c0905] to-yellow-950/30 border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.18)]'
                              : isCompleted
                                ? 'bg-gradient-to-br from-emerald-950/30 to-[#0c0905] border-emerald-500/30'
                                : 'bg-gradient-to-br from-red-950/30 to-[#0c0905] border-red-500/30'
                          )}
                        >
                          {/* Order Header */}
                          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                            <div>
                              <div className="text-xs font-black text-amber-200 font-mono flex items-center gap-1.5">
                                <span>🧾</span>
                                <span>#{ord.orderId}</span>
                              </div>
                              <div className="text-[10px] text-white/40 font-mono mt-0.5">
                                {new Date(ord.createdAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {isPending && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold shadow-sm">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                  <span>{lang === 'uk' ? 'Очікує схвалення' : 'Ожидает одобрения'}</span>
                                </span>
                              )}
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold shadow-sm">
                                  <span>✅</span>
                                  <span>{lang === 'uk' ? 'Схвалено' : 'Одобрено'}</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-400/50 text-red-300 text-[10px] font-bold shadow-sm">
                                  <span>❌</span>
                                  <span>{lang === 'uk' ? 'Відхилено' : 'Отклонено'}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Order Contents */}
                          <div className="space-y-1">
                            <div className="text-xs font-black text-amber-100">
                              {ord.title}
                            </div>
                            {ord.items && ord.items.length > 1 && (
                              <div className="text-[10px] text-amber-200/70 space-y-0.5 pl-2.5 border-l border-amber-500/30 font-mono">
                                {ord.items.map((it, idx2) => (
                                  <div key={idx2}>
                                    • {it.count}x {it.title} ({it.priceUah} ₴ ➔ +{it.diamonds} 💎)
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-1.5 text-xs font-bold font-mono">
                              <span className="text-cyan-300 font-black">+{ord.diamonds} 💎</span>
                              <span className="text-emerald-400 font-black text-sm">{ord.amountUah} ₴</span>
                            </div>
                          </div>

                          {/* Interactive Area for Pending Orders */}
                          {isPending && (
                            <div className="space-y-2.5 pt-1 border-t border-white/10">
                              {/* Order Code Box */}
                              <div className="p-3 rounded-2xl bg-black/60 border border-amber-500/35 space-y-1.5 shadow-inner">
                                <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
                                  <span>{lang === 'uk' ? '⚠️ Коментар до платежу (ОБОВ’ЯЗКОВО):' : '⚠️ Комментарий к платежу (ОБЯЗАТЕЛЬНО):'}</span>
                                  <span className="text-[9px] text-amber-400/60 font-mono">ID: {ord.orderId}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 font-mono font-black text-sm text-amber-200 bg-black/80 px-3 py-2 rounded-xl border border-amber-500/40 tracking-wider text-center select-all shadow-inner">
                                    {ord.comment}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyOrderCode(ord.comment)}
                                    className={cn(
                                      'px-3.5 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5 shadow-md',
                                      copiedOrderCode
                                        ? 'bg-emerald-500 text-emerald-950 font-black shadow-emerald-500/30'
                                        : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 hover:brightness-110 shadow-amber-500/30'
                                    )}
                                  >
                                    <span>{copiedOrderCode ? '✅' : '📋'}</span>
                                    <span>{copiedOrderCode ? (lang === 'uk' ? 'Скопійовано!' : 'Скопировано!') : (lang === 'uk' ? 'Копіювати' : 'Копировать')}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Buttons */}
                              <button
                                type="button"
                                onClick={() => openMonobankJar(ord.jarUrl)}
                                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 text-white font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
                              >
                                <span>🏦</span>
                                <span>{lang === 'uk' ? 'Відкрити Банку Monobank' : 'Открыть Банку Monobank'}</span>
                                <span>↗</span>
                              </button>

                              <div className="grid grid-cols-2 gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => checkSingleOrder(ord.orderId, true)}
                                  disabled={checkingOrderStatus}
                                  className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] border border-white/15 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <span className={cn(checkingOrderStatus && 'animate-spin')}>🔄</span>
                                  <span>{checkingOrderStatus ? '...' : (lang === 'uk' ? 'Перевірити статус' : 'Проверить статус')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setShowMonoHelp(true); haptic.selection(); }}
                                  className="py-2 px-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/35 font-bold text-[11px] transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <span>❓</span>
                                  <span>{lang === 'uk' ? 'Підказка' : 'Подсказка'}</span>
                                </button>
                              </div>

                              <div className="flex items-center justify-between pt-1 text-[10px]">
                                <button
                                  type="button"
                                  onClick={openSupport}
                                  className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 underline cursor-pointer"
                                >
                                  <span>💬</span>
                                  <span>{lang === 'uk' ? 'Підтримка @hhimd' : 'Поддержка @hhimd'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelOrder(ord.orderId)}
                                  className="text-red-400/70 hover:text-red-300 underline cursor-pointer"
                                >
                                  {lang === 'uk' ? 'Скасувати замовлення' : 'Отменить заказ'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Completed actions */}
                          {isCompleted && (
                            <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-[11px] text-emerald-300/90 font-medium">
                              <span>✅ {lang === 'uk' ? 'Нагорода на вашому акаунті!' : 'Награда на вашем аккаунте!'}</span>
                              <button
                                type="button"
                                onClick={() => cancelOrder(ord.orderId)}
                                className="text-white/40 hover:text-white/70 text-[10px] underline cursor-pointer"
                              >
                                {lang === 'uk' ? 'Приховати' : 'Скрыть'}
                              </button>
                            </div>
                          )}

                          {/* Rejected actions */}
                          {isRejected && (
                            <div className="flex items-center justify-between pt-1 border-t border-red-500/20 text-[11px]">
                              <button
                                type="button"
                                onClick={openSupport}
                                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer font-bold"
                              >
                                💬 {lang === 'uk' ? 'Написати в підтримку @hhimd' : 'Написать в поддержку @hhimd'}
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelOrder(ord.orderId)}
                                className="text-white/40 hover:text-white/70 text-[10px] underline cursor-pointer"
                              >
                                {lang === 'uk' ? 'Видалити' : 'Удалить'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Guarantee notice */}
            <div className="text-center pt-2.5 pb-2.5 px-4 border-t border-white/5 bg-black/50 flex items-center justify-between text-[10px] text-amber-400/60 z-10">
              <span className="flex items-center gap-1.5">
                <span>🔒</span>
                <span>{t.donateThanks || 'Дякуємо за підтримку! ❤️'}</span>
              </span>
              <button
                type="button"
                onClick={openSupport}
                className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer flex items-center gap-1 font-mono"
              >
                <span>💬</span>
                <span>@{SUPPORT_USERNAME}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MONOBANK PAYMENT HELP / SCREENSHOT MODAL ===== */}
      {showMonoHelp && (
        <div className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fade-in">
          <div className="relative w-full max-w-sm bg-[#0c0905] border border-emerald-500/40 rounded-3xl p-4 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <h4 className="text-sm font-black text-emerald-200">
                  {lang === 'uk' ? 'Куди вставляти код оплати?' : 'Куда вставлять код оплаты?'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setShowMonoHelp(false); haptic.light(); }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold cursor-pointer active:scale-95 transition"
              >
                ✕
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-black shadow-inner mb-3 shrink-0">
              <img src={monoGuideImg} alt="Monobank guide" className="w-full h-auto max-h-[44vh] object-contain mx-auto" />
            </div>

            {/* Step-by-step numbered cards */}
            <div className="space-y-2 mb-3 shrink-0">
              {[
                {
                  step: '1',
                  title: lang === 'uk' ? 'Скопіюйте код' : 'Скопируйте код',
                  text: lang === 'uk' ? 'Натисніть «Скопіювати» біля номера вашого замовлення.' : 'Нажмите «Копировать» возле номера вашего заказа.',
                },
                {
                  step: '2',
                  title: lang === 'uk' ? 'Відкрийте Банку' : 'Откройте Банку',
                  text: lang === 'uk' ? 'Перейдіть за посиланням до офіційної Банки Monobank.' : 'Перейдите по ссылке в официальную Банку Monobank.',
                },
                {
                  step: '3',
                  title: lang === 'uk' ? 'Вставте в коментар' : 'Вставьте в комментарий',
                  text: lang === 'uk' ? 'ОБОВ’ЯЗКОВО вставте скопійований код у поле коментаря платежу (показано червоною стрілкою)!' : 'ОБЯЗАТЕЛЬНО вставьте скопированный код в поле комментария платежа (показано красной стрелкой)!',
                },
                {
                  step: '4',
                  title: lang === 'uk' ? 'Отримайте нагороду' : 'Получите награду',
                  text: lang === 'uk' ? 'Щойно автор натисне підтвердити в боті, діаманти зарахуються миттєво!' : 'Как только автор нажмёт подтвердить в боте, алмазы начислятся мгновенно!',
                },
              ].map((s) => (
                <div key={s.step} className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 flex items-start gap-2.5 shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-emerald-950 font-black text-[11px] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    {s.step}
                  </span>
                  <div className="text-[11px] leading-snug">
                    <div className="font-black text-emerald-200">{s.title}</div>
                    <div className="text-amber-100/80 mt-0.5">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => { setShowMonoHelp(false); haptic.light(); }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 text-white font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {lang === 'uk' ? '👍 Все зрозуміло!' : '👍 Всё понятно!'}
            </button>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN PROFILE / ACCOUNT EDITOR ===== */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[65] bg-[#0c0905] text-amber-100 flex flex-col overflow-hidden select-none safe-top safe-bottom animate-fade-in">
          {/* Top Bar Header */}
          <div className="sticky top-0 z-30 shrink-0 bg-[#0c0905]/95 backdrop-blur-md border-b border-amber-500/20 px-3 py-2.5 flex items-center justify-between gap-2 relative">
            <button
              type="button"
              onClick={() => { setProfileModalOpen(false); setPreviewFrame(null); setPreviewColor(null); haptic.light(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-black border border-amber-500/30 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0 z-10"
            >
              <span>←</span>
              <span>{lang === 'uk' ? 'Назад' : 'Назад'}</span>
            </button>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20">
              <div className="flex items-center gap-1.5 font-black text-amber-100 text-xs sm:text-sm whitespace-nowrap truncate pointer-events-auto">
                <span>👨‍🍳</span>
                <span className="truncate">{t.profileTitle}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0 z-10">
              <button
                type="button"
                onClick={() => { setShowPublicPreview(true); haptic.light(); }}
                className="w-8 h-8 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 flex items-center justify-center text-xs font-black border border-cyan-500/35 active:scale-95 transition-all cursor-pointer shadow-sm"
                title={t.profilePreviewBtn}
              >
                <span>👁️</span>
              </button>

              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-xs font-black font-mono shadow-sm">
                <span>💎</span>
                <span className="tabular-nums">{formatNum(state.diamonds)}</span>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-lg mx-auto w-full pb-16">
            {/* HERO PROFILE CARD */}
            <div className="glass rounded-3xl p-5 border border-amber-500/30 shadow-[0_0_50px_rgba(251,191,36,0.12)] relative overflow-hidden flex flex-col items-center text-center">
              {/* Subtle radiant background glow */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Try-on indicator badge */}
              {isTryingOn && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-black shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse mb-2.5">
                  <span className="animate-spin text-sm">✨</span>
                  <span>{t.profileTryOnBadge}: {getAvatarFrame(effectiveFrameId).name[lang]} {effectiveColorId !== (state.cosmetics?.equippedNameColor || 'name_default') ? `+ ${getNameColorStyle(effectiveColorId).name[lang]}` : ''}</span>
                </div>
              )}

              {/* Avatar Frame Container */}
              <div className={cn(
                'w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center relative shadow-2xl transition-all',
                getAvatarFrame(effectiveFrameId).frameClass
              )}>
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-amber-200">
                    {(tgUser?.first_name?.[0] || '👨‍🍳').toUpperCase()}
                  </span>
                )}
                {getAvatarFrame(effectiveFrameId).cost > 0 && (
                  <div className="absolute -bottom-1 -right-1 text-xs bg-black/85 rounded-full px-2 py-0.5 border border-amber-500/40 shadow">
                    {getAvatarFrame(effectiveFrameId).emoji}
                  </div>
                )}
              </div>

              {/* Player Name & DEV Badge */}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap max-w-full">
                <span className={cn(
                  'text-xl sm:text-2xl font-black text-center max-w-full tracking-wide break-words leading-tight',
                  getNameColorStyle(effectiveColorId).colorClass
                )}>
                  {[tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || (lang === 'uk' ? 'Шеф Фокаччо' : 'Шеф Фокаччо')}
                </span>
                {isDevUser(tgUser?.id) && <DevBadge size="md" />}
              </div>

              {/* Username & ID */}
              <div className="flex items-center gap-2 mt-1">
                {tgUser?.username ? (
                  <span className="text-xs text-amber-200/60 font-mono">@{tgUser.username}</span>
                ) : null}
                <span className="text-[10px] text-amber-500/50 font-mono">ID: {tgUser?.id || '—'}</span>
              </div>

              {/* Active Style Pill */}
              <div className="mt-2.5 px-3 py-1 rounded-full bg-black/40 border border-amber-500/25 text-[11px] text-amber-300/80 flex items-center gap-1.5 shadow-sm">
                <span>{getAvatarFrame(effectiveFrameId).emoji}</span>
                <span>{getAvatarFrame(effectiveFrameId).name[lang]}</span>
                <span className="text-amber-500/40">•</span>
                <span>{getNameColorStyle(effectiveColorId).name[lang]}</span>
              </div>

              {/* Public Profile Preview Button */}
              <button
                type="button"
                onClick={() => { setShowPublicPreview(true); haptic.light(); }}
                className="mt-3.5 w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-black flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-sm group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">👁️</span>
                <span>{t.profilePreviewCardBtn}</span>
                <span className="text-[11px] text-cyan-400/60 font-mono">→</span>
              </button>

              {/* 3 Key Badges */}
              <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-3 border-t border-amber-500/20">
                <div className="bg-black/30 rounded-2xl p-2 text-center border border-amber-500/15">
                  <div className="text-base">🫓</div>
                  <div className="text-xs font-black text-amber-200 tabular-nums mt-0.5">{formatNum(state.total)}</div>
                  <div className="text-[9px] text-amber-500/60 font-medium">{t.statEaten}</div>
                </div>
                <div className="bg-black/30 rounded-2xl p-2 text-center border border-amber-500/15">
                  <div className="text-base">🔄</div>
                  <div className="text-xs font-black text-fuchsia-200 tabular-nums mt-0.5">{state.prestige}</div>
                  <div className="text-[9px] text-fuchsia-400/60 font-medium">{t.statRebirths}</div>
                </div>
                <div className="bg-black/30 rounded-2xl p-2 text-center border border-amber-500/15">
                  <div className="text-base">💎</div>
                  <div className="text-xs font-black text-cyan-200 tabular-nums mt-0.5">{formatNum(state.diamonds)}</div>
                  <div className="text-[9px] text-cyan-400/60 font-medium">{t.statDiamonds}</div>
                </div>
              </div>
            </div>

            {/* SEGMENTED NAVIGATION TABS */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/60 rounded-2xl border border-amber-500/25 sticky top-[57px] z-20 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => { setProfileTab('overview'); haptic.selection(); }}
                className={cn(
                  'py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer',
                  profileTab === 'overview'
                    ? 'bg-amber-500/25 border border-amber-400/60 text-amber-200 shadow-md shadow-amber-500/15'
                    : 'text-amber-400/60 hover:text-amber-200'
                )}
              >
                <span className="text-base">🏆</span>
                <span>{t.tabOverview}</span>
              </button>
              <button
                type="button"
                onClick={() => { setProfileTab('shop'); haptic.selection(); }}
                className={cn(
                  'py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer',
                  profileTab === 'shop'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 border border-cyan-400/60 text-cyan-200 shadow-md shadow-cyan-500/15'
                    : 'text-cyan-400/60 hover:text-cyan-200'
                )}
              >
                <span className="text-base">💎</span>
                <span>{t.profileCosmeticsTitle}</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW & SHOWCASE */}
            {profileTab === 'overview' && (
              <div className="space-y-4 animate-fade-in">
                {/* Showcase Section */}
                <div className="glass rounded-3xl p-4 border border-amber-500/20 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black text-amber-200 flex items-center gap-1.5">
                      <span>✨</span>
                      <span>{t.profileShowcaseTitle}</span>
                    </div>
                    <div className="text-[11px] text-amber-500/60">
                      {t.profileShowcaseSubtitle}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(state.cosmetics?.showcase || ['clicks', 'total', 'diamonds']).slice(0, 3).map((metricId, slotIdx) => {
                      const metric = getShowcaseMetric(metricId);
                      return (
                        <div
                          key={slotIdx}
                          className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border border-amber-500/20 shadow-sm hover:border-amber-500/35 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-black/50 border border-amber-500/25 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                              {metric.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider truncate">
                                {metric.name[lang]}
                              </div>
                              <div className="text-base font-black text-amber-100 tabular-nums truncate mt-0.5">
                                {metric.getValue(state)}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => { setShowcasePickerSlot(slotIdx); haptic.light(); }}
                            className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-black active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>✏️</span>
                            <span>{t.profileEditSlot}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All Stats Grid */}
                <div className="glass rounded-3xl p-4 border border-amber-500/20 shadow-md">
                  <div className="text-sm font-black text-amber-200 mb-3 flex items-center gap-1.5">
                    <span>📊</span>
                    <span>{lang === 'uk' ? 'Повна статистика пекарні' : 'Полная статистика пекарни'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { emoji: '🫓', val: formatNum(state.total), label: t.statEaten },
                      { emoji: '🔄', val: String(state.prestige), label: t.statRebirths },
                      { emoji: '💎', val: formatNum(state.diamonds), label: t.statDiamonds },
                      { emoji: '⚔️', val: String(state.bossesDefeated), label: t.statBosses },
                      { emoji: '🪲', val: String(state.pestsSquashed), label: t.statPests },
                      { emoji: '👆', val: state.clicks.toLocaleString(), label: t.statClicks },
                      { emoji: '⭐', val: String(state.goldenCaught), label: t.statGolden },
                      { emoji: '🏪', val: String(Object.values(state.buildings).reduce((a, b) => a + b, 0)), label: t.statBuildings },
                      { emoji: '🏆', val: `${state.achievements.length}/20`, label: t.tabAchievements },
                    ].map((st, sIdx) => (
                      <div key={sIdx} className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15 flex flex-col items-center justify-center">
                        <div className="text-lg">{st.emoji}</div>
                        <div className="font-black text-amber-100 text-xs tabular-nums mt-0.5 truncate max-w-full">{st.val}</div>
                        <div className="text-[9px] text-amber-500/60 font-medium truncate max-w-full">{st.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COSMETIC SHOP */}
            {profileTab === 'shop' && (
              <div className="space-y-4 animate-fade-in pb-12">
                {/* Try-on Hint & Shortcut Banner */}
                <div className="text-[11px] text-amber-300/80 font-medium px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 shadow-sm">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="text-base">💡</span>
                    <span className="truncate">{t.profileTryOnHint}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowPublicPreview(true); haptic.light(); }}
                    className="shrink-0 px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 text-xs font-black border border-cyan-500/40 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>👁️</span>
                    <span>{t.profileTryOnView}</span>
                  </button>
                </div>

                {/* Shop Subtabs */}
                <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-amber-500/20">
                  <button
                    type="button"
                    onClick={() => { setCosmeticShopTab('frames'); haptic.selection(); }}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                      cosmeticShopTab === 'frames'
                        ? 'bg-cyan-500/25 border border-cyan-400/60 text-cyan-200 shadow-sm'
                        : 'text-amber-300/60 hover:text-amber-200'
                    )}
                  >
                    <span>🖼️</span>
                    <span>{t.tabFrames}</span>
                    <span className="text-[10px] opacity-70">({AVATAR_FRAMES.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCosmeticShopTab('colors'); haptic.selection(); }}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                      cosmeticShopTab === 'colors'
                        ? 'bg-fuchsia-500/25 border border-fuchsia-400/60 text-fuchsia-200 shadow-sm'
                        : 'text-amber-300/60 hover:text-amber-200'
                    )}
                  >
                    <span>🎨</span>
                    <span>{t.tabColors}</span>
                    <span className="text-[10px] opacity-70">({NAME_COLOR_STYLES.length})</span>
                  </button>
                </div>

                {/* Frames List */}
                {cosmeticShopTab === 'frames' && (
                  <div className="space-y-2.5">
                    {AVATAR_FRAMES.map((f) => {
                      const isEquipped = (state.cosmetics?.equippedFrame || 'frame_default') === f.id;
                      const isPreviewed = previewFrame === f.id;
                      const isOwned = (state.cosmetics?.ownedFrames || ['frame_default']).includes(f.id);
                      const canBuy = state.diamonds >= f.cost;

                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            if (isPreviewed) setPreviewFrame(null);
                            else setPreviewFrame(f.id);
                            haptic.selection();
                          }}
                          className={cn(
                            'glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border transition-all cursor-pointer select-none active:scale-[0.99]',
                            isEquipped
                              ? 'border-emerald-400/60 bg-emerald-950/25 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : isPreviewed
                                ? 'border-cyan-400 bg-cyan-950/35 shadow-[0_0_25px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/50'
                                : 'border-amber-500/20 hover:border-amber-500/35 hover:bg-white/5'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar Preview with this frame */}
                            <div className={cn(
                              'w-13 h-13 rounded-full overflow-hidden shrink-0 flex items-center justify-center relative shadow-lg',
                              f.frameClass
                            )}>
                              {tgUser?.photo_url ? (
                                <img src={tgUser.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-base font-black text-amber-200">
                                  {(tgUser?.first_name?.[0] || '👨‍🍳').toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-black text-amber-100 flex items-center gap-1.5 truncate">
                                <span>{f.emoji}</span>
                                <span className="truncate">{f.name[lang]}</span>
                                {isPreviewed && !isEquipped && (
                                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/50 text-[10px] font-black text-cyan-200 animate-pulse">
                                    👁️ {t.profileTryOnBadge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-amber-400/70 truncate mt-0.5">
                                {f.desc[lang]}
                              </div>
                              <div className="text-xs font-black mt-1">
                                {f.cost === 0 ? (
                                  <span className="text-emerald-300 font-bold">{lang === 'uk' ? 'Безкоштовно' : 'Бесплатно'}</span>
                                ) : isOwned ? (
                                  <span className="text-emerald-400/80 font-medium text-[11px]">{lang === 'uk' ? 'Придбано' : 'Куплено'}</span>
                                ) : (
                                  <span className="text-cyan-300 font-mono">💎 {f.cost}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isEquipped ? (
                              <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1">
                                <span>✓</span>
                                <span>{t.btnEquipped}</span>
                              </div>
                            ) : isOwned ? (
                              <button
                                type="button"
                                onClick={() => {
                                  equipCosmetic('frame', f.id);
                                  if (previewFrame === f.id) setPreviewFrame(null);
                                }}
                                className="px-4 py-2 rounded-xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-xs font-black active:scale-95 transition-all cursor-pointer shadow-sm"
                              >
                                {t.btnEquip}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!canBuy}
                                onClick={() => {
                                  buyCosmetic('frame', f.id, f.cost);
                                  if (previewFrame === f.id) setPreviewFrame(null);
                                }}
                                className={cn(
                                  'px-3.5 py-2 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1.5 shadow-md',
                                  canBuy
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-cyan-500/25 cursor-pointer'
                                    : 'bg-white/5 border border-cyan-500/20 text-cyan-400/40 cursor-not-allowed'
                                )}
                              >
                                <span>💎</span>
                                <span>{f.cost}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Colors List */}
                {cosmeticShopTab === 'colors' && (
                  <div className="space-y-2.5">
                    {NAME_COLOR_STYLES.map((c) => {
                      const isEquipped = (state.cosmetics?.equippedNameColor || 'name_default') === c.id;
                      const isPreviewed = previewColor === c.id;
                      const isOwned = (state.cosmetics?.ownedNameColors || ['name_default']).includes(c.id);
                      const canBuy = state.diamonds >= c.cost;

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (isPreviewed) setPreviewColor(null);
                            else setPreviewColor(c.id);
                            haptic.selection();
                          }}
                          className={cn(
                            'glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border transition-all cursor-pointer select-none active:scale-[0.99]',
                            isEquipped
                              ? 'border-emerald-400/60 bg-emerald-950/25 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : isPreviewed
                                ? 'border-fuchsia-400 bg-fuchsia-950/35 shadow-[0_0_25px_rgba(217,70,239,0.35)] ring-2 ring-fuchsia-400/50'
                                : 'border-amber-500/20 hover:border-amber-500/35 hover:bg-white/5'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-base font-black truncate tracking-wide', c.colorClass)}>
                                {[tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || (lang === 'uk' ? 'Шеф Фокаччо' : 'Шеф Фокаччо')}
                              </span>
                              {isPreviewed && !isEquipped && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-fuchsia-400/20 border border-fuchsia-400/50 text-[10px] font-black text-fuchsia-200 animate-pulse">
                                  👁️ {t.profileTryOnBadge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-amber-500/90 font-bold mt-0.5">
                              {c.name[lang]}
                            </div>
                            <div className="text-[10px] text-amber-400/60 truncate mt-0.5">
                              {c.desc[lang]}
                            </div>
                            <div className="text-xs font-black mt-1">
                              {c.cost === 0 ? (
                                <span className="text-emerald-300 font-bold">{lang === 'uk' ? 'Безкоштовно' : 'Бесплатно'}</span>
                              ) : isOwned ? (
                                <span className="text-emerald-400/80 font-medium text-[11px]">{lang === 'uk' ? 'Придбано' : 'Куплено'}</span>
                              ) : (
                                <span className="text-cyan-300 font-mono">💎 {c.cost}</span>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isEquipped ? (
                              <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1">
                                <span>✓</span>
                                <span>{t.btnEquipped}</span>
                              </div>
                            ) : isOwned ? (
                              <button
                                type="button"
                                onClick={() => {
                                  equipCosmetic('color', c.id);
                                  if (previewColor === c.id) setPreviewColor(null);
                                }}
                                className="px-4 py-2 rounded-xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-xs font-black active:scale-95 transition-all cursor-pointer shadow-sm"
                              >
                                {t.btnEquip}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!canBuy}
                                onClick={() => {
                                  buyCosmetic('color', c.id, c.cost);
                                  if (previewColor === c.id) setPreviewColor(null);
                                }}
                                className={cn(
                                  'px-3.5 py-2 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1.5 shadow-md',
                                  canBuy
                                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white shadow-fuchsia-500/25 cursor-pointer'
                                    : 'bg-white/5 border border-fuchsia-500/20 text-fuchsia-400/40 cursor-not-allowed'
                                )}
                              >
                                <span>💎</span>
                                <span>{c.cost}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Sticky Try-On Action Bar */}
            {isTryingOn && (
              <div className="sticky bottom-2 z-40 mx-auto w-full">
                <div className="p-3 rounded-2xl bg-[#140e08]/95 backdrop-blur-xl border border-cyan-400/60 shadow-[0_0_35px_rgba(6,182,212,0.35)] flex items-center justify-between gap-2.5 animate-slide-up">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      👁️
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-cyan-200 truncate flex items-center gap-1.5">
                        <span>{t.profileTryOnBarTitle}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      </div>
                      <div className="text-[10px] text-amber-300/80 truncate mt-0.5 font-medium">
                        {getAvatarFrame(effectiveFrameId).emoji} {getAvatarFrame(effectiveFrameId).name[lang]} • {getNameColorStyle(effectiveColorId).name[lang]}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFrame(null);
                        setPreviewColor(null);
                        haptic.light();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-amber-200 text-xs font-bold border border-white/10 active:scale-95 transition-all cursor-pointer"
                    >
                      {t.profileTryOnReset}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPublicPreview(true);
                        haptic.selection();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xs font-black shadow-md shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>👁️</span>
                      <span>{t.profileTryOnView}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== PUBLIC PROFILE PREVIEW MODAL ("ЯК БАЧАТЬ ІНШІ") ===== */}
      {showPublicPreview && (
        <div className="fixed inset-0 z-[80] bg-[#0c0905] text-amber-100 flex flex-col overflow-hidden select-none safe-top safe-bottom animate-fade-in">
          {/* Informative Top Notification Banner */}
          <div className="bg-gradient-to-r from-cyan-950/90 via-blue-950/90 to-purple-950/90 border-b border-cyan-500/30 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0 text-left">
              <span className="text-base shrink-0 animate-pulse">👁️</span>
              <div className="min-w-0">
                <div className="text-xs font-black text-cyan-200 truncate">
                  {t.profilePreviewTitle}
                </div>
                <div className="text-[10px] text-cyan-300/70 truncate">
                  {t.profilePreviewNotice}
                </div>
              </div>
            </div>
            {isTryingOn && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/50 text-[10px] font-black text-cyan-200 animate-pulse">
                {t.profileTryOnBadge}
              </span>
            )}
          </div>

          {/* Top Bar Header */}
          <div className="sticky top-0 z-30 shrink-0 bg-[#0c0905]/95 backdrop-blur-md border-b border-amber-500/20 px-3 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowPublicPreview(false); haptic.light(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-black border border-amber-500/30 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0"
            >
              <span>←</span>
              <span>{lang === 'uk' ? 'Назад' : 'Назад'}</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 font-black text-amber-100 text-xs sm:text-sm whitespace-nowrap min-w-0 text-center truncate">
              <span>👤</span>
              <span className="truncate">{t.profilePreviewTitle}</span>
            </div>

            <div className="text-[11px] text-amber-500/60 font-mono shrink-0 text-right">
              ID: {tgUser?.id || '—'}
            </div>
          </div>

          {/* Scrollable Preview Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-lg mx-auto w-full pb-10">
            {/* Try-on warning banner if trying on */}
            {isTryingOn && (
              <div className="glass-card rounded-2xl p-3 border border-cyan-400/40 bg-cyan-950/20 flex items-center gap-2.5 shadow-sm">
                <span className="text-xl shrink-0">✨</span>
                <div className="text-xs text-cyan-200">
                  {t.profilePreviewTryOnNotice}
                </div>
              </div>
            )}

            {/* Hero Card */}
            <div className="glass rounded-3xl p-5 border border-amber-500/30 shadow-[0_0_50px_rgba(251,191,36,0.12)] relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Avatar with effective frame */}
              <div className={cn(
                'w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center relative shadow-2xl transition-all',
                getAvatarFrame(effectiveFrameId).frameClass
              )}>
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-amber-200">
                    {(tgUser?.first_name?.[0] || '👨‍🍳').toUpperCase()}
                  </span>
                )}
                {getAvatarFrame(effectiveFrameId).cost > 0 && (
                  <div className="absolute -bottom-1 -right-1 text-xs bg-black/85 rounded-full px-2 py-0.5 border border-amber-500/40 shadow">
                    {getAvatarFrame(effectiveFrameId).emoji}
                  </div>
                )}
              </div>

              {/* Name & DEV Badge */}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap max-w-full">
                <span className={cn(
                  'text-xl sm:text-2xl font-black text-center max-w-full tracking-wide break-words leading-tight',
                  getNameColorStyle(effectiveColorId).colorClass
                )}>
                  {[tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || (lang === 'uk' ? 'Шеф Фокаччо' : 'Шеф Фокаччо')}
                </span>
                {isDevUser(tgUser?.id) && <DevBadge size="md" />}
              </div>

              {/* Username with TG link */}
              {tgUser?.username ? (
                <button
                  type="button"
                  onClick={() => {
                    const url = `https://t.me/${tgUser.username}`;
                    if (tg?.openTelegramLink) tg.openTelegramLink(url);
                    else window.open(url, '_blank');
                    haptic.light();
                  }}
                  className="mt-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-500/30 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <span>✈️</span>
                  <span>@{tgUser.username}</span>
                </button>
              ) : null}

              {/* Online status badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold mt-2.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{lang === 'uk' ? 'В мережі (грає зараз)' : 'В сети (играет сейчас)'}</span>
              </div>

              {/* Style pill */}
              <div className="mt-3 px-3 py-1 rounded-full bg-black/40 border border-amber-500/25 text-[11px] text-amber-300/80 flex items-center gap-1.5 shadow-sm">
                <span>{getAvatarFrame(effectiveFrameId).emoji}</span>
                <span>{getAvatarFrame(effectiveFrameId).name[lang]}</span>
                <span className="text-amber-500/40">•</span>
                <span>{getNameColorStyle(effectiveColorId).name[lang]}</span>
              </div>
            </div>

            {/* Showcase (Вітрина рекордів) */}
            <div className="glass rounded-3xl p-4 border border-amber-500/20 shadow-md space-y-3">
              <div className="text-sm font-black text-amber-200 flex items-center gap-1.5">
                <span>✨</span>
                <span>{t.profileShowcaseTitle}</span>
              </div>

              <div className="space-y-2.5">
                {(state.cosmetics?.showcase || ['clicks', 'total', 'diamonds']).slice(0, 3).map((metricId, slotIdx) => {
                  const metric = getShowcaseMetric(metricId);
                  return (
                    <div
                      key={slotIdx}
                      className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border border-amber-500/20 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-black/50 border border-amber-500/25 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {metric.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider truncate">
                            {metric.name[lang]}
                          </div>
                          <div className="text-base font-black text-amber-100 tabular-nums truncate mt-0.5">
                            {metric.getValue(state)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full Statistics Grid */}
            <div className="glass rounded-3xl p-4 border border-amber-500/20 shadow-md">
              <div className="text-sm font-black text-amber-200 mb-3 flex items-center gap-1.5">
                <span>📊</span>
                <span>{lang === 'uk' ? 'Повна статистика гравця' : 'Полная статистика игрока'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🫓</div>
                  <div className="font-black text-amber-200 text-xs tabular-nums mt-0.5 truncate">{formatNum(state.total)}</div>
                  <div className="text-[9px] text-amber-500/60 font-medium truncate">{t.statEaten}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🔄</div>
                  <div className="font-black text-fuchsia-200 text-xs tabular-nums mt-0.5 truncate">{state.prestige}</div>
                  <div className="text-[9px] text-fuchsia-400/60 font-medium truncate">{t.statRebirths}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">💎</div>
                  <div className="font-black text-cyan-200 text-xs tabular-nums mt-0.5 truncate">{formatNum(state.diamonds || 0)}</div>
                  <div className="text-[9px] text-cyan-400/60 font-medium truncate">{t.statDiamonds}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🖱️</div>
                  <div className="font-black text-amber-300 text-xs tabular-nums mt-0.5 truncate">{state.clicks.toLocaleString()}</div>
                  <div className="text-[9px] text-amber-500/60 font-medium truncate">{t.statClicks}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">⚔️</div>
                  <div className="font-black text-red-300 text-xs tabular-nums mt-0.5 truncate">{state.bossesDefeated || 0}</div>
                  <div className="text-[9px] text-red-400/60 font-medium truncate">{t.statBosses}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🏆</div>
                  <div className="font-black text-yellow-300 text-xs tabular-nums mt-0.5 truncate">{state.achievements.length}/20</div>
                  <div className="text-[9px] text-amber-500/60 font-medium truncate">{lang === 'uk' ? 'Досягнень' : 'Достижений'}</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowPublicPreview(false); haptic.light(); }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>✏️</span>
                <span>{t.profilePreviewBackToEdit}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SHOWCASE PICKER MODAL ===== */}
      {showcasePickerSlot !== null && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowcasePickerSlot(null)}
        >
          <div
            className="glass border border-amber-500/40 rounded-3xl p-5 max-w-md w-full max-h-[82vh] flex flex-col overflow-hidden shadow-[0_0_60px_rgba(251,191,36,0.3)]"
            style={{ animation: 'modal-enter 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 shrink-0">
              <div className="text-sm font-black text-amber-100 flex items-center gap-2">
                <span>🎯</span>
                <span>{t.selectMetricTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowcasePickerSlot(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-amber-200/80 flex items-center justify-center text-xs font-bold cursor-pointer transition-all active:scale-95"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-0.5">
              {SHOWCASE_METRICS.map((m) => {
                const isSelected = state.cosmetics?.showcase?.[showcasePickerSlot] === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => changeShowcaseMetric(showcasePickerSlot, m.id)}
                    className={cn(
                      'w-full rounded-2xl p-3 text-left flex items-center justify-between gap-3 transition-all active:scale-98 border cursor-pointer',
                      isSelected
                        ? 'bg-amber-500/30 border-amber-400 text-amber-100 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                        : 'glass-card border-amber-500/15 text-amber-200/85 hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{m.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{m.name[lang]}</div>
                        <div className="text-[11px] text-amber-400/70 font-mono tabular-nums mt-0.5">
                          {m.getValue(state)}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-amber-300 font-black text-sm shrink-0 px-2">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== VIEWING OTHER PLAYER'S PROFILE (FULLSCREEN) ===== */}
      {viewingProfile !== null && (
        <div className="fixed inset-0 z-[65] bg-[#0c0905] text-amber-100 flex flex-col overflow-hidden select-none safe-top safe-bottom animate-fade-in">
          {/* Header */}
          <div className="sticky top-0 z-30 shrink-0 bg-[#0c0905]/95 backdrop-blur-md border-b border-amber-500/20 px-3 py-2.5 flex items-center justify-between gap-2 relative">
            <button
              type="button"
              onClick={() => { setViewingProfile(null); haptic.light(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-black border border-amber-500/30 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0 z-10"
            >
              <span>←</span>
              <span>{lang === 'uk' ? 'Назад' : 'Назад'}</span>
            </button>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20">
              <div className="flex items-center gap-1.5 font-black text-amber-100 text-xs sm:text-sm whitespace-nowrap truncate pointer-events-auto">
                <span>👤</span>
                <span className="truncate">{lang === 'uk' ? 'Акаунт гравця' : 'Аккаунт игрока'}</span>
              </div>
            </div>

            <div className="text-[11px] text-amber-500/60 font-mono shrink-0 text-right z-10">
              ID: {viewingProfile.id}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-lg mx-auto w-full pb-10">
            {/* Hero Card */}
            <div className="glass rounded-3xl p-5 border border-amber-500/30 shadow-[0_0_50px_rgba(251,191,36,0.12)] relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className={cn(
                'w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center relative shadow-2xl transition-all',
                getAvatarFrame(viewingProfile.frame).frameClass
              )}>
                {viewingProfile.avatar ? (
                  <img src={viewingProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-amber-200">
                    {(viewingProfile.name?.[0] || '👨‍🍳').toUpperCase()}
                  </span>
                )}
                {getAvatarFrame(viewingProfile.frame).cost > 0 && (
                  <div className="absolute -bottom-1 -right-1 text-xs bg-black/85 rounded-full px-2 py-0.5 border border-amber-500/40 shadow">
                    {getAvatarFrame(viewingProfile.frame).emoji}
                  </div>
                )}
              </div>

              {/* Name & DEV Badge */}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap max-w-full">
                <span className={cn(
                  'text-xl sm:text-2xl font-black text-center max-w-full tracking-wide break-words leading-tight',
                  getNameColorStyle(viewingProfile.color).colorClass
                )}>
                  {viewingProfile.name || (lang === 'uk' ? 'Гравець' : 'Игрок')}
                </span>
                {isDevUser(viewingProfile.id) && <DevBadge size="md" />}
              </div>

              {/* Username with TG link */}
              {viewingProfile.username ? (
                <button
                  type="button"
                  onClick={() => {
                    const url = `https://t.me/${viewingProfile.username}`;
                    if (tg?.openTelegramLink) tg.openTelegramLink(url);
                    else window.open(url, '_blank');
                    haptic.light();
                  }}
                  className="mt-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-500/30 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <span>✈️</span>
                  <span>@{viewingProfile.username}</span>
                </button>
              ) : null}

              {/* Online status */}
              {viewingProfile.online ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold mt-2.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{lang === 'uk' ? 'В мережі (грає зараз)' : 'В сети (играет сейчас)'}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-amber-400/50 text-xs font-medium mt-2.5">
                  <span>⚪</span>
                  <span>{lang === 'uk' ? 'Був нещодавно' : 'Был недавно'}</span>
                </div>
              )}

              {/* Style pill */}
              <div className="mt-3 px-3 py-1 rounded-full bg-black/40 border border-amber-500/25 text-[11px] text-amber-300/80 flex items-center gap-1.5 shadow-sm">
                <span>{getAvatarFrame(viewingProfile.frame).emoji}</span>
                <span>{getAvatarFrame(viewingProfile.frame).name[lang]}</span>
                <span className="text-amber-500/40">•</span>
                <span>{getNameColorStyle(viewingProfile.color).name[lang]}</span>
              </div>
            </div>

            {/* Showcase (Вітрина рекордів) */}
            <div className="glass rounded-3xl p-4 border border-amber-500/20 shadow-md space-y-3">
              <div className="text-sm font-black text-amber-200 flex items-center gap-1.5">
                <span>✨</span>
                <span>{t.profileShowcaseTitle}</span>
              </div>

              <div className="space-y-2.5">
                {(viewingProfile.showcase || ['clicks', 'total', 'diamonds']).slice(0, 3).map((metricId, slotIdx) => {
                  const metric = getShowcaseMetric(metricId);
                  let val: string | number = '—';
                  if (metric.id === 'clicks') val = (viewingProfile.clicks || 0).toLocaleString();
                  else if (metric.id === 'total') val = formatNum(viewingProfile.total);
                  else if (metric.id === 'prestige') val = (viewingProfile.prestige || 0).toLocaleString();
                  else if (metric.id === 'diamonds') val = (viewingProfile.diamonds || 0).toLocaleString();
                  else if (metric.id === 'bosses') val = (viewingProfile.bosses || 0).toLocaleString();
                  else if (metric.id === 'achievements') val = `${viewingProfile.achievements || 0}/20`;
                  else {
                    val = metric.getValue({
                      clicks: viewingProfile.clicks || 0,
                      total: viewingProfile.total || 0,
                      prestige: viewingProfile.prestige || 0,
                      diamonds: viewingProfile.diamonds || 0,
                      bossesDefeated: viewingProfile.bosses || 0,
                      achievements: Array(viewingProfile.achievements || 0),
                    });
                  }

                  return (
                    <div
                      key={slotIdx}
                      className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border border-amber-500/20 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-black/50 border border-amber-500/25 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {metric.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider truncate">
                            {metric.name[lang]}
                          </div>
                          <div className="text-base font-black text-amber-100 tabular-nums truncate mt-0.5">
                            {val}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full Statistics Grid */}
            <div className="glass rounded-3xl p-4 border border-amber-500/20 shadow-md">
              <div className="text-sm font-black text-amber-200 mb-3 flex items-center gap-1.5">
                <span>📊</span>
                <span>{lang === 'uk' ? 'Повна статистика гравця' : 'Полная статистика игрока'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🫓</div>
                  <div className="font-black text-amber-200 text-xs tabular-nums mt-0.5 truncate">{formatNum(viewingProfile.total)}</div>
                  <div className="text-[9px] text-amber-500/60 font-medium truncate">{t.statEaten}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🔄</div>
                  <div className="font-black text-fuchsia-200 text-xs tabular-nums mt-0.5 truncate">{viewingProfile.prestige}</div>
                  <div className="text-[9px] text-fuchsia-400/60 font-medium truncate">{t.statRebirths}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">💎</div>
                  <div className="font-black text-cyan-200 text-xs tabular-nums mt-0.5 truncate">{formatNum(viewingProfile.diamonds || 0)}</div>
                  <div className="text-[9px] text-cyan-400/60 font-medium truncate">{t.statDiamonds}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🖱️</div>
                  <div className="font-black text-amber-300 text-xs tabular-nums mt-0.5 truncate">{formatNum(viewingProfile.clicks || 0)}</div>
                  <div className="text-[9px] text-amber-500/60 font-medium truncate">{t.statClicks}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">⚔️</div>
                  <div className="font-black text-red-300 text-xs tabular-nums mt-0.5 truncate">{viewingProfile.bosses || 0}</div>
                  <div className="text-[9px] text-red-400/60 font-medium truncate">{t.statBosses}</div>
                </div>
                <div className="glass-card rounded-2xl p-2.5 text-center border border-amber-500/15">
                  <div className="text-lg">🏆</div>
                  <div className="font-black text-yellow-300 text-xs tabular-nums mt-0.5 truncate">{viewingProfile.achievements || 0}/20</div>
                  <div className="text-[9px] text-amber-500/60 font-medium truncate">{lang === 'uk' ? 'Досягнень' : 'Достижений'}</div>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => { setViewingProfile(null); haptic.light(); }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              {lang === 'uk' ? '← Повернутися' : '← Вернуться'}
            </button>
          </div>
        </div>
      )}

      {/* ===== TOP BAR ===== */}
      <div className="relative z-10 shrink-0 glass border-b border-amber-500/15 px-3.5 py-2 select-none">
        {/* Row 1: Primary Balances (Focaccia on left, Diamonds & Rebirth on right) */}
        <div className="flex items-center justify-between gap-2">
          {/* Main Focaccia Counter & Profile Avatar Button */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => { setProfileModalOpen(true); haptic.light(); }}
              className="relative shrink-0 active:scale-90 transition-transform cursor-pointer group"
              title={t.profileTitle}
            >
              <div className={cn(
                'w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-all shadow-md',
                getAvatarFrame(state.cosmetics?.equippedFrame).frameClass
              )}>
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base font-black text-amber-200">
                    {(tgUser?.first_name?.[0] || '👨‍🍳').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-black/80 rounded-full border border-amber-500/40 w-4 h-4 flex items-center justify-center text-[9px] shadow">
                {getAvatarFrame(state.cosmetics?.equippedFrame).emoji}
              </div>
            </button>

            <div key={state.clicks} className="animate-num-pop text-2xl font-black tabular-nums leading-none tracking-tight">
              <span className={cn('text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300', frenzy > 0 && 'animate-rainbow')}>
                {formatNum(state.focaccia)}
              </span>
              <span className="text-xl ml-1">🫓</span>
            </div>
          </div>

          {/* Persistent Meta-Currencies (Diamonds & Rebirth) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Diamonds Pill */}
            <button
              type="button"
              onClick={() => { setShowDonateModal(true); haptic.selection(); }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 active:scale-95 transition-all border border-cyan-400/40 px-2 py-0.5 rounded-lg text-xs font-black text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)] whitespace-nowrap cursor-pointer group"
              title={lang === 'uk' ? '💎 Банк Діамантів (Stars)' : '💎 Банк Алмазов (Stars)'}
            >
              <span className="animate-diamond">💎</span>
              <span className="tabular-nums font-mono">{formatNum(state.diamonds)}</span>
              <span className="text-[10px] bg-cyan-400/25 text-cyan-200 px-1 rounded font-bold border border-cyan-400/30 group-hover:scale-110 transition-transform leading-none">+</span>
            </button>

            {/* Rebirth Pill */}
            {state.prestige > 0 && (
              <button
                type="button"
                onClick={() => goPage('settings')}
                className="flex items-center gap-1 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 active:scale-95 transition-all border border-fuchsia-500/30 px-2 py-0.5 rounded-lg text-xs font-black text-fuchsia-300 shadow-[0_0_8px_rgba(217,70,239,0.15)] whitespace-nowrap cursor-pointer"
                title={lang === 'uk' 
                  ? `🔄 Ребіртх: ${state.prestige.toLocaleString()} (+${(state.prestige * 10).toLocaleString()}%)` 
                  : `🔄 Ребиртх: ${state.prestige.toLocaleString()} (+${(state.prestige * 10).toLocaleString()}%)`}
              >
                <span>🔄</span>
                <span className="tabular-nums font-mono">{formatNum(state.prestige)}</span>
                <span className="text-[10px] font-bold text-fuchsia-300/80">+{formatNum(state.prestige * 10)}%</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Production Rates & Active Buffs / Alerts */}
        <div className="flex items-center justify-between gap-2 mt-1 min-h-[18px]">
          {/* Income Rates */}
          <div className="text-amber-400/70 text-[11px] font-medium truncate flex items-center gap-1.5 tabular-nums">
            <span>{formatCps(cps * frenzyMult)}{t.topBarPerSec}</span>
            <span className="text-amber-500/30 font-bold">•</span>
            <span>{formatNum(clickPower * comboMult * frenzyMult)}{t.topBarPerClick}</span>
          </div>

          {/* Active Buffs / Temporary Statuses */}
          <div className="flex items-center gap-1.5 shrink-0">
            {brokenBuilding && (
              <button
                type="button"
                onClick={() => { goPage('shop'); setShopTab('buildings'); }}
                className="cursor-pointer active:scale-95 transition-all text-red-300 text-[10px] font-black bg-red-500/25 hover:bg-red-500/35 px-2 py-0.5 rounded-full border border-red-500/40 animate-pulse flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.3)] whitespace-nowrap"
              >
                <span>🔧</span>
                <span>{t.topBarBroken}</span>
              </button>
            )}
            {activeEvent && (
              <div className={cn(
                'text-[10px] font-black px-2 py-0.5 rounded-full border animate-pulse flex items-center gap-1 whitespace-nowrap',
                activeEvent.cpsMult > 1 
                  ? 'text-amber-200 bg-amber-500/20 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                  : 'text-blue-300 bg-blue-500/20 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.2)]',
              )}>
                <span>{activeEvent.emoji}</span>
                <span>{activeEvent.timeLeft}с</span>
              </div>
            )}
            {frenzy > 0 && (
              <div className="text-orange-300 font-black animate-pulse text-[10px] bg-gradient-to-r from-orange-500/20 to-red-500/20 px-2 py-0.5 rounded-full border border-orange-500/40 flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.3)] whitespace-nowrap">
                <span>🔥</span>
                <span>x7 {frenzy}с</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="relative z-10 flex-1 overflow-hidden">

        {/* --- CLICKER --- */}
        {page === 'clicker' && (
          <div className={cn('relative h-full flex flex-col items-center justify-center gap-2 p-3.5', shake ? 'animate-shake' : pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            {milestone && (
              <div
                key={milestone.id}
                className="animate-milestone pointer-events-none absolute left-1/2 top-1/2 z-30 whitespace-nowrap text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 drop-shadow-[0_2px_12px_rgba(249,115,22,0.7)]"
              >
                {milestone.text}
              </div>
            )}

            {/* Boss Battle Banner if boss is active */}
            {boss ? (
              <div className={cn(
                "w-full max-w-xs glass rounded-2xl p-3 text-center animate-boss border-2 transition-all",
                boss.difficulty === 'easy' && 'border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.35)]',
                boss.difficulty === 'medium' && 'border-amber-500/70 shadow-[0_0_30px_rgba(245,158,11,0.4)]',
                boss.difficulty === 'hard' && 'border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.5)]',
                boss.difficulty === 'epic' && 'border-purple-500/80 shadow-[0_0_40px_rgba(168,85,247,0.6)]',
                !boss.difficulty && 'border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
              )}>
                <div className="flex items-center justify-between text-xs font-black mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-red-300">🚨 {getBossName(boss.id, lang)}</span>
                    {boss.difficulty && (
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0',
                        boss.difficulty === 'easy' && 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
                        boss.difficulty === 'medium' && 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
                        boss.difficulty === 'hard' && 'bg-red-500/25 text-red-300 border border-red-500/40',
                        boss.difficulty === 'epic' && 'bg-purple-500/30 text-purple-300 border border-purple-500/50 animate-pulse'
                      )}>
                        {getBossDifficultyName(boss.difficulty, lang)}
                      </span>
                    )}
                  </div>
                  <span className={cn('tabular-nums font-mono shrink-0 ml-1.5', boss.timeLeft <= 5 ? 'text-red-400 font-bold animate-bounce' : 'text-red-300')}>
                    ⏱️ {boss.timeLeft}с
                  </span>
                </div>

                {/* Reward preview */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-amber-300 font-semibold mb-1.5 bg-black/30 rounded-lg py-0.5 border border-amber-500/20">
                  <span>{formatTemplate(t.bossReward, boss.rewardDiamonds)}</span>
                  <span className="opacity-40">•</span>
                  <span>+{formatNum(boss.rewardFocaccia)} 🫓</span>
                </div>

                <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-red-500/30 mb-2">
                  <div
                    className={cn(
                      "h-full transition-all duration-100",
                      boss.difficulty === 'epic'
                        ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400'
                        : 'bg-gradient-to-r from-red-600 via-red-500 to-orange-400'
                    )}
                    style={{ width: `${(boss.currentHp / boss.maxHp) * 100}%` }}
                  />
                </div>
                <button
                  onClick={attackBoss}
                  className={cn(
                    "w-full text-white font-black py-2 rounded-xl text-sm transition active:scale-95 shadow-lg flex items-center justify-center gap-2",
                    boss.difficulty === 'epic'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-600/30'
                      : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-red-600/30'
                  )}
                >
                  <span className="text-xl">{boss.emoji}</span>
                  <span>{formatTemplate(t.attackBtn, boss.currentHp, boss.maxHp)}</span>
                  <span className="text-xs opacity-90 font-black bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10">
                    {(() => {
                      const bd = getBossDamage(state.vipUpgrades);
                      return `${bd.icon} x${bd.damage}`;
                    })()}
                  </span>
                </button>
              </div>
            ) : null}

            {/* Combo */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] font-bold text-amber-500/70 mb-0.5">
                <span>{t.combo}</span>
                <span className={cn(combo >= 25 && 'text-orange-400', combo >= 100 && 'text-red-400 animate-pulse', combo >= 50 && 'combo-flame')}>
                  x{combo} {comboMult > 1 && `(×${comboMult.toFixed(2)})`}
                </span>
              </div>
              <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                <div className={cn('h-full bg-gradient-to-r from-amber-500 via-orange-400 to-red-500 transition-all duration-150 rounded-full', combo >= 50 && 'combo-blaze')} style={{ width: `${Math.min(combo, 100)}%` }} />
              </div>
            </div>

            {/* Energy */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] font-bold mb-0.5">
                <span className={cn(recharging && state.energy <= 0 ? 'text-cyan-400 animate-pulse' : 'text-cyan-500/70')}>
                  {state.energy <= 0 ? t.recharging : t.energy}
                </span>
                <span className="text-cyan-400/80 tabular-nums">{state.energy}/{maxEnergy}</span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden relative">
                <div
                  className={cn('h-full transition-all duration-200 rounded-full relative overflow-hidden',
                    state.energy <= 0 ? 'bg-cyan-800' : energyPercent < 30 ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' : 'bg-gradient-to-r from-cyan-500 to-blue-400',
                    state.energy >= maxEnergy && 'animate-energy-full',
                  )}
                  style={{ width: `${energyPercent}%` }}
                >
                  {recharging && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />}
                </div>
              </div>
            </div>

            {/* Speech */}
            <div className="relative">
              <div className="bg-white/95 text-amber-950 font-bold px-5 py-1.5 rounded-2xl shadow-xl text-sm animate-bob backdrop-blur">
                <span key={phrase} className="animate-wobble-once inline-block">{state.energy <= 0 ? t.waitSpeech : phrase}</span>
              </div>
              <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 rounded-sm" />
            </div>

            {/* Clicker */}
            <div className="relative">
              {state.energy > 0 && frenzy <= 0 && [0, 1, 2].map((i) => (
                <span key={i} className="animate-steam pointer-events-none absolute -top-5 text-base" style={{ left: `${28 + i * 22}%`, animationDelay: `${i * 0.8}s` }}>💨</span>
              ))}
              {frenzy > 0 && (
                <div className="pointer-events-none absolute inset-[-30px]">
                  {[...Array(6)].map((_, i) => (
                    <span key={i} className="animate-fire absolute text-lg" style={{ left: `${8 + i * 16}%`, bottom: 0, animationDelay: `${i * 0.18}s` }}>🔥</span>
                  ))}
                </div>
              )}
              <div className="absolute inset-[-20px] rounded-full border border-amber-400/10" style={{ animation: 'ring-pulse 3s ease-out infinite' }} />
              <div className="absolute inset-[-35px] rounded-full border border-amber-400/5" style={{ animation: 'ring-pulse-2 3s ease-out infinite', animationDelay: '0.5s' }} />
              <div className={cn('absolute inset-[-15px] rounded-full blur-2xl transition-colors duration-500',
                frenzy > 0 ? 'bg-orange-500/40' : state.energy <= 0 ? 'bg-cyan-500/10' : 'bg-amber-400/25'
              )} style={{ animation: 'glow 2.5s ease-in-out infinite' }} />
              <button
                onPointerDown={markRawTap}
                onClick={handleClick}
                className={cn(
                  'relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden cursor-pointer transition-all duration-100 active:scale-95',
                  'border-[5px] shadow-[0_0_40px_rgba(251,191,36,0.3),inset_0_-4px_12px_rgba(0,0,0,0.2)]',
                  squish && 'scale-90',
                  frenzy > 0 ? 'border-orange-400 animate-spin-slow shadow-[0_0_60px_rgba(249,115,22,0.5)]' : 'border-amber-400/80',
                  state.energy <= 0 && 'opacity-40 grayscale border-cyan-500/40 shadow-none',
                )}
              >
                <img src={focacciaImg} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                {clickRipple && (
                  <div
                    className="animate-shockwave"
                    style={{
                      left: clickRipple.x,
                      top: clickRipple.y,
                      width: 80,
                      height: 80,
                    }}
                  />
                )}
                {floats.map((f) => (
                  <span
                    key={f.id}
                    className={cn(
                      'absolute pointer-events-none font-black text-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]',
                      f.color,
                      f.direction === 'left' ? 'animate-float-left' : 'animate-float-right',
                    )}
                    style={{ left: f.x, top: f.y }}
                  >
                    {f.text}
                  </span>
                ))}
                {crumbs.map((c) => (
                  <span
                    key={c.id}
                    className="animate-crumb absolute pointer-events-none text-sm"
                    style={{ left: c.x, top: c.y, '--dx': `${c.dx}px` } as React.CSSProperties}
                  >
                    {c.emoji}
                  </span>
                ))}
              </button>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 text-center text-[10px] mt-0.5">
              <div><div className="text-amber-500/50">{t.eaten}</div><div className="font-black text-amber-200/80 text-sm tabular-nums">{formatNum(state.total)}</div></div>
              <div><div className="text-amber-500/50">{t.clicks}</div><div className="font-black text-amber-200/80 text-sm tabular-nums">{state.clicks.toLocaleString()}</div></div>
              <div><div className="text-amber-500/50">{t.bosses}</div><div className="font-black text-red-300 text-sm tabular-nums">⚔️ {state.bossesDefeated}</div></div>
            </div>
          </div>
        )}

        {/* --- SHOP --- */}
        {page === 'shop' && (
          <div className={cn('h-full flex flex-col', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            <div className="flex shrink-0 p-1.5 gap-1">
              {([
                ['buildings', '🏗️', t.tabBuildings, totalRegularBuildings],
                ['upgrades', '⚡', t.tabUpgrades, state.upgrades.length],
                ['vip', '💎', t.tabVip, totalDiamondBuildings + (state.vipUpgrades?.length || 0)],
                ['achievements', '🏆', t.tabAchievements, `${state.achievements.length}/${ACHIEVEMENTS.length}`],
              ] as [ShopTab, string, string, string | number][]).map(([id, icon, label, count]) => (
                <button
                  key={id}
                  onClick={() => setShopTab(id)}
                  className={cn(
                    'flex-1 py-2 text-[10px] font-bold rounded-xl transition-all',
                    shopTab === id
                      ? 'glass text-amber-200 border border-amber-500/30 shadow-lg'
                      : 'text-amber-500/50 active:text-amber-300',
                  )}
                >
                  {icon} {label} <span className="opacity-50 font-mono">({count})</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
              {/* BUILDINGS */}
              {shopTab === 'buildings' && (<>
                <div
                  onClick={() => { setShopTab('vip'); setVipSubTab('buildings'); }}
                  className="relative overflow-hidden glass-card cursor-pointer border border-cyan-500/40 bg-gradient-to-r from-cyan-950/50 via-blue-950/30 to-purple-950/40 p-2.5 rounded-xl flex items-center justify-between mb-1 active:scale-[0.98] transition-all hover:border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                >
                  <div className="flex items-center gap-2.5 z-10">
                    <span className="text-xl animate-diamond">💎</span>
                    <div>
                      <div className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                        {t.diamondBuildingsBannerTitle}
                        <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 rounded font-semibold">VIP</span>
                      </div>
                      <div className="text-[10px] text-cyan-300/70">{t.diamondBuildingsBannerDesc}</div>
                    </div>
                  </div>
                  <span className="text-xs text-cyan-300 font-black z-10 flex items-center gap-1">
                    {t.goTo} →
                  </span>
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                    <span className="vip-sheen-cyan" />
                  </span>
                </div>
                {BUILDINGS.map((b, i) => {
                const bText = getBuildingText(b.id, lang);
                const owned = state.buildings[b.id] || 0;
                const cost = buildingCost(b, owned);
                const can = state.focaccia >= cost;
                const isBroken = brokenBuilding === b.id;
                const repairCost = Math.max(50, Math.floor(b.baseCost * 0.3));
                const canRepair = state.focaccia >= repairCost;
                const prevOwned = i === 0 || (state.buildings[BUILDINGS[i - 1].id] || 0) > 0;
                const visible = owned > 0 || prevOwned || state.total >= b.baseCost * 0.5;
                const isRebirthLocked = (b.requireRebirth || 0) > state.prestige;
                const isJustBought = lastBoughtId === b.id;

                if (isRebirthLocked) {
                  return (
                    <div key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 opacity-50 border border-fuchsia-500/15 animate-card">
                      <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-xl shrink-0 grayscale">
                        🔒
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-amber-100/70 text-[13px] flex justify-between">
                          <span className="truncate">{bText.name}</span>
                          <span className="text-fuchsia-400 text-xs font-bold">{formatTemplate(t.rebirthLock, b.requireRebirth || 0)}</span>
                        </div>
                        <div className="text-[10px] text-amber-500/50 truncate">
                          {formatTemplate(t.rebirthLockDesc, b.requireRebirth || 0)}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (!visible) return (
                  <div key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 opacity-30 animate-card">
                    <span className="text-xl grayscale w-8 text-center">❓</span>
                    <span className="text-xs font-bold text-amber-500/50">???</span>
                  </div>
                );

                const isHolding = holdingBuyId === b.id;

                return (
                  <div key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} className={cn(
                    'rounded-xl transition-all animate-card',
                    isBroken ? 'border border-red-500/50 bg-red-950/30 p-2.5' : '',
                  )}>
                    <button
                      onClick={() => handleClickBuilding(b.id)}
                      onPointerDown={(e) => can && handlePointerDownBuy(b.id, 'building', e)}
                      onPointerUp={stopHoldBuy}
                      onPointerLeave={stopHoldBuy}
                      onPointerCancel={stopHoldBuy}
                      onPointerMove={handlePointerMoveBuy}
                      onContextMenu={(e) => e.preventDefault()}
                      disabled={!can}
                      style={{ touchAction: 'pan-y' }}
                      className={cn(
                        'relative overflow-hidden w-full text-left rounded-xl p-2.5 flex items-center gap-2.5 transition-all select-none',
                        can ? 'glass-card glass-card-hover border-amber-500/20 active:scale-[0.98]' : 'glass-card opacity-40',
                        isJustBought && !isHolding && 'animate-purchase-pop ring-2 ring-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.25)]',
                        isHolding && 'ring-2 ring-amber-400 scale-[0.98] bg-amber-500/15 shadow-[0_0_24px_rgba(251,191,36,0.45)]',
                      )}>
                      <div className={cn(
                        'relative w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform select-none',
                        can ? 'bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/25 shadow-inner' : 'bg-black/20',
                        isJustBought && 'animate-icon-bounce',
                        isHolding && 'scale-105',
                      )}>
                        {b.emoji}
                        {isHolding ? (
                          <span className="pointer-events-none absolute -top-2.5 text-[11px] font-black text-amber-200 bg-amber-950/80 px-1 py-0.2 rounded-full border border-amber-400/60 animate-pulse drop-shadow shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                            +{holdingBuyCount}
                          </span>
                        ) : isJustBought ? (
                          <span className="pointer-events-none absolute -top-2 text-[11px] font-black text-amber-300 animate-plus-one drop-shadow">
                            +1
                          </span>
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-amber-100/90 text-[13px] flex justify-between items-center">
                          <span className="truncate">{bText.name}</span>
                          <span className={cn(
                            'tabular-nums ml-2 text-xs font-bold px-1.5 py-0.5 rounded-md transition-all',
                            owned > 0 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25' : 'text-amber-400/40',
                            isJustBought && !isHolding && 'animate-badge-pop text-amber-200 bg-amber-400/30',
                            isHolding && 'text-amber-200 bg-amber-400/40 border border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.4)]',
                          )}>
                            {owned}
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-400/40 truncate">{bText.desc}</div>
                        <div className="text-[10px] mt-0.5 flex justify-between">
                          <span className={cn('font-bold', can ? 'text-emerald-400' : 'text-red-400/70')}>🫓 {formatNum(cost)}</span>
                          <span className={cn(isBroken ? 'text-red-400 font-bold' : 'text-amber-300/50')}>
                            {isBroken ? t.brokenWarning : `+${formatCps(b.cps * prestigeMult)}${t.topBarPerSec}`}
                          </span>
                        </div>
                      </div>
                      {can && (
                        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                          <span className="vip-sheen-gold" />
                        </span>
                      )}
                    </button>

                    {isBroken && (
                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-red-500/20">
                        <span className="text-[10px] text-red-300 font-bold">{t.brokenNotice}</span>
                        <button
                          onClick={() => fixBuilding(b.id)}
                          disabled={!canRepair}
                          className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-black text-[11px] px-3 py-1 rounded-lg shadow active:scale-95"
                        >
                          {formatTemplate(t.repairBtn, formatNum(repairCost))}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}</>)}

              {/* UPGRADES */}
              {shopTab === 'upgrades' && (<>
                {/* Available upgrades */}
                {CLICK_UPGRADES
                  .filter((u) => !state.upgrades.includes(u.id))
                  .filter((u) => (u.requireRebirth || 0) <= state.prestige)
                  .filter((u) => {
                    if (u.requireBuilding) return (state.buildings[u.requireBuilding.id] || 0) >= u.requireBuilding.count;
                    return state.total >= u.cost * 0.3;
                  }).length === 0 && (
                  <div className="text-center text-amber-500/30 py-8 text-xs">{t.noMoreUpgrades}</div>
                )}
                {CLICK_UPGRADES
                  .filter((u) => !state.upgrades.includes(u.id))
                  .filter((u) => (u.requireRebirth || 0) <= state.prestige)
                  .filter((u) => {
                    if (u.requireBuilding) return (state.buildings[u.requireBuilding.id] || 0) >= u.requireBuilding.count;
                    return state.total >= u.cost * 0.3;
                  }).map((u, i) => {
                  const uText = getUpgradeText(u.id, lang);
                  const can = state.focaccia >= u.cost;
                  const isEnergy = !!u.energyRegen;
                  return (
                    <button key={u.id} onClick={() => buyUpgrade(u.id)} disabled={!can} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                      className={cn('w-full text-left rounded-xl p-2.5 flex items-center gap-2.5 transition-all active:scale-[0.98] animate-card',
                        can ? isEnergy ? 'glass-card border-cyan-500/20 glass-card-hover' : 'glass-card border-sky-500/20 glass-card-hover' : 'glass-card opacity-40',
                      )}>
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0',
                        isEnergy ? 'bg-cyan-500/15' : 'bg-sky-500/15',
                      )}>{u.emoji}</div>
                      <div className="flex-1">
                        <div className={cn('font-bold text-[13px]', isEnergy ? 'text-cyan-100/90' : 'text-sky-100/90')}>{uText.name}</div>
                        <div className={cn('text-[10px]', isEnergy ? 'text-cyan-300/40' : 'text-sky-300/40')}>{uText.desc}</div>
                        <div className={cn('text-[10px] font-bold mt-0.5', can ? 'text-emerald-400' : 'text-red-400/70')}>🫓 {formatNum(u.cost)}</div>
                      </div>
                    </button>
                  );
                })}

                {/* Locked upgrades preview */}
                {CLICK_UPGRADES.filter((u) => (u.requireRebirth || 0) > state.prestige).slice(0, 4).map((u, i) => {
                  const uText = getUpgradeText(u.id, lang);
                  return (
                    <div key={u.id} style={{ animationDelay: `${i * 35}ms` }} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 opacity-40 border border-fuchsia-500/15 animate-card">
                      <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-xl shrink-0 grayscale">
                        🔒
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-amber-100/60 text-[13px] flex justify-between">
                          <span className="truncate">{uText.name}</span>
                          <span className="text-fuchsia-400 text-xs font-bold">{formatTemplate(t.rebirthLock, u.requireRebirth)}</span>
                        </div>
                        <div className="text-[10px] text-amber-500/50 truncate">{uText.desc}</div>
                      </div>
                    </div>
                  );
                })}

                {state.upgrades.length > 0 && (
                  <div className="pt-3">
                    <div className="text-[10px] uppercase font-bold text-amber-500/30 mb-2 tracking-widest">{t.boughtUpgrades}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CLICK_UPGRADES.filter((u) => state.upgrades.includes(u.id)).map((u) => {
                        const uText = getUpgradeText(u.id, lang);
                        return (
                          <span key={u.id} title={`${uText.name}: ${uText.desc}`} className="text-lg glass-card rounded-lg w-9 h-9 flex items-center justify-center">{u.emoji}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>)}

              {/* VIP / DIAMONDS SHOP */}
              {shopTab === 'vip' && (
                <div className="space-y-2">
                  <div className="glass-card rounded-xl p-3 border-cyan-500/30 bg-cyan-950/20">
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <div className="text-xs font-black text-cyan-200">{formatTemplate(t.yourDiamonds, state.diamonds)}</div>
                        <div className="text-[10px] text-cyan-300/60">{t.diamondsKeepNotice}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowDonateModal(true); haptic.selection(); }}
                          className="flex items-center gap-1 bg-gradient-to-r from-amber-500/25 via-cyan-500/25 to-blue-500/25 hover:from-amber-500/35 hover:to-cyan-500/35 border border-cyan-400/40 text-cyan-200 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-[0_0_10px_rgba(6,182,212,0.2)] active:scale-95 transition cursor-pointer"
                        >
                          <span className="animate-diamond">💎</span>
                          <span>{t.donateOpenBtn || '💎 Банк 💎'}</span>
                        </button>
                        <div className="text-right">
                          <div className="text-[10px] text-cyan-300/50">{t.diamondBuildingsCount}</div>
                          <div className="text-xs font-bold text-cyan-300 tabular-nums">🏛️ {totalDiamondBuildings} {t.pcs}</div>
                        </div>
                      </div>
                    </div>

                    {/* Sub-tab switcher */}
                    <div className="flex bg-black/40 p-1 rounded-lg gap-1 border border-cyan-500/20">
                      <button
                        onClick={() => { setVipSubTab('buildings'); haptic.light(); }}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-bold rounded-md transition-all',
                          vipSubTab === 'buildings'
                            ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow'
                            : 'text-cyan-400/50 hover:text-cyan-300',
                        )}
                      >
                        {t.vipBuildingsSubTab} ({totalDiamondBuildings})
                      </button>
                      <button
                        onClick={() => { setVipSubTab('upgrades'); haptic.light(); }}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-bold rounded-md transition-all',
                          vipSubTab === 'upgrades'
                            ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow'
                            : 'text-cyan-400/50 hover:text-cyan-300',
                        )}
                      >
                        {t.vipUpgradesSubTab} ({state.vipUpgrades?.length || 0})
                      </button>
                    </div>
                  </div>

                  {/* DIAMOND BUILDINGS SUB-TAB */}
                  {vipSubTab === 'buildings' && DIAMOND_BUILDINGS.map((b, i) => {
                    const dbText = getDiamondBuildingText(b.id, lang);
                    const owned = state.diamondBuildings?.[b.id] || 0;
                    const cost = diamondBuildingCost(b, owned);
                    const can = state.diamonds >= cost;
                    const isRebirthLocked = (b.requireRebirth || 0) > state.prestige;
                    const dPolish = state.vipUpgrades?.includes('vip_polish') ? 1.25 : 1.0;
                    const effectiveCps = b.baseCps * dPolish * prestigeMult;

                    if (isRebirthLocked) {
                      return (
                        <div key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 opacity-50 border border-cyan-500/15 animate-card">
                          <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-xl shrink-0 grayscale">
                            🔒
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-cyan-100/70 text-[13px] flex justify-between">
                              <span className="truncate">{dbText.name}</span>
                              <span className="text-fuchsia-400 text-xs font-bold">{formatTemplate(t.rebirthLock, b.requireRebirth || 0)}</span>
                            </div>
                            <div className="text-[10px] text-cyan-400/50 truncate">
                              {formatTemplate(t.rebirthLockDesc, b.requireRebirth || 0)}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isJustBought = lastBoughtId === b.id;
                    const isHolding = holdingBuyId === b.id;

                    return (
                      <button
                        key={b.id}
                        onClick={() => handleClickDiamondBuilding(b.id)}
                        onPointerDown={(e) => can && handlePointerDownBuy(b.id, 'diamond', e)}
                        onPointerUp={stopHoldBuy}
                        onPointerLeave={stopHoldBuy}
                        onPointerCancel={stopHoldBuy}
                        onPointerMove={handlePointerMoveBuy}
                        onContextMenu={(e) => e.preventDefault()}
                        disabled={!can}
                        style={{ animationDelay: `${Math.min(i, 12) * 35}ms`, touchAction: 'pan-y' }}
                        className={cn(
                          'relative overflow-hidden w-full text-left rounded-xl p-2.5 flex items-center gap-2.5 transition-all select-none animate-card',
                          can ? 'glass-card border-cyan-500/35 glass-card-hover shadow-[0_0_12px_rgba(6,182,212,0.12)] active:scale-[0.98]' : 'glass-card opacity-40',
                          isJustBought && !isHolding && 'animate-purchase-pop ring-2 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)]',
                          isHolding && 'ring-2 ring-cyan-400 scale-[0.98] bg-cyan-500/15 shadow-[0_0_24px_rgba(6,182,212,0.55)]',
                        )}
                      >
                        <div className={cn(
                          'relative w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform select-none',
                          can ? 'bg-gradient-to-br from-cyan-500/25 to-blue-600/15 border border-cyan-400/30 shadow-inner' : 'bg-black/30',
                          isJustBought && 'animate-icon-bounce',
                          isHolding && 'scale-105',
                        )}>
                          {b.emoji}
                          {isHolding ? (
                            <span className="pointer-events-none absolute -top-2.5 text-[11px] font-black text-cyan-200 bg-cyan-950/80 px-1 py-0.2 rounded-full border border-cyan-400/60 animate-pulse drop-shadow shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                              +{holdingBuyCount}
                            </span>
                          ) : isJustBought ? (
                            <span className="pointer-events-none absolute -top-2 text-[11px] font-black text-cyan-200 animate-plus-one drop-shadow">
                              +1
                            </span>
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-cyan-100/90 text-[13px] flex justify-between items-center">
                            <span className="truncate">{dbText.name}</span>
                            <span className={cn(
                              'tabular-nums ml-2 text-xs font-bold px-1.5 py-0.5 rounded-md transition-all',
                              owned > 0 ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30' : 'text-cyan-400/40',
                              isJustBought && !isHolding && 'animate-badge-pop text-white bg-cyan-400/40',
                              isHolding && 'text-white bg-cyan-400/50 border border-cyan-400/70 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
                            )}>
                              {owned}
                            </span>
                          </div>
                          <div className="text-[10px] text-cyan-300/60 truncate">{dbText.desc}</div>
                          <div className="text-[10px] mt-0.5 flex justify-between items-center">
                            <span className={cn('font-bold', can ? 'text-cyan-300' : 'text-red-400/70')}>
                              💎 {formatNum(cost)}
                            </span>
                            <span className="text-cyan-300/70 font-medium">
                              +{formatCps(effectiveCps)}{t.topBarPerSec} • +{(b.percentBonus * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {can && (
                          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                            <span className="vip-sheen-cyan" />
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* DIAMOND UPGRADES SUB-TAB */}
                  {vipSubTab === 'upgrades' && VIP_UPGRADES.map((u, i) => {
                    const vuText = getVipUpgradeText(u.id, lang);
                    const bought = state.vipUpgrades?.includes(u.id);
                    const can = state.diamonds >= u.cost && !bought;
                    return (
                      <button
                        key={u.id}
                        onClick={() => buyVipUpgrade(u.id)}
                        disabled={bought || !can}
                        style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                        className={cn(
                          'relative w-full overflow-hidden text-left rounded-xl p-2.5 flex items-center gap-2.5 transition-all active:scale-[0.98] animate-card',
                          bought
                            ? 'glass-card border-emerald-500/30 bg-emerald-950/20 opacity-80'
                            : can
                            ? 'glass-card border-cyan-500/30 glass-card-hover'
                            : 'glass-card opacity-40',
                        )}
                      >
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-xl shrink-0">
                          {u.emoji}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-[13px] text-cyan-100/90 flex justify-between">
                            <span>{vuText.name}</span>
                            {bought && <span className="text-emerald-400 text-xs">{t.boughtCheck}</span>}
                          </div>
                          <div className="text-[10px] text-cyan-300/60">{vuText.desc}</div>
                          {!bought && (
                            <div className={cn('text-[10px] font-bold mt-0.5', can ? 'text-cyan-300' : 'text-red-400/70')}>
                              {formatTemplate(t.diamondsCost, u.cost)}
                            </div>
                          )}
                        </div>
                        {can && (
                          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                            <span className="vip-sheen-cyan" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ACHIEVEMENTS */}
              {shopTab === 'achievements' && (
                <div className="space-y-2">
                  <div className="glass-card rounded-2xl p-3 border border-amber-500/25 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🏆</span>
                      <div>
                        <div className="text-xs font-black text-amber-100">
                          {lang === 'uk' ? 'Список досягнень' : 'Список достижений'}
                        </div>
                        <div className="text-[10px] text-amber-500/70 font-medium">
                          {lang === 'uk'
                            ? `Розблоковано ${state.achievements.length} з ${ACHIEVEMENTS.length}`
                            : `Разблокировано ${state.achievements.length} из ${ACHIEVEMENTS.length}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-amber-200 tabular-nums font-mono px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 shadow-inner">
                      {state.achievements.length} / {ACHIEVEMENTS.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {ACHIEVEMENTS.map((a, i) => {
                      const aText = getAchievementText(a.id, lang);
                      const done = state.achievements.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}
                          className={cn(
                            'glass-card rounded-xl p-3 text-center transition-all animate-card relative overflow-hidden',
                            done
                              ? 'border-yellow-400/40 bg-yellow-500/10 shadow-[0_0_12px_rgba(250,204,21,0.15)]'
                              : 'opacity-40 grayscale'
                          )}
                        >
                          <div className={cn('text-2xl transition-transform', done && 'scale-110')}>{a.emoji}</div>
                          <div className={cn('font-bold text-xs mt-1 truncate', done ? 'text-amber-100' : 'text-amber-200/60')}>
                            {aText.name}
                          </div>
                          <div className="text-[9px] text-amber-400/50 mt-0.5 leading-snug">
                            {aText.desc}
                          </div>
                          {done && (
                            <div className="mt-1 text-[9px] font-black text-emerald-400 flex items-center justify-center gap-0.5">
                              <span>✓</span>
                              <span>{lang === 'uk' ? 'Виконано' : 'Выполнено'}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CASINO --- */}
        {page === 'casino' && (() => {
          const spinLabel = casinoGame === 'slots' ? t.spinSlots : casinoGame === 'dice' ? t.spinDice : t.spinWheel;
          const doSpin = casinoGame === 'slots' ? spinCasino : casinoGame === 'dice' ? rollDice : spinWheel;
          const setCustomBet = (raw: string) => {
            const digits = raw.replace(/\D/g, '').slice(0, 15);
            setCasinoCustomBet(digits);
            const n = parseInt(digits || '0', 10);
            if (n >= 1) setCasinoBet(Math.min(n, casinoBalance, casinoMaxBet));
            else setCasinoBet(casinoCur === 'gem' ? 1 : 100);
          };
          const casinoLocked = karma < 50;
          return (
            <div className={cn('h-full overflow-y-auto p-4 space-y-3', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
              <h2 className="text-base font-black text-amber-200/80 text-center tracking-wide">{t.casinoTitle}</h2>

              {/* Ігри */}
              <div className="flex gap-1.5">
                {([['slots', '🎰', t.tabSlots], ['dice', '🎲', t.tabDice], ['wheel', '🎡', t.tabWheel]] as const).map(([id, icon, label]) => (
                  <button
                    key={id}
                    onClick={() => { setCasinoGame(id); haptic.light(); }}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-[11px] font-black transition-all',
                      casinoGame === id
                        ? 'glass-card text-amber-200 border border-amber-500/30 shadow-lg'
                        : 'text-amber-500/50',
                    )}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Ігрове поле */}
              {casinoLocked ? (
                <div className="glass-card rounded-2xl p-6 text-center space-y-2">
                  <div className="text-5xl">🔒</div>
                  <div className="font-black text-amber-100">{t.casinoClosedTitle}</div>
                  <div className="text-[11px] text-amber-300/60">{formatTemplate(t.casinoClosedDesc, karma)}</div>
                </div>
              ) : (<>
              <div className="glass-card rounded-2xl p-4 border-amber-500/25 space-y-4">
                {casinoGame === 'slots' && (
                  <div className="flex justify-center gap-2">
                    {casinoReels.map((s, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-[4.5rem] h-[4.5rem] rounded-xl bg-black/50 border-2 flex items-center justify-center text-[2.6rem] leading-none',
                          casinoSpinning ? 'border-amber-500/40' : 'border-amber-500/25',
                        )}
                      >
                        <span key={s + String(casinoSpinning)} className={cn('inline-block', casinoSpinning && 'blur-[1px] opacity-80')}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {casinoGame === 'dice' && (
                  <div className="flex items-center justify-center gap-5 py-1">
                    <div className="text-center">
                      <div className="text-[10px] font-black text-amber-500/50 mb-1">{t.diceYou}</div>
                      <div className="w-20 h-20 rounded-xl bg-black/50 border-2 border-amber-500/30 flex items-center justify-center text-[3.4rem] leading-none">
                        {diceRoll ? DICE_FACES[diceRoll.mine - 1] : '🎲'}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-amber-500/40">VS</div>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-red-400/60 mb-1">{t.diceGranny}</div>
                      <div className="w-20 h-20 rounded-xl bg-black/50 border-2 border-red-500/30 flex items-center justify-center text-[3.4rem] leading-none">
                        {diceRoll ? DICE_FACES[diceRoll.house - 1] : '🎲'}
                      </div>
                    </div>
                  </div>
                )}

                {casinoGame === 'wheel' && (
                  <div className="flex justify-center py-1">
                    <div className="relative w-52 h-52">
                      <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-lg" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))' }}>🔻</div>
                      <div
                        className="absolute inset-0 rounded-full border-4 border-amber-500/40 shadow-[0_0_30px_rgba(251,191,36,0.25)]"
                        style={{
                          background: `conic-gradient(${wheelGradient})`,
                          transform: `rotate(${wheelAngle}deg)`,
                          transition: casinoSpinning ? 'transform 2.4s cubic-bezier(0.15, 0.85, 0.25, 1)' : 'none',
                        }}
                      >
                        {WHEEL_SEGMENTS.map((m, i) => (
                          <div key={i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${i * WHEEL_EDGE + WHEEL_EDGE / 2}deg)` }}>
                            <span className="mt-1.5 text-[11px] font-black" style={{ color: m === 0 ? '#6b5a3a' : '#fff' }}>{m > 0 ? `×${m}` : '✖'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass border-2 border-amber-500/40 flex items-center justify-center text-xl">🫓</div>
                    </div>
                  </div>
                )}

                <div className="h-6 text-center">
                  {casinoMsg && (
                    <div className={cn('text-[12px] font-black', casinoMsg.win ? 'text-emerald-300' : 'text-amber-500/50')}>
                      {casinoMsg.text}
                    </div>
                  )}
                </div>

                <button
                  onClick={doSpin}
                  disabled={casinoSpinning || casinoBalance < casinoBet}
                  className={cn(
                    'w-full py-3 rounded-xl font-black text-sm transition active:scale-95 shadow-lg',
                    casinoSpinning || casinoBalance < casinoBet
                      ? 'bg-white/5 border border-amber-500/15 text-amber-500/40 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 text-white shadow-red-500/30 animate-pulse',
                  )}
                >
                  {casinoSpinning ? t.spinning : `${spinLabel} — ${formatNum(casinoBet)} ${casinoCurSym}`}
                </button>
              </div>

              {/* Валюта ставки */}
              <div className="flex gap-1.5">
                {([['foc', '🫓', t.curFocaccia], ['gem', '💎', t.curDiamonds]] as const).map(([id, icon, label]) => (
                  <button
                    key={id}
                    onClick={() => { setCasinoCur(id); setCasinoBet(id === 'gem' ? 1 : 100); haptic.light(); }}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-[11px] font-black transition-all',
                      casinoCur === id
                        ? 'glass-card text-amber-200 border border-amber-500/30 shadow-lg'
                        : 'text-amber-500/50',
                    )}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Ставки */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="text-[10px] uppercase font-bold text-amber-500/30 tracking-widest">{t.betLabel}</div>
                  <div className="text-[10px] font-bold text-amber-300/50 tabular-nums">{t.balanceLabel} {formatNum(casinoBalance)} {casinoCurSym}</div>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    value={casinoCustomBet}
                    onChange={(e) => setCustomBet(e.target.value)}
                    inputMode="numeric"
                    placeholder={t.customBetPlaceholder}
                    className="flex-1 min-w-0 glass-card rounded-lg px-3 py-2.5 text-[13px] font-black text-amber-200 tabular-nums placeholder:text-amber-500/30 placeholder:font-bold outline-none border border-amber-500/15 focus:border-amber-400/60 transition-colors"
                  />
                  <div className="glass-card rounded-lg px-3 py-2.5 text-[13px] font-black text-amber-400/60">{casinoCurSym}</div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(casinoCur === 'gem' ? CASINO_BETS_GEM : CASINO_BETS).map((b) => {
                    const can = casinoBalance >= b && b <= casinoMaxBet;
                    return (
                      <button
                        key={b}
                        onClick={() => { setCasinoBet(b); setCasinoCustomBet(String(b)); haptic.light(); }}
                        disabled={!can}
                        className={cn(
                          'py-2 rounded-lg text-[11px] font-black transition active:scale-95',
                          casinoBet === b
                            ? 'bg-amber-500/25 border border-amber-400/60 text-amber-200 shadow-lg shadow-amber-500/10'
                            : can
                            ? 'glass-card glass-card-hover text-amber-300/70'
                            : 'glass-card opacity-30 text-amber-500/40 cursor-not-allowed',
                        )}
                      >
                        {formatNum(b)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Правила / виплати */}
              {casinoGame === 'slots' && (
                <div className="glass-card rounded-2xl p-3 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-amber-500/30 mb-1 tracking-widest">{t.payoutsLabel}</div>
                  {Object.entries(CASINO_PAYOUTS).map(([s, m]) => (
                    <div key={s} className="flex justify-between items-center text-[11px]">
                      <span className="tracking-widest">{s}{s}{s}</span>
                      <span className={cn('font-black', m >= 15 ? 'text-fuchsia-300' : 'text-amber-300')}>×{m}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-amber-500/10">
                    <span className="text-amber-400/60">{t.anyPair}</span>
                    <span className="font-black text-amber-300/80">×{CASINO_PAIR_MULT}</span>
                  </div>
                </div>
              )}
              {casinoGame === 'dice' && (
                <div className="glass-card rounded-2xl p-3 text-[11px] text-amber-300/60 space-y-1">
                  <div>{t.diceRule1}<b className="text-amber-300">×1.9</b></div>
                  <div>{t.diceRule2}</div>
                  <div>{t.diceRule3}</div>
                </div>
              )}
              {casinoGame === 'wheel' && (
                <div className="glass-card rounded-2xl p-3 text-[11px] text-amber-300/60">
                  {t.wheelRule}
                </div>
              )}
              </>)}
              <div className="text-center text-[9px] text-amber-500/30 pb-2">{t.casinoDisclaimer}</div>
            </div>
          );
        })()}

        {/* --- LEADERBOARD --- */}
        {page === 'leaders' && (
          <div className={cn('h-full overflow-y-auto p-4 space-y-2.5', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            <h2 className="text-base font-black text-amber-200/90 text-center tracking-wide">{t.leadersTitle}</h2>

            {/* Category Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 glass-card rounded-2xl border border-amber-500/20 bg-black/40">
              <button
                onClick={() => { setLeaderCategory('focaccia'); haptic.selection(); }}
                className={cn(
                  'py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border border-transparent',
                  leaderCategory === 'focaccia'
                    ? 'leader-tab-active-amber'
                    : 'text-amber-300/60 hover:text-amber-200 active:scale-95'
                )}
              >
                <span className="text-base leading-none">🫓</span>
                <span className="truncate">{t.leaderTabFocaccia.replace('🫓 ', '')}</span>
              </button>

              <button
                onClick={() => { setLeaderCategory('diamonds'); haptic.selection(); }}
                className={cn(
                  'py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border border-transparent',
                  leaderCategory === 'diamonds'
                    ? 'leader-tab-active-cyan'
                    : 'text-cyan-300/60 hover:text-cyan-200 active:scale-95'
                )}
              >
                <span className="text-base leading-none">💎</span>
                <span className="truncate">{t.leaderTabDiamonds.replace('💎 ', '')}</span>
              </button>

              <button
                onClick={() => { setLeaderCategory('rebirth'); haptic.selection(); }}
                className={cn(
                  'py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border border-transparent',
                  leaderCategory === 'rebirth'
                    ? 'leader-tab-active-fuchsia'
                    : 'text-fuchsia-300/60 hover:text-fuchsia-200 active:scale-95'
                )}
              >
                <span className="text-base leading-none">🔄</span>
                <span className="truncate">{t.leaderTabRebirth.replace('🔄 ', '')}</span>
              </button>
            </div>

            {/* Category Description Banner & My Rank */}
            <div className={cn(
              'glass-card rounded-xl p-3 text-center transition-all border shadow-sm',
              leaderCategory === 'focaccia' && 'border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/30',
              leaderCategory === 'diamonds' && 'border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-cyan-950/30',
              leaderCategory === 'rebirth' && 'border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-950/40 via-purple-950/20 to-fuchsia-950/30',
            )}>
              <div className="flex items-center justify-between text-xs font-black mb-1">
                <span className={cn(
                  'flex items-center gap-1 font-black',
                  leaderCategory === 'focaccia' && 'text-amber-200',
                  leaderCategory === 'diamonds' && 'text-cyan-200',
                  leaderCategory === 'rebirth' && 'text-fuchsia-200',
                )}>
                  {activeCategoryRank ? formatTemplate(t.yourRank, activeCategoryRank) : t.joinTop}
                </span>

                <div className="text-[10px] text-emerald-300/90 flex items-center gap-1 font-semibold">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {formatTemplate(t.online, leaders ? leaders.filter((l) => l.online).length : 0)}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                <span className="text-amber-200/50 text-[10px] truncate max-w-[200px] text-left">
                  {leaderCategory === 'focaccia' && t.leaderSubFocaccia}
                  {leaderCategory === 'diamonds' && t.leaderSubDiamonds}
                  {leaderCategory === 'rebirth' && t.leaderSubRebirth}
                </span>
                <span className="font-black text-right tabular-nums text-xs shrink-0 pl-2">
                  {leaderCategory === 'focaccia' && <span className="text-amber-300">🫓 {formatNum(state.total)}</span>}
                  {leaderCategory === 'diamonds' && <span className="text-cyan-300">💎 {formatNum(state.diamonds)}</span>}
                  {leaderCategory === 'rebirth' && <span className="text-fuchsia-300">🔄 {state.prestige} ур.</span>}
                </span>
              </div>
            </div>

            {/* Click to inspect tip */}
            <div className="text-center text-[10px] text-amber-300/70 font-medium py-1.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center gap-1.5 shadow-sm">
              <span>👤</span>
              <span>{lang === 'uk' ? 'Натисніть на будь-якого гравця, щоб відкрити його акаунт' : 'Нажмите на любого игрока, чтобы открыть его аккаунт'}</span>
            </div>

            {leadersLoading && (
              <div className="glass-card rounded-xl p-8 text-center text-amber-300/70 text-xs animate-pulse space-y-2">
                <div className="text-2xl animate-spin inline-block">🫓</div>
                <div>{t.loadingLeaders}</div>
              </div>
            )}

            {!leadersLoading && sortedLeaders && sortedLeaders.length === 0 && (
              <div className="glass-card rounded-xl py-10 text-center text-amber-500/40 text-xs">{t.emptyLeaders}</div>
            )}

            {!leadersLoading && sortedLeaders && sortedLeaders.map((pl, i) => {
              const isMe = !!tgUser?.id && String(pl.id) === String(tgUser.id);
              const isTop1 = i === 0;
              const isTop2 = i === 1;
              const isTop3 = i === 2;

              let podiumClass = 'glass-card';
              if (isTop1) podiumClass = 'leader-podium-1';
              else if (isTop2) podiumClass = 'leader-podium-2';
              else if (isTop3) podiumClass = 'leader-podium-3';

              const rowFrame = getAvatarFrame(isMe ? state.cosmetics?.equippedFrame : pl.frame);
              const rowColor = getNameColorStyle(isMe ? state.cosmetics?.equippedNameColor : pl.color);
              const displayName = isMe
                ? ([tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || pl.name || (lang === 'uk' ? 'Гравець' : 'Игрок'))
                : (pl.name || (lang === 'uk' ? 'Гравець' : 'Игрок'));

              return (
                <div
                  key={`${leaderCategory}-${pl.id}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  onClick={() => {
                    if (isMe) {
                      setProfileModalOpen(true);
                    } else {
                      setViewingProfile(pl);
                    }
                    haptic.light();
                  }}
                  className={cn(
                    'relative overflow-hidden rounded-xl p-2.5 flex items-center gap-2.5 transition-all animate-card cursor-pointer active:scale-[0.99]',
                    podiumClass,
                    isMe && 'ring-1 ring-amber-400/70 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
                  )}
                >
                  {/* Rank Badge */}
                  <div className={cn(
                    'shrink-0 text-center font-black w-8 flex items-center justify-center select-none',
                    i < 3 ? 'text-xl drop-shadow' : 'text-amber-500/60 text-xs font-extrabold',
                  )}>
                    {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${i + 1}`}
                  </div>

                  {/* Player Avatar with Frame */}
                  <div className={cn(
                    'w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative',
                    rowFrame.frameClass
                  )}>
                    {(isMe ? tgUser?.photo_url : pl.avatar) ? (
                      <img src={isMe ? tgUser?.photo_url : pl.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-black text-amber-200">
                        {displayName ? displayName[0].toUpperCase() : '👨‍🍳'}
                      </span>
                    )}
                    {rowFrame.cost > 0 && (
                      <div className="absolute -bottom-1 -right-1 text-[8px] leading-none bg-black/80 rounded-full px-0.5">
                        {rowFrame.emoji}
                      </div>
                    )}
                  </div>

                  {/* Player Details */}
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    {/* Line 1: Online status indicator + Player Name (takes FULL width without badge competition!) */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {pl.online && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Онлайн" />
                      )}
                      <span
                        className={cn('truncate font-bold text-[13px] leading-snug', rowColor.colorClass)}
                        title={displayName}
                      >
                        {displayName}
                      </span>
                    </div>

                    {/* Line 2: Username / ID + Badges (DEV, ЦЕ ТИ) */}
                    <div className="text-[10px] text-amber-200/50 flex items-center gap-1.5 font-mono min-w-0 mt-0.5">
                      {pl.username ? (
                        <span className="truncate max-w-[85px] shrink-0">@{pl.username}</span>
                      ) : (
                        <span className="shrink-0 text-[9px]">ID: {pl.id}</span>
                      )}
                      {isDevUser(pl.id) && <DevBadge size="sm" />}
                      {isMe && (
                        <span className="shrink-0 text-[8px] leading-tight bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 text-amber-200 px-1.5 py-0.5 rounded-full font-black">
                          {t.itsYou}
                        </span>
                      )}
                    </div>
                  </div>

                  {pl.flag && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); addToast(t.toastFlagWarn, formatTemplate(t.toastFlagWarnDesc, pl.name), '⚠️'); haptic.light(); }}
                      className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/50 text-xs flex items-center justify-center animate-pulse"
                      title={t.toastFlagWarn}
                    >⚠️</button>
                  )}

                  {/* Stats Section based on active Category */}
                  <div className="text-right shrink-0">
                    {leaderCategory === 'focaccia' && (
                      <>
                        <div className="font-black text-amber-200 text-sm tabular-nums flex items-center justify-end gap-1">
                          <span>🫓</span>
                          <span>{formatNum(pl.total)}</span>
                        </div>
                        <div className="text-[9px] text-amber-500/50">
                          🔄 {pl.prestige} • 💎 {formatNum(pl.diamonds || 0)}
                        </div>
                      </>
                    )}

                    {leaderCategory === 'diamonds' && (
                      <>
                        <div className="font-black text-cyan-200 text-sm tabular-nums flex items-center justify-end gap-1">
                          <span>💎</span>
                          <span>{formatNum(pl.diamonds || 0)}</span>
                        </div>
                        <div className="text-[9px] text-cyan-400/50">
                          🫓 {formatNum(pl.total)} • 🔄 {pl.prestige}
                        </div>
                      </>
                    )}

                    {leaderCategory === 'rebirth' && (
                      <>
                        <div className="font-black text-fuchsia-200 text-sm tabular-nums flex items-center justify-end gap-1">
                          <span>🔄</span>
                          <span>{pl.prestige}</span>
                        </div>
                        <div className="text-[9px] text-fuchsia-400/50">
                          🫓 {formatNum(pl.total)} • 💎 {formatNum(pl.diamonds || 0)}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Open Profile indicator */}
                  <div className="text-amber-500/40 text-sm pl-0.5 font-bold shrink-0 select-none">
                    ›
                  </div>
                </div>
              );
            })}

            {!leadersLoading && (
              <button
                onClick={loadLeaders}
                className="w-full glass-card glass-card-hover rounded-xl py-2.5 text-[11px] font-black text-amber-300/80 transition active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>🔄</span>
                <span>{t.refreshBtn}</span>
              </button>
            )}

            <div className="text-center text-[9px] text-amber-500/30 pb-2">{t.leadersFooter}</div>
          </div>
        )}

        {/* --- SETTINGS --- */}
        {page === 'settings' && (
          <div className={cn('h-full overflow-y-auto p-4 space-y-3', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            <h2 className="text-base font-black text-amber-200/80 text-center tracking-wide">{t.settingsTitle}</h2>

            {/* Profile Hero Card */}
            <div className="glass-card rounded-2xl p-3.5 border border-amber-500/25 flex items-center justify-between gap-3 shadow-lg shadow-black/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center relative', getAvatarFrame(state.cosmetics?.equippedFrame).frameClass)}>
                  {tgUser?.photo_url ? (
                    <img src={tgUser.photo_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-amber-200">
                      {(tgUser?.first_name?.[0] || '👨‍🍳').toUpperCase()}
                    </span>
                  )}
                  {getAvatarFrame(state.cosmetics?.equippedFrame).cost > 0 && (
                    <div className="absolute -bottom-1 -right-1 text-[9px] leading-none bg-black/80 rounded-full px-1 py-0.5 border border-amber-500/30">
                      {getAvatarFrame(state.cosmetics?.equippedFrame).emoji}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('text-sm truncate font-bold', getNameColorStyle(state.cosmetics?.equippedNameColor).colorClass)}>
                      {[tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || (lang === 'uk' ? 'Шеф Фокаччо' : 'Шеф Фокаччо')}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-200/50 font-mono flex items-center gap-1.5 mt-0.5 min-w-0">
                    {tgUser?.username ? (
                      <span className="truncate max-w-[100px]">@{tgUser.username}</span>
                    ) : (
                      <span>ID: {tgUser?.id || '—'}</span>
                    )}
                    {isDevUser(tgUser?.id) && <DevBadge size="sm" />}
                  </div>
                  <div className="text-[10px] text-amber-500/60 mt-0.5 truncate">
                    {t.profileCardDesc}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setProfileModalOpen(true); haptic.light(); }}
                className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>👤</span>
                <span>{t.openProfileBtn}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                ['🫓', formatNum(state.total), t.statEaten],
                ['💎', String(state.diamonds), t.statDiamonds],
                ['🔄', String(state.prestige), t.statRebirths],
                ['⚔️', String(state.bossesDefeated), t.statBosses],
                ['🪲', String(state.pestsSquashed), t.statPests],
                ['👆', state.clicks.toLocaleString(), t.statClicks],
                ['⚡', `x${state.maxCombo}`, t.statCombo],
                ['✨', String(state.goldenCaught), t.statGolden],
                ['🏗️', String(totalBuildings), t.statBuildings],
              ].map(([emoji, value, label], i) => (
                <div key={label} style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }} className="glass-card rounded-xl p-2.5 text-center animate-card">
                  <div className="text-base">{emoji}</div>
                  <div className="font-black text-amber-200/80 text-sm tabular-nums">{value}</div>
                  <div className="text-[9px] text-amber-500/40">{label}</div>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-2xl p-4 border-fuchsia-500/30 animate-rebirth-card space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <div>
                  <div className="font-black text-fuchsia-200 text-sm">{formatTemplate(t.rebirthLevel, state.prestige)}</div>
                  <div className="text-[10px] text-fuchsia-400/70">{formatTemplate(t.rebirthBonus, state.prestige * 10, state.prestige * 5)}</div>
                </div>
                {prestigeGain >= 1 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 text-[10px] font-black animate-pulse">
                    {formatTemplate(t.rebirthReady, prestigeGain)}
                  </span>
                )}
              </div>

              {/* Requirement & Progress Info */}
              <div className="bg-black/30 rounded-xl p-2.5 border border-fuchsia-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-fuchsia-300 font-bold flex items-center gap-1">
                    {prestigeGain < 1 ? t.rebirthReq : formatTemplate(t.rebirthNext, prestigeGain + 1)}
                  </span>
                  <span className="font-black text-fuchsia-200 tabular-nums">
                    {rebirthProgress.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-black/50 h-2.5 rounded-full overflow-hidden border border-fuchsia-500/20">
                  <div
                    className="bar-flow h-full bg-gradient-to-r from-fuchsia-600 via-purple-500 to-amber-300 rounded-full transition-all duration-300"
                    style={{ width: `${rebirthProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-fuchsia-400/60 tabular-nums">
                  <span>{formatTemplate(t.rebirthEarned, formatNum(state.total))}</span>
                  <span>{formatTemplate(t.rebirthTarget, formatNum(nextRebirthTarget))}</span>
                </div>
              </div>

              <div className="text-[10px] text-fuchsia-300/60 leading-relaxed">
                {prestigeGain < 1 ? (
                  <span dangerouslySetInnerHTML={{ __html: formatTemplate(t.rebirthTipLocked, formatNum(Math.max(0, 1e6 - state.total))) }} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: formatTemplate(t.rebirthTipReady, prestigeGain, lang === 'uk' ? (prestigeGain > 1 ? 'ів' : '') : (prestigeGain > 1 ? 'ов' : '')) }} />
                )}
              </div>

              <button
                disabled={prestigeGain < 1}
                onClick={doPrestige}
                className={cn(
                  'w-full py-2.5 rounded-xl font-black text-sm transition active:scale-95 shadow-lg',
                  prestigeGain >= 1
                    ? 'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-amber-500 text-white animate-pulse shadow-fuchsia-500/40 cursor-pointer'
                    : 'bg-white/5 border border-fuchsia-500/20 text-fuchsia-400/50 cursor-not-allowed'
                )}
              >
                {prestigeGain >= 1
                  ? formatTemplate(t.rebirthBtnActive, prestigeGain)
                  : formatTemplate(t.rebirthBtnLocked, formatNum(Math.max(0, 1e6 - state.total)))}
              </button>
            </div>

            {/* Статус акаунта — спідометр античиту */}
            <div className="glass-card rounded-2xl p-4 relative">
              <div className="text-[11px] font-bold text-amber-400/50 mb-1 text-center tracking-widest">{t.antiCheatStatusTitle}</div>
              <button
                onClick={() => { setKarmaInfo(true); haptic.light(); }}
                className="absolute right-3 top-3 w-6 h-6 rounded-full bg-black/40 border border-amber-400/40 text-amber-300/80 text-[11px] font-black flex items-center justify-center active:scale-90 transition-transform"
                title={lang === 'uk' ? 'Що це і як працює?' : 'Что это и как работает?'}
              >?</button>
              <div className="text-center text-[9px] font-bold text-emerald-300/60 mb-1 tracking-wide">{t.antiCheatProtected}</div>
              <svg viewBox="0 0 200 112" className="w-44 mx-auto">
                <path d="M 20 100 A 80 80 0 0 1 87.5 21" stroke="#34d399" strokeWidth="14" fill="none" strokeLinecap="round" />
                <path d="M 87.5 21 A 80 80 0 0 1 164.7 53" stroke="#fbbf24" strokeWidth="14" fill="none" />
                <path d="M 164.7 53 A 80 80 0 0 1 180 100" stroke="#ef4444" strokeWidth="14" fill="none" strokeLinecap="round" />
                <g style={{ transform: `rotate(${(100 - karma) * 1.8}deg)`, transformOrigin: '100px 100px', transition: 'transform 0.7s cubic-bezier(0.3, 1, 0.4, 1)' }}>
                  <line x1="100" y1="100" x2="34" y2="100" stroke="#fef3c7" strokeWidth="4" strokeLinecap="round" />
                </g>
                <circle cx="100" cy="100" r="7" fill="#fbbf24" />
              </svg>
              <div
                className="text-center text-[13px] font-black mt-1"
                style={{ color: karma < 25 ? '#fca5a5' : karma < 50 ? '#fcd34d' : karma < 75 ? '#fdba74' : '#6ee7b7' }}
              >
                {challenge !== null ? t.karmaChecking : karma < 25 ? t.karmaShadow : karma < 50 ? t.karmaRestricted : karma < 75 ? t.karmaSuspicious : t.karmaClean}
              </div>
              {(karma < 75 || Date.now() < suspicionCooldownUntil.current) && (
                <div className="mt-2 space-y-0.5 text-[10px] text-amber-300/60 bg-black/30 rounded-xl p-2 border border-amber-500/10">
                  {karma < 25 && <div>{t.karmaWarnBurnt}</div>}
                  {karma < 75 && <div>{t.karmaWarnBetLimit}</div>}
                  {karma < 50 && <div>{t.karmaWarnCasinoClosed}</div>}
                  {karma < 25 && <div>{t.karmaWarnLeaderboardFrozen}</div>}
                  <div className="text-amber-500/40">{t.karmaWarnPlayFair}</div>
                </div>
              )}
              <div className="text-center text-[9px] text-amber-500/30 mt-0.5">{t.karmaRhythmTip}</div>
            </div>

            {/* Мова інтерфейсу — sliding pill тумблер */}
            <div className="glass-card rounded-2xl p-4">
              <div className="text-[11px] font-bold text-amber-400/50 mb-3 text-center tracking-widest">{t.langTitle}</div>
              <div className="relative flex bg-black/40 rounded-2xl p-1 border border-amber-500/15">
                {/* sliding pill */}
                <div
                  className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-amber-500/30 to-amber-400/20 border border-amber-400/40 shadow-lg shadow-amber-500/10"
                  style={{
                    left: lang === 'uk' ? '4px' : 'calc(50% + 2px)',
                    width: 'calc(50% - 6px)',
                    transition: 'left 0.4s cubic-bezier(0.65, 0, 0.35, 1)',
                  }}
                />
                <button
                  onClick={() => {
                    if (lang === 'uk') return;
                    setLang('uk');
                    langRef.current = 'uk';
                    setPhrase(PHRASES_I18N.uk[0]);
                    const next = { ...stateRef.current, lang: 'uk' as const };
                    stateRef.current = next;
                    setState(next);
                    saveNow(next);
                    haptic.light();
                  }}
                  className="relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-300"
                >
                  <span className="text-xl">🇺🇦</span>
                  <span className={cn('text-[13px] font-black transition-colors duration-300', lang === 'uk' ? 'text-amber-200' : 'text-amber-500/40')}>
                    Українська
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (lang === 'ru') return;
                    setLang('ru');
                    langRef.current = 'ru';
                    setPhrase(PHRASES_I18N.ru[0]);
                    const next = { ...stateRef.current, lang: 'ru' as const };
                    stateRef.current = next;
                    setState(next);
                    saveNow(next);
                    haptic.light();
                  }}
                  className="relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-300"
                >
                  <span className="text-xl">🇷🇺</span>
                  <span className={cn('text-[13px] font-black transition-colors duration-300', lang === 'ru' ? 'text-amber-200' : 'text-amber-500/40')}>
                    Русский
                  </span>
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4">
              <div className="text-[11px] font-bold text-amber-400/50 mb-2">{t.tipsTitle}</div>
              <div className="text-[10px] text-amber-300/40 space-y-1 leading-relaxed">
                {t.tips.map((tip, idx) => (
                  <p key={idx}>{tip}</p>
                ))}
              </div>
            </div>

            {/* Служба підтримки @hhimd */}
            <div className="glass-card rounded-2xl p-4 border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-black/40">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-black text-amber-200 flex items-center gap-1.5">
                    <span>💬</span>
                    <span>{t.settingsSupportTitle}</span>
                  </div>
                  <div className="text-[10px] text-amber-300/60 mt-0.5">
                    {t.settingsSupportDesc}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openSupport}
                  className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✈️</span>
                  <span>@{SUPPORT_USERNAME}</span>
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 border-red-500/15">
              <button onClick={resetGame} className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300/70 font-bold py-2.5 rounded-xl transition active:scale-95 text-sm">
                {t.resetBtn}
              </button>
            </div>

            <div className="text-center text-[9px] text-amber-500/20 pb-1 tracking-wider">{t.antiCheatProtected}</div>
            <div className="text-center text-[9px] text-amber-500/20 pb-2 tracking-wider">{t.gameVersion}</div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM NAV ===== */}
      <nav className="relative z-10 shrink-0 glass border-t border-amber-500/10 safe-bottom">
        <div className="relative flex">
          {([
            ['shop', '🏪', t.navShop],
            ['casino', '🎰', t.navCasino],
            ['clicker', '🫓', t.navClicker],
            ['leaders', '🏆', t.navLeaders],
            ['settings', '⚙️', t.navSettings],
          ] as [Page, string, string][]).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => goPage(id)}
              className={cn('flex-1 flex flex-col items-center py-2.5 transition-all relative', page === id ? 'text-amber-200' : 'text-amber-600/40 active:text-amber-400')}
            >
              <span className={cn('text-[22px] transition-all duration-200', page === id && 'animate-nav-bounce drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]')}>{icon}</span>
              {id === 'clicker' && (boss || pest) && page !== 'clicker' && (
                <span className="animate-alert-dot absolute z-10 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-[#0d0a04] left-[calc(50%+13px)] top-[10px]" />
              )}
              <span className={cn('text-[9px] font-bold mt-0.5 tracking-wider', page === id ? 'text-amber-300' : '')}>{label}</span>
            </button>
          ))}
          {/* Активний індикатор — плавно переїжджає між вкладками */}
          <div
            className="pointer-events-none absolute -top-px h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent"
            style={{
              left: `${((PAGE_ORDER.indexOf(page) + 0.5) / PAGE_ORDER.length) * 100}%`,
              transition: 'left 0.28s cubic-bezier(0.3, 1, 0.35, 1)',
            }}
          />
        </div>
      </nav>
    </div>
  );
}
