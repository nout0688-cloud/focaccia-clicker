import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  BUILDINGS,
  CLICK_UPGRADES,
  VIP_UPGRADES,
  buildingCost,
  formatCps,
  formatNum,
} from './game/data';
import { cn } from './utils/cn';
import focacciaImg from './assets/focaccia.png';
import goldenImg from './assets/golden.png';

/* ---- Telegram WebApp ---- */
const tg = window.Telegram?.WebApp;
const tgUser = (tg?.initDataUnsafe?.user || undefined) as { id?: number; first_name?: string; username?: string } | undefined;
const API_BASE = 'https://focaccia-bot.vercel.app';

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
  error: () => tg?.HapticFeedback?.notificationOccurred('error'),
};

/* ---- Types ---- */
interface SaveState {
  focaccia: number;
  total: number;
  clicks: number;
  buildings: Record<string, number>;
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
});

async function loadState(): Promise<SaveState> {
  try {
    const raw = await storage.get(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    delete parsed.photo;
    return { ...defaultState(), ...parsed };
  } catch { return defaultState(); }
}

const PHRASES = [
  'Ммм, фокача!', 'Ще одну!', 'Смачно!', 'Дай ще!', 'Хрустить!',
  'Бле-е-е 👅', 'ФОКАЧА!!!', 'Ням-ням', 'З томатом!', 'Це моя фокача!',
  'Гаряча! 🔥', 'Божественно!', 'Ще-ще-ще!', 'Обожнюю! 💛',
];

const BOSS_TYPES = [
  { id: 'rat', name: 'Король Щурів', emoji: '🐀', hp: 30, time: 20, diamonds: 3, timeCps: 60 },
  { id: 'mold', name: 'Мутантна Цвіль', emoji: '🦠', hp: 45, time: 22, diamonds: 5, timeCps: 120 },
  { id: 'fire', name: 'Пекельна Пожежа', emoji: '🔥', hp: 60, time: 25, diamonds: 8, timeCps: 180 },
  { id: 'mafia', name: 'Дон Фокачіо', emoji: '🤵', hp: 80, time: 30, diamonds: 12, timeCps: 300 },
];

const PEST_TYPES = [
  { name: 'Тарган-злодюжка', emoji: '🪳' },
  { name: 'Голодний жук', emoji: '🐜' },
  { name: 'Хитрий щур', emoji: '🐁' },
];

type Page = 'shop' | 'casino' | 'clicker' | 'leaders' | 'settings';
const PAGE_ORDER: Page[] = ['shop', 'casino', 'clicker', 'leaders', 'settings'];
type ShopTab = 'buildings' | 'upgrades' | 'vip' | 'achievements';

interface LeaderRow {
  id: string;
  name: string;
  username: string;
  total: number;
  prestige: number;
  flag?: boolean;
  online?: boolean;
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
  const [phrase, setPhrase] = useState('Натисни!');
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
  const [lang, setLang] = useState<'uk' | 'ru'>('uk'); // мова інтерфейсу

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
    if (!tgUser?.id) return;
    const cur = stateRef.current;
    fetch(`${API_BASE}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: tgUser.id,
        name: tgUser.first_name || 'Гравець',
        username: tgUser.username || '',
        total: Math.floor(cur.total),
        prestige: cur.prestige,
        clicks: Math.floor(cur.clicks),
        focaccia: Math.floor(cur.focaccia),
        diamonds: Math.floor(cur.diamonds),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.karma === 'number') setKarma(data.karma);
        if (data?.rank) setMyRank(data.rank);
      })
      .catch(() => { /* silent */ });
  }, [tgUser]);

  /* ---- Init ---- */
  useEffect(() => {
    if (tg) { tg.ready(); tg.expand(); }
    // Ref for the admin polling interval so it can be cleared on unmount
    let adminIv: ReturnType<typeof setInterval> | undefined;

    loadState().then((s) => {
      const elapsed = Math.min((Date.now() - s.lastSave) / 1000, 60 * 60 * 8);
      if (elapsed > 30) {
        let base = 0;
        for (const b of BUILDINGS) base += (s.buildings[b.id] || 0) * b.cps;
        let mult = 1;
        for (const u of CLICK_UPGRADES)
          if (u.cpsMult && s.upgrades.includes(u.id)) mult *= u.cpsMult;
        if (s.vipUpgrades?.includes('vip_chef')) mult *= 1.3;
        const karmaMult = (s.karma ?? 100) < 50 ? 0.5 : 1; // погана карма — офлайн-дохід −50%
        const gain = base * mult * (1 + s.prestige * 0.1) * elapsed * 0.5 * karmaMult;
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
              setConfirmModal({
                title: 'Скидання акаунту',
                text: 'Адміністратор провів скидання гри. Твій прогрес розпочато спочатку!',
                emoji: '🗑️',
                isAlert: true,
                confirmText: 'Ок',
                onConfirm: () => setConfirmModal(null),
              });
              haptic.error();
              setTimeout(reportSync, 100);
            } else {
              if (data?.reward && data.reward > 0) {
                setState((p) => {
                  const next = { ...p, focaccia: p.focaccia + data.reward, total: p.total + data.reward };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                addToast('🎁 Нагорода!', `+${formatNum(data.reward)} фокач від адміна!`, '🎁');
                setTimeout(reportSync, 100);
              }
              if (data?.diamonds && data.diamonds > 0) {
                setState((p) => {
                  const next = { ...p, diamonds: (p.diamonds || 0) + data.diamonds };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                addToast('💎 Нагорода за дуель!', `+${formatNum(data.diamonds)} 💎 отримано!`, '💎');
                haptic.success();
                setTimeout(reportSync, 100);
              }
              if (data?.rebirth && data.rebirth > 0) {
                setState((p) => {
                  const next = { ...p, prestige: p.prestige + data.rebirth };
                  stateRef.current = next;
                  saveNow(next);
                  return next;
                });
                addToast('🔄 Ребіртхи від адміна!', `+${data.rebirth} 🔄 до престижу!`, '🔄');
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
                addToast('⚖️ Коригування', `-${formatNum(data.deduct)} фокач списано адміністратором`, '⚠️');
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
    let mult = 1;
    for (const u of CLICK_UPGRADES) {
      if (u.cpsMult && state.upgrades.includes(u.id)) mult *= u.cpsMult;
    }
    if (state.vipUpgrades?.includes('vip_chef')) mult *= 1.3;
    if (activeEvent) mult *= activeEvent.cpsMult;
    return base * mult * prestigeMult;
  }, [state.buildings, state.upgrades, state.vipUpgrades, brokenBuilding, activeEvent, prestigeMult]);

  const frenzyMult = frenzy > 0 ? 7 : 1;
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

  // C — координаты 0..100: статистика движения. repeat ловит A→A→A и A→B→A→B,
  // но только при наличии вариативности ритма (метроном ловится через R).
  const coordScore = (taps: Tap[]): number => {
    if (taps.length < 60) return 0;
    const xs = taps.map((t) => t.x);
    const ys = taps.map((t) => t.y);
    // cv этого окна: метроном (cv < 0.08) обрабатывается в R, здесь repeat = 0
    const ivsC: number[] = [];
    for (let i = 1; i < taps.length; i++) ivsC.push(taps[i].t - taps[i - 1].t);
    const cMean = ivsC.reduce((a, b) => a + b, 0) / ivsC.length;
    const cSd = Math.sqrt(ivsC.reduce((a, b) => a + (b - cMean) ** 2, 0) / ivsC.length);
    const cvHere = cMean > 0 ? cSd / cMean : 1;
    const close = (i: number, j: number) => Math.abs(xs[i] - xs[j]) <= 8 && Math.abs(ys[i] - ys[j]) <= 8;
    let rep1 = 0, rep2 = 0;
    for (let i = 1; i < taps.length; i++) {
      if (close(i, i - 1)) rep1++;
      for (let k = 2; k <= 5 && i - k >= 0; k++) {
        if (close(i, i - k)) { rep2++; break; }
      }
    }
    const frac1 = rep1 / (taps.length - 1);
    const frac2 = rep2 / (taps.length - 1);
    const patternFraction = Math.max(frac1, frac2);
    let repeatScore = cvHere < 0.08 ? 0 : patternFraction > 0.90 ? 100 : patternFraction > 0.75 ? 70 : patternFraction > 0.55 ? 40 : 0;

    // movementScore: дисперсия длины шага (у бота шаг почти константный)
    const steps: number[] = [];
    for (let i = 1; i < taps.length; i++) steps.push(Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    const stMean = steps.reduce((a, b) => a + b, 0) / steps.length;
    const stVar = steps.reduce((a, b) => a + (b - stMean) ** 2, 0) / steps.length;

    // directionScore: убогая палитра направлений или тряска на месте
    const dirs = new Set<number>();
    let flips = 0, lastSign = 0;
    for (let i = 1; i < taps.length; i++) {
      const dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1];
      if (Math.hypot(dx, dy) < 0.5) continue;
      dirs.add(Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4))) % 8);
      const s = Math.sign(dx);
      if (s !== 0) { if (lastSign !== 0 && s !== lastSign) flips++; lastSign = s; }
    }
    // pathScore: точка «ползёт» плавно при заметном общем смещении
    const bbox = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));

    // Клетки 16px: 2 пальца человека занимают 3-6 клеток (якоря раздельно + разброс),
    // фиксированный бот — 1, плавная траектория бота — 10+. Стабильно к дрейфу пальцев.
    const cells = new Set<string>();
    for (let i = 0; i < taps.length; i++) {
      cells.add(`${Math.round(xs[i] / 16)}:${Math.round(ys[i] / 16)}`);
    }
    const cellCount = cells.size;
    // Бимодальность: у двух пальцев позиции — 2 раздельные группы (провал ≥ 40% bbox),
    // у дрожащего бота — сплошная клякса (макс gaps между соседними позициями мал).
    const sortedXs = [...xs].sort((a, b) => a - b);
    const sortedYs = [...ys].sort((a, b) => a - b);
    let gapX = 0, gapY = 0;
    for (let i = 1; i < sortedXs.length; i++) gapX = Math.max(gapX, sortedXs[i] - sortedXs[i - 1]);
    for (let i = 1; i < sortedYs.length; i++) gapY = Math.max(gapY, sortedYs[i] - sortedYs[i - 1]);
    const bboxX = sortedXs[sortedXs.length - 1] - sortedXs[0];
    const bboxY = sortedYs[sortedYs.length - 1] - sortedYs[0];
    const multiFinger = cellCount <= 6 && bbox > 8 && ((bboxX > 0 && gapX > bboxX * 0.4) || (bboxY > 0 && gapY > bboxY * 0.4));

    let movementScore = stVar < 4 && taps.length > 100 ? 80 : 0;
    let directionScore = (dirs.size <= 2 && steps.length > 20) || (flips > 60 && stMean < 6) ? 70 : 0;
    let pathScore = stMean < 4 && bbox > 15 ? 60 : 0;
    if (multiFinger) {
      // Человеческие пальцы: C ограничиваем — двухпальцевый тап не должен триггерить
      repeatScore = Math.min(repeatScore, 40);
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
    if (taps.length < 40) return 0;
    const ivs: number[] = [];
    for (let i = 1; i < taps.length; i++) ivs.push(taps[i].t - taps[i - 1].t);
    const mean = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    const sd = Math.sqrt(ivs.reduce((a, b) => a + (b - mean) ** 2, 0) / ivs.length);
    const cv = sd / mean;

    // tempoDrift: дрейф средних темпов на подокнах
    const subSize = Math.max(10, Math.min(25, Math.floor(ivs.length / 8)));
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

    // pauseNaturalness: естественные паузы разной длины
    const pauses = ivs.filter((iv) => iv > 800);
    const pauseNaturalness = pauses.length === 0 ? 0 : pauses.length === 1 ? 60 : Math.min(100, 40 + pauses.length * 10);

    // pathVariation: разброс точек (мобайл), десктоп — нейтрально
    const xs = taps.map((t) => t.x);
    const ys = taps.map((t) => t.y);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const stdX = Math.sqrt(xs.reduce((a, b) => a + (b - mx) ** 2, 0) / xs.length);
    const stdY = Math.sqrt(ys.reduce((a, b) => a + (b - my) ** 2, 0) / ys.length);
    const platform = tg?.platform || 'unknown';
    const pathVariation = platform === 'ios' || platform === 'android' ? Math.min(100, (stdX + stdY) * 4) : 50;

    // sessionVariation: если окно растянуто по времени — были перерывы (настенные часы)
    const span = taps[taps.length - 1].wall - taps[0].wall;
    const sessionVariation = span > 15 * 60000 ? 100 : span > 8 * 60000 ? 60 : 20;

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
    // H тоже мульти-масштаб: короткий эпизод не определяет человечность
    const H40 = humanScore(t40.length >= 40 ? t40 : []);
    const H100 = t100.length >= 100 ? humanScore(t100) : 0;
    const H300 = t300.length >= 300 ? humanScore(t300) : 0;
    const H = 0.20 * H40 + 0.35 * H100 + 0.45 * H300;

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
    const independentSignals = (R >= 40 ? 1 : 0) + (C >= 45 ? 1 : 0) + (B >= 45 ? 1 : 0) + (metronome ? 1 : 0);
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
      triggerChallenge();
    }
  };

  const triggerChallenge = () => {
    if (challenge !== null || challengeOpening.current) return;
    challengeOpening.current = true; // guard от double-flag race
    setChallenge({ caught: 0, x: 20 + Math.random() * 55, y: 30 + Math.random() * 32, timeLeft: 5, result: null });
    addToast('🚫 Авто-клікер не смачний!', 'Фокачі пригорають… Доведи бабусі, що ти не робот!', '👵');
    haptic.error();
    if (tgUser?.id) {
      fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tgUser.id, event: 'flag' }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data?.karma === 'number') setKarma(data.karma);
          challengeOpening.current = false; // challenge установлен — guard снят
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
    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => r.json())
      .then((data) => setLeaders(data?.players || []))
      .catch(() => setLeaders([]))
      .finally(() => setLeadersLoading(false));
  }, []);

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
      if (Date.now() - lastClick.current > 1200) setCombo((c) => (c > 0 ? Math.max(0, c - 3) : 0));
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

      if (roll < 0.35 && cur.focaccia >= 500) {
        // Tax inspection
        const hasAccountant = cur.vipUpgrades?.includes('vip_tax');
        const taxRate = hasAccountant ? 0.01 : 0.05;
        const tax = Math.max(1, Math.floor(cur.focaccia * taxRate));
        setState((p) => ({ ...p, focaccia: Math.max(0, p.focaccia - tax) }));
        addToast('👮 Податкова!', `Сплачено ${taxRate * 100}% податку (-${formatNum(tax)} 🫓)`, '📋');
        doFlash('tax');
        haptic.medium();
      } else if (roll < 0.6) {
        // Baking Festival
        setActiveEvent({ title: 'Свято випічки', emoji: '☀️', timeLeft: 25, cpsMult: 2.0 });
        addToast('☀️ Свято випічки!', 'Виробництво x2 на 25 секунд!', '🎉');
        haptic.success();
      } else if (roll < 0.8) {
        // Damp weather
        setActiveEvent({ title: 'Сирість у печі', emoji: '🌧️', timeLeft: 20, cpsMult: 0.7 });
        addToast('🌧️ Сирість на кухні!', 'CPS -30% на 20 секунд', '💨');
        haptic.error();
      } else {
        // Grandma surprise gift
        const bonus = Math.max(100, Math.floor((cpsRef.current || 10) * 90));
        setState((p) => ({ ...p, focaccia: p.focaccia + bonus, total: p.total + bonus }));
        addToast('👵 Бабусин пиріг!', `+${formatNum(bonus)} смачних фокач!`, '🥐');
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
      const pType = PEST_TYPES[Math.floor(Math.random() * PEST_TYPES.length)];
      setPest({
        id: Date.now(),
        x: 15 + Math.random() * 70,
        y: 25 + Math.random() * 45,
        name: pType.name,
        emoji: pType.emoji,
        dir: Math.random() < 0.5 ? 1 : -1,
      });
      addToast('⚠️ Шкідник!', `${pType.name} пробрався на склад! Тапни його!`, pType.emoji);
      haptic.medium();
    }, 45000);
    return () => clearInterval(iv);
  }, [loading, pest, addToast]);

  // Pest auto-escape and focaccia stealing
  useEffect(() => {
    if (!pest) return;
    const escapeTimer = setTimeout(() => {
      setPest(null);
      addToast('💨 Втік!', 'Шкідник наївся і втік!', '🏃');
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
      // Spawn random boss
      const bType = BOSS_TYPES[Math.floor(Math.random() * BOSS_TYPES.length)];
      const currentCps = Math.max(10, cpsRef.current);
      setBoss({
        id: bType.id,
        name: bType.name,
        emoji: bType.emoji,
        maxHp: bType.hp,
        currentHp: bType.hp,
        timeLeft: bType.time,
        rewardDiamonds: bType.diamonds,
        rewardFocaccia: Math.max(100, Math.floor(currentCps * bType.timeCps)),
      });
      addToast('🚨 БОС НАПАВ!', `${bType.name} атакує! Заклікай його!`, bType.emoji);
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
        const stolen = Math.floor(stateRef.current.focaccia * 0.1);
        if (stolen > 0) {
          setState((p) => ({ ...p, focaccia: Math.max(0, p.focaccia - stolen) }));
          addToast('💀 Бос втік!', `Вкрав ${formatNum(stolen)} фокач! Наступного разу бий швидше!`, '😱');
        } else {
          addToast('💀 Бос втік!', 'Твоя каса була порожня — красти нічого!', '😱');
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
      addToast('🔧 Зношення!', `${target.name} зламалась! (-50% CPS). Полагодь у магазині!`, '⚠️');
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
    const achState = {
      total: state.total, clicks: state.clicks, cps,
      buildings: state.buildings, maxCombo: state.maxCombo,
      goldenCaught: state.goldenCaught, prestige: state.prestige,
      diamonds: state.diamonds, bossesDefeated: state.bossesDefeated,
      pestsSquashed: state.pestsSquashed,
    };
    const newly = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.check(achState));
    if (newly.length) {
      setState((p) => ({
        ...p,
        achievements: [...p.achievements, ...newly.map((a) => a.id)],
      }));
      newly.forEach((a) => {
        addToast('Досягнення!', a.name, a.emoji);
        haptic.success();
      });
    }
  }, [loading, state.total, state.clicks, cps, state.buildings, state.maxCombo, state.goldenCaught, state.prestige, state.diamonds, state.bossesDefeated, state.pestsSquashed, state.achievements, addToast]);

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

  // Challenge провалено → карма −5 на сервері + cooldown 90с (не можна спамити спробами)
  useEffect(() => {
    if (challenge?.result !== 'fail') return;
    suspicion.current = Math.max(0, suspicion.current * 0.50);
    recentEvidence.current = [];
    suspicionCooldownUntil.current = Date.now() + 90 * 1000;
    if (tgUser?.id) {
      fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tgUser.id, event: 'fail' }),
      })
        .then((r) => r.json())
        .then((data) => { if (typeof data?.karma === 'number') setKarma(data.karma); })
        .catch(() => {});
    }
    addToast('💀 Випробування провалено!', '−5 карми. Бабуся спостерігає…', '💔');
  }, [challenge?.result, tgUser]);

  useEffect(() => {
    if (loading || karma >= 25) return;
    // «Тінь бабусі» — нагадування при глибоко посадженій кармі
    const iv = setInterval(() => {
      addToast('🔴 Тінь бабусі…', `Карма ${karma}/100 — грай чесно, обмеження знімуться`, '⏳');
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
        // Cooldown PASS: suspicion гасится, повышенная чувствительность выключена на 7 хв
        suspicion.current *= 0.25;
        recentEvidence.current = [];
        suspicionCooldownUntil.current = Date.now() + 7 * 60 * 1000;
        setChallenge((c) => (c ? { ...c, result: 'win' } : c));
        addToast('✅ Бабуся повірила тобі!', 'Підозру знято, фокачі більше не пригорають!', '🫓');
        haptic.success();
      };
      if (tgUser?.id) {
        fetch(`${API_BASE}/api/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: tgUser.id, event: 'clear' }),
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
    setCasinoMsg({ text: `Виграш +${formatNum(winAmt)} ${casinoCurSym} (×${mult})`, win: true });
    updateLuck(mult);
    if (jackpot || mult >= 5) {
      burstConfetti(['🫓', '💎', '⭐', '✨']);
      doFlash('golden');
      addToast('🎰 ДЖЕКПОТ!', `${combo} — +${formatNum(winAmt)} ${casinoCurSym}!`, '💎');
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
    if (casinoBet > casinoMaxBet) {
      addToast('🔒 Карма замала', `Максимальна ставка — ${formatNum(casinoMaxBet)} ${casinoCurSym}`, '❌');
      return;
    }
    if (casinoBalance < casinoBet) {
      addToast(`🎰 Не вистачає ${casinoCur === 'gem' ? 'алмазів' : 'фокач'}!`, `Ставка ${formatNum(casinoBet)} ${casinoCurSym} — зменш її`, '❌');
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
        setCasinoMsg({ text: `Виграш +${formatNum(winAmt)} ${casinoCurSym} (×${finalMult})`, win: true });
        updateLuck(finalMult);
        if (finalMult >= 8) {
          burstConfetti(['🫓', '💎', '⭐', '✨']);
          doFlash('golden');
          addToast('🎰 ДЖЕКПОТ!', `${final[0]}${final[1]}${final[2]} — +${formatNum(winAmt)} ${casinoCurSym}!`, '💎');
          haptic.heavy();
        } else {
          haptic.success();
        }
      } else {
        setCasinoMsg({ text: 'Мимо… фокача пригоріла. Спробуй ще!', win: false });
        updateLuck(0);
        haptic.light();
      }
    }, 1500));
  };

  const rollDice = () => {
    if (casinoSpinning) return;
    if (casinoBet > casinoMaxBet) {
      addToast('🔒 Карма замала', `Максимальна ставка — ${formatNum(casinoMaxBet)} ${casinoCurSym}`, '❌');
      return;
    }
    if (casinoBalance < casinoBet) {
      addToast(`🎲 Не вистачає ${casinoCur === 'gem' ? 'алмазів' : 'фокач'}!`, `Ставка ${formatNum(casinoBet)} ${casinoCurSym} — зменш її`, '❌');
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
        setCasinoMsg({ text: `Твої ${(DICE_FACES[result.mine - 1])} проти ${(DICE_FACES[result.house - 1])} — виграш +${formatNum(winAmt)} ${casinoCurSym}!`, win: true });
        updateLuck(1.9);
        haptic.success();
      } else if (mult === 1) {
        casinoGive(casinoCur, casinoBet); // ничья — ставка возвращается
        setCasinoMsg({ text: 'Нічия — ставка повернулась', win: false });
        updateLuck(1);
        haptic.light();
      } else {
        setCasinoMsg({ text: `Бабуся перемогла: ${(DICE_FACES[result.house - 1])} проти ${(DICE_FACES[result.mine - 1])}. Ще раз?`, win: false });
        updateLuck(0);
        haptic.light();
      }
    }, 1100);
  };

  const spinWheel = () => {
    if (casinoSpinning) return;
    if (casinoBet > casinoMaxBet) {
      addToast('🔒 Карма замала', `Максимальна ставка — ${formatNum(casinoMaxBet)} 🫓`, '❌');
      return;
    }
    if (state.focaccia < casinoBet) {
      addToast('🎡 Не вистачає фокач!', `Ставка ${formatNum(casinoBet)} 🫓 — зменш її`, '❌');
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
        creditWin(mult, `Колесо ×${mult}`, false);
      } else {
        setCasinoMsg({ text: 'Колесо показало порожній сектор… Ще раз?', win: false });
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
    const newCombo = burning ? combo : (now - lastClick.current < 1200 ? combo + 1 : 1);
    lastClick.current = now;
    setCombo(newCombo);
    if (!burning && [25, 50, 75, 100].includes(newCombo)) {
      showMilestone(`🔥 КОМБО x${newCombo}! 🔥`);
      burstConfetti(newCombo >= 100 ? ['🔥', '💥', '⭐', '🫓'] : ['✨', '⭐']);
      haptic.success();
    }

    const crit = !burning && Math.random() < 0.05;
    const gain = clickPower * comboMult * frenzyMult * (crit ? 10 : 1) * (burning ? 0.05 : 1);

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

    if (Math.random() < 0.15) setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  };

  const attackBoss = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.heavy();

    setBoss((currentBoss) => {
      if (!currentBoss) return null;

      // Read damage from the current stateRef to avoid stale closure on vipUpgrades
      const damage = stateRef.current.vipUpgrades?.includes('vip_knife') ? 2 : 1;
      const newHp = currentBoss.currentHp - damage;

      addFloat(window.innerWidth / 2, window.innerHeight * 0.35, `-${damage} ⚔️`, 'text-red-400 text-2xl font-black');

      if (newHp <= 0) {
        // Boss defeated — apply rewards outside this setter via setState
        const rDiamonds = currentBoss.rewardDiamonds;
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
        addToast('🏆 БОСА ЗНИЩЕНО!', `+${rDiamonds} 💎 та +${formatNum(rFocaccia)} 🫓!`, '⚔️');
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

    const gotDiamond = Math.random() < 0.4;
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

    addToast(
      '💥 РОЗЧАВЛЕНО!',
      gotDiamond ? `+1 💎 та +${formatNum(bonus)} 🫓!` : `+${formatNum(bonus)} 🫓 захищено!`,
      '🪲',
    );
  };

  const fixBuilding = (id: string) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;
    const cur = stateRef.current;
    const cost = Math.max(50, Math.floor(b.baseCost * 0.3));
    if (cur.focaccia < cost) {
      addToast('Не вистачає фокач', `Ремонт коштує 🫓 ${formatNum(cost)}`, '❌');
      return;
    }
    const next: SaveState = { ...cur, focaccia: cur.focaccia - cost };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    setBrokenBuilding(null);
    addToast('Ремонт завершено!', `${b.name} знову працює на 100%!`, '🔧');
    haptic.success();
  };

  const buyBuilding = (id: string) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;
    const cur = stateRef.current;
    const cost = buildingCost(b, cur.buildings[id] || 0);
    if (cur.focaccia < cost) return;
    const next: SaveState = {
      ...cur,
      focaccia: cur.focaccia - cost,
      buildings: { ...cur.buildings, [id]: (cur.buildings[id] || 0) + 1 },
    };
    stateRef.current = next;
    setState(next);
    saveNow(next);
    haptic.medium();
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
    addToast('Куплено!', u.name, u.emoji);
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
    addToast('ВІП куплено!', u.name, u.emoji);
    haptic.success();
  };

  const catchGolden = () => {
    setGolden(null);
    haptic.heavy();
    doFlash('golden');
    burstConfetti(['🫓', '⭐', '✨', '🌟', '💛']);
    const roll = Math.random();
    let bonus = 0;
    let dGain = 0;
    if (roll < 0.45) {
      setFrenzy(20);
      addToast('ФРЕНЗІ!', 'x7 до всього на 20 секунд!', '🔥');
    } else if (roll < 0.8) {
      bonus = Math.max(cps * 60 * 3, clickPower * 200, 50);
      addToast('Удача!', `+${formatNum(bonus)} фокач!`, '✨');
    } else {
      // Golden gives diamonds!
      dGain = 2;
      addToast('Діамантовий скарб!', `+${dGain} 💎 рідкісних діамантів!`, '💎');
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
    setConfirmModal({
      title: 'Ребіртх', emoji: '🔄',
      text: `Зробити +${prestigeGain} Ребіртх? (+${prestigeGain * 10}% до всього назавжди, +${prestigeGain * 5} енергії, та розблокування нових будівель і прокачок!). Фокачі та будівлі скинуться, але 💎 діаманти та ВІП залишаться!`,
      onConfirm: () => {
        const cur = stateRef.current;
        const next: SaveState = {
          ...defaultState(),
          prestige: cur.prestige + prestigeGain,
          diamonds: cur.diamonds,
          vipUpgrades: cur.vipUpgrades,
          achievements: cur.achievements,
          goldenCaught: cur.goldenCaught,
          maxCombo: cur.maxCombo,
          bossesDefeated: cur.bossesDefeated,
          pestsSquashed: cur.pestsSquashed,
          lastReset: cur.lastReset,
        };
        stateRef.current = next;
        setState(next);
        saveNow(next);
        reportSync();
        addToast('Ребіртх виконано!', `+${(cur.prestige + prestigeGain) * 10}% бонус та нові відкриття!`, '🔄');
        doFlash('golden');
        burstConfetti(['🔄', '💎', '✨', '⭐', '🫓']);
        haptic.success();
        setConfirmModal(null);
      },
    });
  };

  const resetGame = () => {
    setConfirmModal({
      title: 'Скинути гру?', emoji: '🗑️',
      text: 'Ти впевнений? Весь прогрес, досягнення та престиж будуть втрачені НАЗАВЖДИ!',
      onConfirm: () => {
        setConfirmModal({
          title: '⚠️ ОСТАННЄ ПОПЕРЕДЖЕННЯ', emoji: '💀',
          text: `Ти збираєшся видалити ${formatNum(state.total)} фокач, ${state.achievements.length} досягнень, ${state.diamonds} 💎 і ${state.prestige} очок престижу. Це НЕ можна відмінити!`,
          onConfirm: () => { storage.remove(SAVE_KEY); setState(defaultState()); haptic.error(); setConfirmModal(null); },
        });
      },
    });
  };

  const totalBuildings = Object.values(state.buildings).reduce((a, b) => a + b, 0);
  const energyPercent = (state.energy / maxEnergy) * 100;

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6" style={{ animation: 'bob 1.5s ease-in-out infinite' }}>🫓</div>
          <div className="text-amber-400 font-black text-xl tracking-widest">ЗАВАНТАЖЕННЯ</div>
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
          title="Натисни щоб прибити шкідника!"
        >
          <span className="text-3xl inline-block" style={{ transform: `scaleX(${pest.dir})` }}>{pest.emoji}</span>
          <div className="text-[9px] bg-red-600/90 text-white font-black px-1.5 py-0.5 rounded-full whitespace-nowrap shadow mt-0.5 animate-bounce">
            Тапни! 💥
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
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => { closeToast(t.id); haptic.light(); }}
            className={cn(
              'animate-toast glass rounded-2xl p-3 flex items-center gap-3 shadow-2xl border border-amber-500/30 cursor-pointer active:scale-95 transition-transform',
              toastsLeaving.includes(t.id) && 'toast-exit',
            )}
            title="Натисни, щоб закрити"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl shrink-0">{t.emoji}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">{t.title}</div>
              <div className="text-xs font-semibold truncate text-amber-100">{t.text}</div>
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
                {confirmModal.confirmText || 'Ок'}
              </button>
            ) : (
              <div className="flex gap-3">
                <button className="flex-1 glass border border-amber-500/20 text-amber-200 font-bold py-3 rounded-2xl transition active:scale-95" onClick={() => setConfirmModal(null)}>Ні</button>
                <button className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl transition active:scale-95 shadow-lg shadow-amber-500/25" onClick={confirmModal.onConfirm}>{confirmModal.confirmText || 'Так'}</button>
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
            <h2 className="text-xl font-black mb-1 text-amber-100">Поки тебе не було…</h2>
            <p className="text-amber-300/70 mb-3 text-sm">Бабусі напекли тобі</p>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300 mb-6">+{formatNum(offlineGain)} 🫓</div>
            <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl w-full transition active:scale-95 shadow-lg shadow-amber-500/25" onClick={() => { setOfflineGain(null); doFlash('golden'); burstConfetti(['🫓', '🥐', '⭐', '✨']); }}>Забрати!</button>
          </div>
        </div>
      )}

      {/* Античит-випробування «Бабуся не вірить» */}
      {challenge && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          <div className="text-5xl mb-2">👵</div>
          <h2 className="text-xl font-black text-amber-100 mb-1 text-center">Бабуся не вірить тобі!</h2>
          {challenge.result === null && (
            <>
              <p className="text-amber-300/70 text-sm mb-4 text-center">Злови 3 фокачі за 5 секунд і доведи, що ти не робот</p>
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
              <p className="text-amber-200 font-bold mb-4">Бабуся перевіряє карму…</p>
            </div>
          )}
          {challenge.result === 'win' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3">✅</div>
              <p className="text-emerald-300 font-bold mb-5">Бабуся повірила тобі! Фокачі більше не пригорають.</p>
              <button onClick={() => setChallenge(null)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 px-8 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25">Грати далі</button>
            </div>
          )}
          {challenge.result === 'denied' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3">🔴</div>
              <p className="text-red-300 font-bold mb-1">Тінь бабусі не слухає!</p>
              <p className="text-amber-300/60 text-[11px] mb-5">Карма нижче 25 — випробування не діє. Грай чесно, карма відновиться.</p>
              <button onClick={() => setChallenge(null)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 px-8 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25">Зрозуміло</button>
            </div>
          )}
          {challenge.result === 'fail' && (
            <div className="text-center" style={{ animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="text-6xl mb-3">💀</div>
              <p className="text-red-300 font-bold mb-5">Не встиг! Фокачі поки що пригорають…</p>
              <button
                onClick={() => setChallenge({ caught: 0, x: 20 + Math.random() * 55, y: 30 + Math.random() * 32, timeLeft: 5, result: null })}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 px-8 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25"
              >
                Ще спроба
              </button>
              <button onClick={() => setChallenge(null)} className="block mx-auto mt-3 text-xs text-amber-500/50 font-bold">Пізніше</button>
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
            <h2 className="text-lg font-black text-amber-100 text-center mb-1">TapSentinel v5</h2>
            <p className="text-[11px] text-amber-300/70 leading-relaxed mb-3">
              Це поведінковий рейтинг акаунта — <b className="text-amber-200">карма 0–100</b>. Античит стежить за
              ритмом натискань: люди тапають нерівно, з паузами й різними точками — боти рівно, як метроном.
              Підозрілі патерни знижують карму, а чим менша карма — тим більше обмежень.
            </p>
            <div className="space-y-1.5 text-[11px] leading-relaxed mb-3">
              <div className="flex items-start gap-2">
                <span>🟢</span>
                <span><b className="text-emerald-300">75–100 — Чистий:</b> все доступно</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🟡</span>
                <span><b className="text-yellow-300">50–74 — Під підозрою:</b> ставки в казино максимум 1K</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🟠</span>
                <span><b className="text-orange-300">25–49 — Погана репутація:</b> казино закрите, офлайн-дохід −50%</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🔴</span>
                <span><b className="text-red-300">0–24 — Тінь бабусі:</b> кліки дають ×0.05, лідерборд заморожено, нагороди від адміна не видаються</span>
              </div>
            </div>
            <div className="bg-black/30 rounded-xl p-2.5 text-[11px] text-amber-300/70 leading-relaxed mb-3">
              <div className="font-black text-amber-300/80 mb-1">Як відновити карму:</div>
              <div>• Пройди випробування «Злови 3 фокачі» — <b className="text-amber-200">+10</b></div>
              <div>• Грай чесно — <b className="text-amber-200">+1 за годину</b> гри</div>
            </div>
            <button
              onClick={() => { setKarmaInfo(false); haptic.light(); }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-2.5 rounded-2xl transition active:scale-95 shadow-lg shadow-amber-500/25"
            >
              Зрозуміло
            </button>
          </div>
        </div>
      )}

      {/* ===== TOP BAR ===== */}
      <div className="relative z-10 shrink-0 glass border-b border-amber-500/15 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div key={state.clicks} className="animate-num-pop text-2xl font-black tabular-nums leading-tight">
                <span className={cn('text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300', frenzy > 0 && 'animate-rainbow')}>{formatNum(state.focaccia)}</span>
                <span className="text-xl ml-1">🫓</span>
              </div>
              <div className="flex items-center gap-1 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-lg text-xs font-black text-cyan-300 animate-diamond">
                <span>💎</span>
                <span>{state.diamonds}</span>
              </div>
            </div>
            <div className="text-amber-400/60 text-[11px] font-medium mt-0.5">
              {formatCps(cps * frenzyMult)}/с • {formatNum(clickPower * comboMult * frenzyMult)}/клік
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {brokenBuilding && (
              <div onClick={() => { goPage('shop'); setShopTab('buildings'); }} className="cursor-pointer text-red-300 text-[10px] font-black bg-red-500/25 px-2 py-1 rounded-full border border-red-500/40 animate-pulse">
                🔧 Зламано!
              </div>
            )}
            {activeEvent && (
              <div className={cn(
                'text-[10px] font-black px-2 py-1 rounded-full border animate-pulse',
                activeEvent.cpsMult > 1 ? 'text-amber-200 bg-amber-500/20 border-amber-500/40' : 'text-blue-300 bg-blue-500/20 border-blue-500/40',
              )}>
                {activeEvent.emoji} {activeEvent.timeLeft}с
              </div>
            )}
            {frenzy > 0 && (
              <div className="text-orange-300 font-black animate-pulse text-xs bg-gradient-to-r from-orange-500/20 to-red-500/20 px-2.5 py-1 rounded-full border border-orange-500/40">
                🔥 x7 {frenzy}с
              </div>
            )}
            {state.prestige > 0 && frenzy <= 0 && !activeEvent && (
              <div className="text-fuchsia-300 text-[10px] font-bold bg-fuchsia-500/15 px-2 py-1 rounded-full border border-fuchsia-500/25">
                🔄 {state.prestige} Ребіртх (+{state.prestige * 10}%)
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
              <div className="w-full max-w-xs glass border-2 border-red-500/60 rounded-2xl p-3 shadow-[0_0_30px_rgba(239,68,68,0.4)] text-center animate-boss">
                <div className="flex items-center justify-between text-xs font-black text-red-300 mb-1">
                  <span>🚨 {boss.name}</span>
                  <span className={cn('tabular-nums font-mono', boss.timeLeft <= 5 && 'text-red-400 font-bold animate-bounce')}>
                    ⏱️ {boss.timeLeft}с
                  </span>
                </div>
                <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-red-500/30 mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-all duration-100"
                    style={{ width: `${(boss.currentHp / boss.maxHp) * 100}%` }}
                  />
                </div>
                <button
                  onClick={attackBoss}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-2 rounded-xl text-sm transition active:scale-95 shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">{boss.emoji}</span>
                  <span>АТАКУВАТИ! ({boss.currentHp}/{boss.maxHp} HP)</span>
                  <span className="text-xs opacity-75">{state.vipUpgrades?.includes('vip_knife') ? '⚔️ x2' : '⚔️ x1'}</span>
                </button>
              </div>
            ) : null}

            {/* Combo */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] font-bold text-amber-500/70 mb-0.5">
                <span>КОМБО</span>
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
                  {state.energy <= 0 ? '⏳ ПЕРЕЗАРЯДКА' : '⚡ ЕНЕРГІЯ'}
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
                <span key={phrase} className="animate-wobble-once inline-block">{state.energy <= 0 ? '⏳ Зачекай...' : phrase}</span>
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
              <div><div className="text-amber-500/50">З'їдено</div><div className="font-black text-amber-200/80 text-sm tabular-nums">{formatNum(state.total)}</div></div>
              <div><div className="text-amber-500/50">Кліків</div><div className="font-black text-amber-200/80 text-sm tabular-nums">{state.clicks.toLocaleString()}</div></div>
              <div><div className="text-amber-500/50">Босів</div><div className="font-black text-red-300 text-sm tabular-nums">⚔️ {state.bossesDefeated}</div></div>
            </div>
          </div>
        )}

        {/* --- SHOP --- */}
        {page === 'shop' && (
          <div className={cn('h-full flex flex-col', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            <div className="flex shrink-0 p-1.5 gap-1">
              {([
                ['buildings', '🏗️', 'Будівлі', totalBuildings],
                ['upgrades', '⚡', 'Апгрейди', state.upgrades.length],
                ['vip', '💎', 'ВІП', state.vipUpgrades?.length || 0],
                ['achievements', '🏆', 'Досягн.', state.achievements.length],
              ] as [ShopTab, string, string, number][]).map(([id, icon, label, count]) => (
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
                  {icon} {label} <span className="opacity-50">({count})</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
              {/* BUILDINGS */}
              {shopTab === 'buildings' && BUILDINGS.map((b, i) => {
                const owned = state.buildings[b.id] || 0;
                const cost = buildingCost(b, owned);
                const can = state.focaccia >= cost;
                const isBroken = brokenBuilding === b.id;
                const repairCost = Math.max(50, Math.floor(b.baseCost * 0.3));
                const canRepair = state.focaccia >= repairCost;
                const prevOwned = i === 0 || (state.buildings[BUILDINGS[i - 1].id] || 0) > 0;
                const visible = owned > 0 || prevOwned || state.total >= b.baseCost * 0.5;
                const isRebirthLocked = (b.requireRebirth || 0) > state.prestige;

                if (isRebirthLocked) {
                  return (
                    <div key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 opacity-50 border border-fuchsia-500/15 animate-card">
                      <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-xl shrink-0 grayscale">
                        🔒
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-amber-100/70 text-[13px] flex justify-between">
                          <span className="truncate">{b.name}</span>
                          <span className="text-fuchsia-400 text-xs font-bold">Ребіртх {b.requireRebirth} 🔄</span>
                        </div>
                        <div className="text-[10px] text-amber-500/50 truncate">
                          Потрібен {b.requireRebirth} ребіртх для розблокування
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

                return (
                  <div key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} className={cn(
                    'rounded-xl transition-all animate-card',
                    isBroken ? 'border border-red-500/50 bg-red-950/30 p-2.5' : '',
                  )}>
                    <button onClick={() => buyBuilding(b.id)} disabled={!can}
                      className={cn('w-full text-left rounded-xl p-2.5 flex items-center gap-2.5 transition-all active:scale-[0.98]',
                        can ? 'glass-card glass-card-hover' : 'glass-card opacity-40',
                      )}>
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors',
                        can ? 'bg-amber-500/15' : 'bg-black/20',
                      )}>{b.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-amber-100/90 text-[13px] flex justify-between">
                          <span className="truncate">{b.name}</span>
                          <span className="text-amber-400/60 tabular-nums ml-2 text-xs">{owned}</span>
                        </div>
                        <div className="text-[10px] text-amber-400/40 truncate">{b.desc}</div>
                        <div className="text-[10px] mt-0.5 flex justify-between">
                          <span className={cn('font-bold', can ? 'text-emerald-400' : 'text-red-400/70')}>🫓 {formatNum(cost)}</span>
                          <span className={cn(isBroken ? 'text-red-400 font-bold' : 'text-amber-300/50')}>
                            {isBroken ? '⚠️ -50% CPS' : `+${formatCps(b.cps * prestigeMult)}/с`}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isBroken && (
                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-red-500/20">
                        <span className="text-[10px] text-red-300 font-bold">Зламано! Ефективність впала вдвічі</span>
                        <button
                          onClick={() => fixBuilding(b.id)}
                          disabled={!canRepair}
                          className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-black text-[11px] px-3 py-1 rounded-lg shadow active:scale-95"
                        >
                          🔧 Полагодити (🫓 {formatNum(repairCost)})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

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
                  <div className="text-center text-amber-500/30 py-8 text-xs">✨ Доступних прокачок на цьому ребіртху більше нема</div>
                )}
                {CLICK_UPGRADES
                  .filter((u) => !state.upgrades.includes(u.id))
                  .filter((u) => (u.requireRebirth || 0) <= state.prestige)
                  .filter((u) => {
                    if (u.requireBuilding) return (state.buildings[u.requireBuilding.id] || 0) >= u.requireBuilding.count;
                    return state.total >= u.cost * 0.3;
                  }).map((u, i) => {
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
                        <div className={cn('font-bold text-[13px]', isEnergy ? 'text-cyan-100/90' : 'text-sky-100/90')}>{u.name}</div>
                        <div className={cn('text-[10px]', isEnergy ? 'text-cyan-300/40' : 'text-sky-300/40')}>{u.desc}</div>
                        <div className={cn('text-[10px] font-bold mt-0.5', can ? 'text-emerald-400' : 'text-red-400/70')}>🫓 {formatNum(u.cost)}</div>
                      </div>
                    </button>
                  );
                })}

                {/* Locked upgrades preview */}
                {CLICK_UPGRADES.filter((u) => (u.requireRebirth || 0) > state.prestige).slice(0, 4).map((u, i) => (
                  <div key={u.id} style={{ animationDelay: `${i * 35}ms` }} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 opacity-40 border border-fuchsia-500/15 animate-card">
                    <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-xl shrink-0 grayscale">
                      🔒
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-amber-100/60 text-[13px] flex justify-between">
                        <span className="truncate">{u.name}</span>
                        <span className="text-fuchsia-400 text-xs font-bold">Ребіртх {u.requireRebirth} 🔄</span>
                      </div>
                      <div className="text-[10px] text-amber-500/50 truncate">{u.desc}</div>
                    </div>
                  </div>
                ))}

                {state.upgrades.length > 0 && (
                  <div className="pt-3">
                    <div className="text-[10px] uppercase font-bold text-amber-500/30 mb-2 tracking-widest">Куплено</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CLICK_UPGRADES.filter((u) => state.upgrades.includes(u.id)).map((u) => (
                        <span key={u.id} title={`${u.name}: ${u.desc}`} className="text-lg glass-card rounded-lg w-9 h-9 flex items-center justify-center">{u.emoji}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>)}

              {/* VIP / DIAMONDS SHOP */}
              {shopTab === 'vip' && (
                <div className="space-y-2">
                  <div className="glass-card rounded-xl p-3 flex items-center justify-between border-cyan-500/30 bg-cyan-950/20">
                    <div>
                      <div className="text-xs font-black text-cyan-200">💎 Твої діаманти: {state.diamonds}</div>
                      <div className="text-[10px] text-cyan-300/60">Здобувай за перемогу над босами, шкідників та досягнення!</div>
                    </div>
                  </div>

                  {VIP_UPGRADES.map((u, i) => {
                    const bought = state.vipUpgrades?.includes(u.id);
                    const can = state.diamonds >= u.cost && !bought;
                    return (
                      <button
                        key={u.id}
                        onClick={() => buyVipUpgrade(u.id)}
                        disabled={bought || !can}
                        style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
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
                            <span>{u.name}</span>
                            {bought && <span className="text-emerald-400 text-xs">✓ Куплено</span>}
                          </div>
                          <div className="text-[10px] text-cyan-300/60">{u.desc}</div>
                          {!bought && (
                            <div className={cn('text-[10px] font-bold mt-0.5', can ? 'text-cyan-300' : 'text-red-400/70')}>
                              💎 {u.cost} діамантів
                            </div>
                          )}
                        </div>
                        {can && (
                          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                            <span className="vip-shine absolute inset-y-0 left-0 w-10 bg-white/10" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ACHIEVEMENTS */}
              {shopTab === 'achievements' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {ACHIEVEMENTS.map((a, i) => {
                    const done = state.achievements.includes(a.id);
                    return (
                      <div key={a.id} style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }} className={cn('glass-card rounded-xl p-3 text-center transition-all animate-card', done && 'border-yellow-400/30 bg-yellow-500/5', !done && 'opacity-30')}>
                        <div className={cn('text-2xl', !done && 'grayscale')}>{a.emoji}</div>
                        <div className="font-bold text-xs mt-1">{a.name}</div>
                        <div className="text-[9px] text-amber-400/40 mt-0.5">{a.desc}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CASINO --- */}
        {page === 'casino' && (() => {
          const spinLabel = casinoGame === 'slots' ? '🎰 КРУТИТИ' : casinoGame === 'dice' ? '🎲 КИНУТИ КОСТІ' : '🎡 ОБЕРТИ КОЛЕСО';
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
              <h2 className="text-base font-black text-amber-200/80 text-center tracking-wide">🎰 КАЗИНО «ОДНАРУКА БАБУСЯ»</h2>

              {/* Ігри */}
              <div className="flex gap-1.5">
                {([['slots', '🎰', 'Автомат'], ['dice', '🎲', 'Кості'], ['wheel', '🎡', 'Колесо']] as const).map(([id, icon, label]) => (
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
                  <div className="font-black text-amber-100">Казино закрите</div>
                  <div className="text-[11px] text-amber-300/60">Карма {karma}/100 — бабуся не довіряє тобі. Грай чесно, підніми карму вище 50, і двері відчиняться.</div>
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
                      <div className="text-[10px] font-black text-amber-500/50 mb-1">ТИ</div>
                      <div className="w-20 h-20 rounded-xl bg-black/50 border-2 border-amber-500/30 flex items-center justify-center text-[3.4rem] leading-none">
                        {diceRoll ? DICE_FACES[diceRoll.mine - 1] : '🎲'}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-amber-500/40">VS</div>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-red-400/60 mb-1">БАБУСЯ</div>
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
                  {casinoSpinning ? '🎲 ГРАЄМО…' : `${spinLabel} — ${formatNum(casinoBet)} ${casinoCurSym}`}
                </button>
              </div>

              {/* Валюта ставки */}
              <div className="flex gap-1.5">
                {([['foc', '🫓', 'Фокачі'], ['gem', '💎', 'Алмази']] as const).map(([id, icon, label]) => (
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
                  <div className="text-[10px] uppercase font-bold text-amber-500/30 tracking-widest">Ставка</div>
                  <div className="text-[10px] font-bold text-amber-300/50 tabular-nums">Баланс: {formatNum(casinoBalance)} {casinoCurSym}</div>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    value={casinoCustomBet}
                    onChange={(e) => setCustomBet(e.target.value)}
                    inputMode="numeric"
                    placeholder="Своя ставка…"
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
                  <div className="text-[10px] uppercase font-bold text-amber-500/30 mb-1 tracking-widest">Виплати</div>
                  {Object.entries(CASINO_PAYOUTS).map(([s, m]) => (
                    <div key={s} className="flex justify-between items-center text-[11px]">
                      <span className="tracking-widest">{s}{s}{s}</span>
                      <span className={cn('font-black', m >= 15 ? 'text-fuchsia-300' : 'text-amber-300')}>×{m}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-amber-500/10">
                    <span className="text-amber-400/60">Будь-які 2 однакові</span>
                    <span className="font-black text-amber-300/80">×{CASINO_PAIR_MULT}</span>
                  </div>
                </div>
              )}
              {casinoGame === 'dice' && (
                <div className="glass-card rounded-2xl p-3 text-[11px] text-amber-300/60 space-y-1">
                  <div>• Кинув більший кістяк, ніж бабуся → <b className="text-amber-300">×1.9</b></div>
                  <div>• Нічия → ставка повертається</div>
                  <div>• Менший → ставка згоріла 🔥</div>
                </div>
              )}
                  {casinoGame === 'wheel' && (
                    <div className="glass-card rounded-2xl p-3 text-[11px] text-amber-300/60">
                      • 5 з 10 секторів порожні, але є ×2, ×5 і два ×0.5/×1.5. Вказівник зверху — куди впаде, те й твій множник.
                    </div>
                  )}
              </>)}
              <div className="text-center text-[9px] text-amber-500/30 pb-2">Виграш казино не додається до рейтингу «з'їдено»</div>
            </div>
          );
        })()}

        {/* --- LEADERBOARD --- */}
        {page === 'leaders' && (
          <div className={cn('h-full overflow-y-auto p-4 space-y-2', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            <h2 className="text-base font-black text-amber-200/80 text-center tracking-wide">🏆 ЛІДЕРИ ФОКАЧІ</h2>

            <div className="glass-card rounded-xl p-2.5 text-center text-[11px] font-bold text-amber-300/70">
              <div>
                {myRank ? <>Твоє місце: <span className="text-amber-200 font-black">#{myRank}</span></> : 'Залітай у топ — з\'їдь більше фокач! 🫓'}
              </div>
              {leaders && (
                <div className="text-[10px] text-emerald-300/80 mt-0.5 flex items-center justify-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Онлайн: {leaders.filter((l) => l.online).length}
                </div>
              )}
            </div>

            {leadersLoading && <div className="text-center text-amber-500/50 py-8 text-xs animate-pulse">⏳ Завантаження…</div>}

            {!leadersLoading && leaders && leaders.length === 0 && (
              <div className="text-center text-amber-500/40 py-8 text-xs">Поки що порожньо. Обганяй усіх! 🫓</div>
            )}

            {!leadersLoading && leaders && leaders.map((pl, i) => {
              const isMe = !!tgUser?.id && String(pl.id) === String(tgUser.id);
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
              return (
                <div
                  key={pl.id}
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  className={cn(
                    'rounded-xl p-2.5 flex items-center gap-3 animate-card',
                    isMe ? 'border border-amber-400/50 bg-amber-500/10' : 'glass-card',
                  )}
                >
                  <div className={cn('shrink-0 text-center font-black w-8', i < 3 ? 'text-lg' : 'text-amber-500/50 text-sm')}>{medal}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[13px] text-amber-100/90 truncate">
                      {pl.online && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 align-middle" title="Онлайн" />}
                      {pl.name}
                      {pl.username && <span className="text-amber-500/50 text-[11px] font-normal"> @{pl.username}</span>}
                      {isMe && <span className="ml-1.5 text-[9px] bg-amber-500/25 text-amber-300 px-1.5 py-0.5 rounded-full font-black align-middle">ЦЕ ТИ</span>}
                    </div>
                    <div className="text-[10px] text-fuchsia-300/60">🔄 {pl.prestige} ребіртх(ів)</div>
                  </div>
                  {pl.flag && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); addToast('⚠️ Можливо використовував авто-клікер', `${pl.name} — спрацював античит`, '⚠️'); haptic.light(); }}
                      className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/50 text-xs flex items-center justify-center animate-pulse"
                      title="Можливо використовував авто-клікер"
                    >⚠️</button>
                  )}
                  <div className="text-right shrink-0">
                    <div className="font-black text-amber-200 text-sm tabular-nums">{formatNum(pl.total)}</div>
                    <div className="text-[9px] text-amber-500/40">з'їдено 🫓</div>
                  </div>
                </div>
              );
            })}

            {!leadersLoading && (
              <button
                onClick={loadLeaders}
                className="w-full glass-card glass-card-hover rounded-xl py-2.5 text-[11px] font-black text-amber-300/70 transition active:scale-95"
              >
                🔄 Оновити
              </button>
            )}

            <div className="text-center text-[9px] text-amber-500/20 pb-2">Рейтинг за з'їденими фокачами за весь час</div>
          </div>
        )}

        {/* --- SETTINGS --- */}
        {page === 'settings' && (
          <div className={cn('h-full overflow-y-auto p-4 space-y-3', pageDir === 1 ? 'animate-page-right' : 'animate-page-left')}>
            <h2 className="text-base font-black text-amber-200/80 text-center tracking-wide">⚙️ НАЛАШТУВАННЯ ТА СТАТИСТИКА</h2>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                ['🫓', formatNum(state.total), "З'їдено"],
                ['💎', String(state.diamonds), 'Діамантів'],
                ['🔄', String(state.prestige), 'Ребіртхів'],
                ['⚔️', String(state.bossesDefeated), 'Босів подолано'],
                ['🪲', String(state.pestsSquashed), 'Шкідників знищено'],
                ['👆', state.clicks.toLocaleString(), 'Кліків'],
                ['⚡', `x${state.maxCombo}`, 'Макс комбо'],
                ['✨', String(state.goldenCaught), 'Золотих'],
                ['🏗️', String(totalBuildings), 'Будівель'],
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
                  <div className="font-black text-fuchsia-200 text-sm">Ребіртх: {state.prestige} рівень</div>
                  <div className="text-[10px] text-fuchsia-400/70">+{state.prestige * 10}% доходу назавжди • +{state.prestige * 5} енергії</div>
                </div>
                {prestigeGain >= 1 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 text-[10px] font-black animate-pulse">
                    +{prestigeGain} Готово!
                  </span>
                )}
              </div>

              {/* Requirement & Progress Info */}
              <div className="bg-black/30 rounded-xl p-2.5 border border-fuchsia-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-fuchsia-300 font-bold flex items-center gap-1">
                    {prestigeGain < 1 ? '🔒 Потрібно: 1 000 000 🫓 (1 млн / 1кк)' : `🎯 До наступного (+${prestigeGain + 1})`}
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
                  <span>Зароблено: {formatNum(state.total)} 🫓</span>
                  <span>Ціль: {formatNum(nextRebirthTarget)} 🫓</span>
                </div>
              </div>

              <div className="text-[10px] text-fuchsia-300/60 leading-relaxed">
                {prestigeGain < 1 ? (
                  <span>
                    💡 Ребіртх відкривається при досягненні <b>1 000 000 фокач</b> (залишилось ще {formatNum(Math.max(0, 1e6 - state.total))}). Він розблокує нові будівлі та прокачки в магазині! 💎 Діаманти та ВІП зберігаються.
                  </span>
                ) : (
                  <span>
                    ✨ Скинь фокачі та будівлі → отримай <b className="text-fuchsia-200">+{prestigeGain} Ребіртх{prestigeGain > 1 ? 'ів' : ''}</b>! Відкриває нові будівлі та прокачки в магазині. 💎 Діаманти та ВІП залишаються.
                  </span>
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
                  ? `Зробити Ребіртх (+${prestigeGain} 🔄)`
                  : `🔒 Потрібно 1 000 000 🫓 (ще ${formatNum(Math.max(0, 1e6 - state.total))})`}
              </button>
            </div>

            {/* Статус акаунта — спідометр античиту */}
            <div className="glass-card rounded-2xl p-4 relative">
              <div className="text-[11px] font-bold text-amber-400/50 mb-1 text-center tracking-widest">🛡 СТАТУС АКАУНТА</div>
              <button
                onClick={() => { setKarmaInfo(true); haptic.light(); }}
                className="absolute right-3 top-3 w-6 h-6 rounded-full bg-black/40 border border-amber-400/40 text-amber-300/80 text-[11px] font-black flex items-center justify-center active:scale-90 transition-transform"
                title="Що це і як працює?"
              >?</button>
              <div className="text-center text-[9px] font-bold text-emerald-300/60 mb-1 tracking-wide">ЗАХИЩЕНО TAPSENTINEL v5 — BEHAVIORAL ANTI-CHEAT</div>
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
                {challenge !== null ? '⚠️ Перевірка триває' : karma < 25 ? '🔴 Тінь бабусі' : karma < 50 ? '⚠️ Обмежений режим' : karma < 75 ? '🟡 Під підозрою' : 'Акаунт чистий ✅'}
              </div>
              {(karma < 75 || Date.now() < suspicionCooldownUntil.current) && (
                <div className="mt-2 space-y-0.5 text-[10px] text-amber-300/60 bg-black/30 rounded-xl p-2 border border-amber-500/10">
                  {karma < 25 && <div>🚫 Фокачі пригорають — кліки дають ×0.05</div>}
                  {karma < 75 && <div>🔒 Ставки в казино — максимум 1K</div>}
                  {karma < 50 && <div>🔒 Казино закрите, офлайн-дохід −50%</div>}
                  {karma < 25 && <div>🔒 Лідерборд заморожено, нагороди від адміна не видаються</div>}
                  <div className="text-amber-500/40">Грай чесно — карма відновиться</div>
                </div>
              )}
              <div className="text-center text-[9px] text-amber-500/30 mt-0.5">Античит стежить за ритмом кліків — грай чесно і стрілка буде в зелені</div>
            </div>

            {/* Мова інтерфейсу — sliding pill тумблер */}
            <div className="glass-card rounded-2xl p-4">
              <div className="text-[11px] font-bold text-amber-400/50 mb-3 text-center tracking-widest">🌐 МОВА / ЯЗЫК</div>
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
              <div className="text-[11px] font-bold text-amber-400/50 mb-2">💡 Підказки та правила</div>
              <div className="text-[10px] text-amber-300/40 space-y-1 leading-relaxed">
                <p>• 🔄 Ребіртх доступний від 1 000 000 фокач (1 млн / 1кк) — дає +10% доходу назавжди та відкриває нові товари!</p>
                <p>• ⚔️ Бий босів швидко — вони тікають і крадуть 10% каси!</p>
                <p>• 🪲 Тапай шкідників одразу, поки вони не поїли фокачі!</p>
                <p>• 🔧 Лагодь зношені будівлі в магазині (-50% CPS)</p>
                <p>• 👮 Плати податок або купуй Бухгалтера у ВІП за 💎</p>
                <p>• 💎 Діаманти та ВІП-прокачки НЕ зникають після ребіртху</p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 border-red-500/15">
              <button onClick={resetGame} className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300/70 font-bold py-2.5 rounded-xl transition active:scale-95 text-sm">
                🗑️ Скинути гру повністю
              </button>
            </div>

            <div className="text-center text-[9px] text-amber-500/20 pb-1 tracking-wider">🛡 ЗАХИЩЕНО: TAPSENTINEL v5 — BEHAVIORAL ANTI-CHEAT</div>
            <div className="text-center text-[9px] text-amber-500/20 pb-2 tracking-wider">ФОКАЧА КЛІКЕР v1.1</div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM NAV ===== */}
      <nav className="relative z-10 shrink-0 glass border-t border-amber-500/10 safe-bottom">
        <div className="relative flex">
          {([
            ['shop', '🏪', 'Прокачки'],
            ['casino', '🎰', 'Казино'],
            ['clicker', '🫓', 'Клікер'],
            ['leaders', '🏆', 'Лідери'],
            ['settings', '⚙️', 'Інше'],
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
