import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../game/data';
import { cn } from '../utils/cn';

const API = 'https://focaccia-bot.vercel.app/api/duel';

type Snap = {
  ok?: boolean;
  error?: string;
  stage: 'challenge' | 'accepted' | 'countdown' | 'live' | 'paused' | 'finished' | 'cancelled';
  isOpen?: boolean;
  creatorId?: string;
  isCreator?: boolean;
  me?: { id: string; name: string; score: number };
  opp?: { id: string; name: string; score: number; missing?: boolean; u?: string };
  goal?: number;
  startTs?: number;
  elapsed?: number;
  limit?: number;
  stake?: number;
  pot?: number;
  myPaid?: number;
  stakeCur?: 'gem' | 'foc';
  serverNow?: number;
  winner?: string | null;
  reason?: string | null;
  pausedLeft?: number;
};

type ActivePlayer = {
  id: string;
  name: string;
  username?: string;
  score?: number;
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const initial = (n: string) => (n.trim()[0] || '?').toUpperCase();
const Avatar = ({ src, name, u, side }: { src?: string; name: string; u?: string; side: 'left' | 'right' }) => (
  <div
    className="flex flex-col items-center gap-2 w-32"
    style={{
      animation: `${side === 'left' ? 'duel-in-left' : 'duel-in-right'} 0.65s cubic-bezier(0.22, 1, 0.36, 1) both`,
      willChange: 'transform, opacity',
    }}
  >
    <div
      className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-amber-400/80 bg-gradient-to-br from-amber-600/40 to-orange-900/40 flex items-center justify-center"
      style={{ animation: 'duel-glow-pulse 1.6s ease-in-out infinite' }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-3xl font-black text-amber-300">{initial(name)}</span>
      )}
    </div>
    <div className="bg-black/50 rounded-xl px-2.5 py-1 text-[12px] font-black text-amber-100 truncate max-w-full">{name}</div>
    {u && <div className="bg-black/40 rounded-lg px-2 py-0.5 text-[10px] font-bold text-amber-300/80 truncate max-w-full -mt-0.5">@{u}</div>}
  </div>
);

const SAVE_KEY = 'focaccia-clicker-v1';
const storage = {
  async get(key: string): Promise<string | null> {
    const getLocal = (): string | null => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    };
    const localVal = getLocal();

    let cloudVal: string | null = null;
    const cs = (window as unknown as { Telegram?: { WebApp?: { CloudStorage?: { getItem: (k: string, cb: (e: any, v: string) => void) => void } } } }).Telegram?.WebApp?.CloudStorage;
    if (cs) {
      try {
        cloudVal = await new Promise<string | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 1200);
          cs.getItem(key, (err: any, value: string) => {
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

    try {
      const lObj = JSON.parse(localVal);
      const cObj = JSON.parse(cloudVal);
      const lTime = Number(lObj?.lastSave) || 0;
      const cTime = Number(cObj?.lastSave) || 0;

      if (lTime > cTime + 1000) return localVal;
      if (cTime > lTime + 1000) return cloudVal;

      const lTotal = Number(lObj?.total) || 0;
      const cTotal = Number(cObj?.total) || 0;
      return lTotal >= cTotal ? localVal : cloudVal;
    } catch {
      return localVal || cloudVal;
    }
  },
  set(key: string, value: string) {
    try { window.localStorage.setItem(key, value); } catch { /* */ }
    try {
      const wTg = (window as unknown as { Telegram?: { WebApp?: { CloudStorage?: { setItem: (k: string, v: string, cb?: () => void) => void } } } }).Telegram?.WebApp;
      if (wTg?.CloudStorage) wTg.CloudStorage.setItem(key, value, () => {});
    } catch { /* */ }
  },
};

export default function DuelApp({ duelId: initialDuelId }: { duelId: string }) {
  const tg = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
  const meId = String(tg?.initDataUnsafe?.user?.id || '');
  const myName = String(tg?.initDataUnsafe?.user?.first_name || 'Гравець');
  const myU = String(tg?.initDataUnsafe?.user?.username || '');
  const myPhoto = (tg?.initDataUnsafe?.user as { photo_url?: string } | undefined)?.photo_url;

  const haptic = {
    light: () => tg?.HapticFeedback?.impactOccurred?.('light'),
    medium: () => tg?.HapticFeedback?.impactOccurred?.('medium'),
    heavy: () => tg?.HapticFeedback?.impactOccurred?.('heavy'),
    success: () => tg?.HapticFeedback?.notificationOccurred?.('success'),
    error: () => tg?.HapticFeedback?.notificationOccurred?.('error'),
    selection: () => tg?.HapticFeedback?.selectionChanged?.(),
  };

  const isLobbyProp = !initialDuelId || initialDuelId === 'lobby' || initialDuelId === 'new';
  const [duelId, setDuelId] = useState<string>(isLobbyProp ? '' : initialDuelId);

  // ===== ЛОБІ: Стейт вибору налаштувань =====
  const [oppMode, setOppMode] = useState<'active' | 'search' | 'open'>('active');
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<ActivePlayer | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [lobbyStakeCur, setLobbyStakeCur] = useState<'foc' | 'gem'>('foc');
  const [lobbyStake, setLobbyStake] = useState(1000);
  const [lobbyGoal, setLobbyGoal] = useState(100);
  const [lobbyTimeMs, setLobbyTimeMs] = useState(180000);
  const [creatingDuel, setCreatingDuel] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Стейт для приєднання до відкритої дуелі як Гравець 2
  const [openPreview, setOpenPreview] = useState<any>(null);
  const [joiningOpen, setJoiningOpen] = useState(false);
  const [isOpenRoom, setIsOpenRoom] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  const [stage, setStage] = useState('…');
  const [base, setBase] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [oppName, setOppName] = useState('Соперник');
  const [oppU, setOppU] = useState('');
  const [pending, setPending] = useState(0);
  const [, setOffset] = useState(0);
  const [pausedLeft, setPausedLeft] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [startTs, setStartTs] = useState(0);
  const [error, setError] = useState('');
  const [stakeCur, setStakeCur] = useState<'foc' | 'gem'>('foc');
  const [stake, setStake] = useState(0);
  const [goal, setGoal] = useState(100);
  const [limit, setLimit] = useState(15 * 60 * 1000);
  const [pot, setPot] = useState(0);
  const [myPaid, setMyPaid] = useState(0);
  const snapRef = useRef<Snap | null>(null);
  const escrowDone = useRef(false);
  const settled = useRef(false);
  const [introPhase, setIntroPhase] = useState<'' | 'p1' | 'p2' | 'vs' | 'fade'>('');
  const introStartedFor = useRef('');
  const getInitialSave = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
      const bRaw = window.localStorage.getItem('focaccia-balance');
      if (bRaw) {
        const b = JSON.parse(bRaw);
        return { focaccia: Number(b.f) || 0, diamonds: Number(b.d) || 0 };
      }
    } catch {}
    return null;
  };
  const [userSave, setUserSave] = useState<any>(getInitialSave);
  const [insufficientFunds, setInsufficientFunds] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // Dynamic Combat & Tap Juice
  const [combo, setCombo] = useState(0);
  const [cps, setCps] = useState(0);
  const [floatingPops, setFloatingPops] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const [tilt, setTilt] = useState(0);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const pendingRef = useRef(0);
  const inFlight = useRef(false);
  const offsetRef = useRef(0);

  // Підтримка параметру target з профілю гравця
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const targetParam = searchParams.get('target');
    if (targetParam && (!duelId || duelId === 'lobby')) {
      fetch(`${API}?action=find_player&q=${encodeURIComponent(targetParam)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok && data.player) {
            setSelectedOpp(data.player);
            setOppMode('search');
          }
        })
        .catch(() => {});
    }
  }, [duelId]);

  // Миттєва добровільна здача (forfeit)
  const handleForfeitDuel = async () => {
    if (!duelId || !meId) return;
    haptic.heavy();
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forfeit', duelId, userId: meId }),
      });
    } catch { /* */ }
  };

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  // Баланс гравця
  const myFocaccia = Math.floor(Number(userSave?.focaccia) || 0);
  const myDiamonds = Math.floor(Number(userSave?.diamonds) || 0);
  const currentBalance = lobbyStakeCur === 'gem' ? myDiamonds : myFocaccia;

  // Завантаження списку активних гравців для лобі
  useEffect(() => {
    if (duelId) return;
    let active = true;
    setLoadingPlayers(true);
    fetch(`${API}?action=get_active_players&userId=${meId}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.ok && Array.isArray(data.players)) {
          setActivePlayers(data.players);
          if (data.players.length > 0 && !selectedOpp) {
            setSelectedOpp(data.players[0]);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPlayers(false);
      });
    return () => { active = false; };
  }, [duelId, meId]);

  // Перевірка попереднього перегляду, якщо відкрито посилання на відкриту дуель
  useEffect(() => {
    if (!duelId || duelId === 'lobby') return;
    let active = true;
    fetch(`${API}?action=preview&duelId=${duelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.ok && data.duel) {
          const d = data.duel;
          if (d.stage === 'challenge' && d.isOpen && d.creator?.id !== meId) {
            setOpenPreview(d);
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [duelId, meId]);

  // Пошук гравця за юзернеймом або ID
  const handleSearchPlayer = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    haptic.light();
    try {
      const res = await fetch(`${API}?action=find_player&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data?.ok && data.player) {
        if (String(data.player.id) === String(meId)) {
          setSearchError('Не можна викликати самого себе');
          haptic.error();
        } else {
          setSelectedOpp(data.player);
          haptic.success();
        }
      } else {
        setSearchError('Гравця не знайдено');
        haptic.error();
      }
    } catch {
      setSearchError('Помилка пошуку');
      haptic.error();
    } finally {
      setSearching(false);
    }
  };

  // Створення дуелі
  const handleCreateDuel = async () => {
    if (!meId) return;
    if (oppMode !== 'open' && !selectedOpp) {
      haptic.error();
      return;
    }
    if (lobbyStake > currentBalance) {
      haptic.error();
      return;
    }

    setCreatingDuel(true);
    haptic.heavy();
    try {
      const targetId = oppMode === 'open' ? null : selectedOpp?.id;
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'challenge',
          from: meId,
          to: targetId,
          fromName: myName,
          fromU: myU,
          toName: selectedOpp?.name || '',
          toU: selectedOpp?.username || '',
          stakeCur: lobbyStakeCur,
          stake: lobbyStake,
          goal: lobbyGoal,
          timeMs: lobbyTimeMs,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.duelId) {
        setDuelId(data.duelId);
        setIsCreator(true);
        setIsOpenRoom(oppMode === 'open');
        setStake(lobbyStake);
        setStakeCur(lobbyStakeCur);
        setGoal(lobbyGoal);
        setLimit(lobbyTimeMs);
        setStage('challenge');
        window.history.replaceState({}, '', `?v=1.4.0&duel=${data.duelId}`);
        haptic.success();
      } else {
        if (data?.error === 'no_funds_creator') {
          setError('У тебе недостатньо коштів для цієї ставки');
        } else if (data?.error === 'no_funds_opponent') {
          setError('У обраного суперника недостатньо коштів для цієї ставки');
        } else if (data?.error === 'shadow') {
          setError('Акаунт обмежено античитом');
        } else {
          setError(data?.error ? `Помилка: ${data.error}` : 'Не вдалося створити дуель');
        }
        haptic.error();
      }
    } catch {
      setError('Помилка з\'єднання з сервером');
      haptic.error();
    } finally {
      setCreatingDuel(false);
    }
  };

  // Приєднання до відкритої дуелі
  const handleJoinOpenDuel = async () => {
    if (!duelId || !meId) return;
    setJoiningOpen(true);
    haptic.heavy();
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join_open',
          duelId,
          userId: meId,
          name: myName,
          u: myU,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setOpenPreview(null);
        haptic.success();
      } else {
        if (data?.error === 'no_funds') {
          setInsufficientFunds('У тебе недостатньо коштів для ставки в цій дуелі!');
        } else {
          setError(data?.error ? `Помилка: ${data.error}` : 'Не вдалося приєднатися');
        }
        haptic.error();
      }
    } catch {
      setError('Помилка з\'єднання');
      haptic.error();
    } finally {
      setJoiningOpen(false);
    }
  };

  // Скасування дуелі
  const handleCancelDuel = async () => {
    if (!duelId || !meId) return;
    haptic.medium();
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', duelId, userId: meId }),
      });
    } catch { /* */ }
    resetToLobby();
  };

  const resetToLobby = () => {
    setDuelId('');
    setOpenPreview(null);
    setStage('…');
    setWinner(null);
    setReason(null);
    setError('');
    setInsufficientFunds(null);
    escrowDone.current = false;
    settled.current = false;
    pendingRef.current = 0;
    setPending(0);
    setBase(0);
    setOppScore(0);
    window.history.replaceState({}, '', '?v=1.4.0&duel=lobby');
  };

  const goToGame = () => {
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  const shareDuelLink = () => {
    const link = `https://t.me/focaca_robot?start=duel_${duelId}`;
    const text = `⚔️ Я створив дуель у Фокача Клікері на ${formatNum(stake || lobbyStake)} ${stakeCur === 'gem' ? '💎' : '🫓'}! Приєднуйся і бийся зі мною:`;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    try {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(tgShareUrl);
      } else {
        window.open(tgShareUrl, '_blank');
      }
    } catch {
      window.open(tgShareUrl, '_blank');
    }
    haptic.medium();
  };

  const copyDuelLink = () => {
    const link = `https://t.me/focaca_robot?start=duel_${duelId}`;
    try {
      navigator.clipboard?.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      haptic.success();
    } catch {
      /* */
    }
  };

  const copyDirectWebLink = () => {
    const link = `https://nout0688-cloud.github.io/focaccia-clicker/?v=${Date.now()}&duel=${duelId}`;
    try {
      navigator.clipboard?.writeText(link);
      setCopiedDirectLink(true);
      setTimeout(() => setCopiedDirectLink(false), 2500);
      haptic.success();
    } catch {}
  };

  const copyDuelCode = () => {
    try {
      navigator.clipboard?.writeText(duelId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      haptic.success();
    } catch {}
  };

  // счёт = серверный + неотправленные
  const displayScore = base + pending;

  // цикл синхронизации с сервером (1 раз в ~900мс)
  useEffect(() => {
    if (!duelId || duelId === 'lobby' || !meId || openPreview) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      const delta = pendingRef.current;
      // отправляем ровно накопленное, НЕ обнуляя: тапы во время запроса остаются
      pendingRef.current = Math.max(0, pendingRef.current - delta);
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync', duelId, userId: meId, delta, name: myName, u: myU }),
        });
        const data: Snap = await res.json();
        if (data.ok === false && data.error) {
          if (data.error === 'not a player' && data.isOpen) return;
          setError(
            data.error === 'not a player'
              ? 'Ти не є учасником цієї дуелі'
              : data.error === 'expired'
              ? 'Час очікування вичерпано (5 хв)'
              : data.error === 'not found'
              ? 'Дуель не знайдено або завершено'
              : `Помилка: ${data.error}`
          );
          setStage('error');
          return;
        }
        if (typeof data.serverNow === 'number') {
          offsetRef.current = data.serverNow - Date.now();
          setOffset(offsetRef.current);
        }
        if (typeof data.startTs === 'number' && data.startTs > 0) setStartTs(data.startTs);
        if (typeof data.goal === 'number') setGoal(data.goal);
        if (typeof data.limit === 'number') setLimit(data.limit);
        if (typeof data.stake === 'number') setStake(data.stake);
        if (typeof data.pot === 'number') setPot(data.pot);
        if (typeof data.myPaid === 'number') setMyPaid(data.myPaid);
        if (data.stakeCur === 'gem' || data.stakeCur === 'foc') setStakeCur(data.stakeCur);
        if (data.isOpen !== undefined) setIsOpenRoom(Boolean(data.isOpen));
        if (data.isCreator !== undefined) setIsCreator(Boolean(data.isCreator));
        if (data.me) setBase(data.me.score);
        if (data.opp) {
          setOppScore(data.opp.score);
          setOppName(data.opp.name || 'Соперник');
          setOppU(data.opp.u || '');
        }
        snapRef.current = data;
        // recovered: серверный счёт + всё, что ещё не отправлено
        setPending(pendingRef.current);
        setStage(data.stage);
        setPausedLeft(data.pausedLeft || 0);
        if (data.winner !== undefined) setWinner(data.winner);
        if (data.reason !== undefined) setReason(data.reason);
        if (data.stage === 'finished' && iv) clearInterval(iv); // финиш — опрос остановлен
      } catch { /* сеть мигнула — счёт остался локально */ } finally {
        inFlight.current = false;
      }
    };
    tick();
    iv = setInterval(tick, 900);
    return () => { if (iv) clearInterval(iv); };
  }, [duelId, meId, openPreview]);

  // локальный тик: перерисовка таймера/отсчёта 10 раз в секунду
  useEffect(() => {
    const iv = setInterval(() => forceTick((v) => v + 1), 100);
    return () => clearInterval(iv);
  }, []);

  // Завантаження сейву через CloudStorage + localStorage + серверний баланс
  useEffect(() => {
    let active = true;
    const loadBal = async () => {
      let loadedSave: any = null;
      try {
        const raw = await storage.get(SAVE_KEY);
        if (raw) loadedSave = JSON.parse(raw);
      } catch { /* */ }

      // Якщо сейв не знайдено або баланс 0, перевіряємо легкий ключ focaccia-balance
      if (!loadedSave || (!loadedSave.focaccia && !loadedSave.diamonds)) {
        try {
          const balRaw = await storage.get('focaccia-balance');
          if (balRaw) {
            const b = JSON.parse(balRaw);
            if (!loadedSave) loadedSave = {};
            if (typeof b.f === 'number') loadedSave.focaccia = b.f;
            if (typeof b.d === 'number') loadedSave.diamonds = b.d;
          }
        } catch { /* */ }
      }

      // Також запитуємо серверний баланс як надійне джерело правди
      if (meId) {
        try {
          const res = await fetch(`${API}?action=get_balance&userId=${meId}`);
          const sBal = await res.json();
          if (sBal?.ok && active) {
            if (!loadedSave) loadedSave = {};
            if (typeof sBal.focaccia === 'number') loadedSave.focaccia = Math.max(Number(loadedSave.focaccia) || 0, sBal.focaccia);
            if (typeof sBal.diamonds === 'number') loadedSave.diamonds = Math.max(Number(loadedSave.diamonds) || 0, sBal.diamonds);
          }
        } catch { /* */ }
      }

      if (loadedSave && active) {
        setUserSave(loadedSave);
      }
    };
    loadBal();
    return () => { active = false; };
  }, [meId]);

  // === Ескроу: перевірка балансу та списання ставки ===
  useEffect(() => {
    if ((stage !== 'countdown' && stage !== 'live') || escrowDone.current) return;
    const flagKey = `duel_escrow:${duelId}:${meId}`;
    if (localStorage.getItem(flagKey)) { escrowDone.current = true; return; }
    const curStake = snapRef.current?.stake || stake;
    if (!curStake) return;

    const checkAndDeduct = async () => {
      let activeSave = userSave;
      if (!activeSave) {
        try {
          const raw = window.localStorage.getItem(SAVE_KEY);
          if (raw) activeSave = JSON.parse(raw);
        } catch {}
      }
      if (!activeSave) {
        // Чекаємо завантаження сейву
        return;
      }

      const gem = (snapRef.current?.stakeCur || stakeCur) === 'gem';
      let balance = gem ? Math.floor(Number(activeSave?.diamonds) || 0) : Math.floor(Number(activeSave?.focaccia) || 0);

      // Якщо локального балансу не вистачає — перед відмовою робимо свіжий запит на сервер!
      if (balance < curStake && meId) {
        try {
          const sRes = await fetch(`${API}?action=get_balance&userId=${meId}`);
          const sData = await sRes.json();
          if (sData?.ok) {
            const sVal = gem ? Math.floor(Number(sData.diamonds) || 0) : Math.floor(Number(sData.focaccia) || 0);
            if (sVal >= curStake) {
              balance = sVal;
              if (gem) activeSave.diamonds = sVal;
              else activeSave.focaccia = sVal;
              setUserSave({ ...activeSave });
            }
          }
        } catch { /* */ }
      }

      // ПЕРЕВІРКА БАЛАНСУ: якщо у гравця дійсно недостатньо коштів на ставку!
      if (balance < curStake) {
        const sym = gem ? '💎' : '🫓';
        setInsufficientFunds(`У тебе недостатньо ${gem ? 'алмазів 💎' : 'фокач 🫓'} для ставки!\nНа балансі: ${formatNum(balance)} ${sym}, а ставка: ${formatNum(curStake)} ${sym}.`);
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'no_funds', duelId, userId: meId }),
        }).catch(() => {});
        return;
      }

      // Списання ставки з балансу
      const nextSave = { ...activeSave };
      if (gem) nextSave.diamonds = Math.max(0, (Number(nextSave.diamonds) || 0) - curStake);
      else nextSave.focaccia = Math.max(0, (Number(nextSave.focaccia) || 0) - curStake);
      nextSave.lastSave = Date.now();

      setUserSave(nextSave);
      storage.set(SAVE_KEY, JSON.stringify(nextSave));
      storage.set('focaccia-balance', JSON.stringify({ f: nextSave.focaccia || 0, d: nextSave.diamonds || 0, ts: Date.now() }));
      localStorage.setItem(flagKey, '1');
      escrowDone.current = true;
      setMyPaid(curStake);

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'escrow', duelId, userId: meId, paid: curStake }),
      }).catch(() => {});
    };

    checkAndDeduct();
  }, [stage, userSave, stake, stakeCur, duelId, meId]);

  // === Виплата банку при фініші: переможцю — весь банк, нічия — повернення ===
  useEffect(() => {
    if ((stage !== 'finished' && stage !== 'cancelled') || settled.current) return;
    const flagKey = `duel_settled:${duelId}:${meId}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, '1');
    settled.current = true;

    storage.get(SAVE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        const st = snapRef.current;
        const curStake = (st && st.stake) ? st.stake : stake;
        const curPaid = (st && st.myPaid && st.myPaid > 0) ? st.myPaid : (myPaid > 0 ? myPaid : (escrowDone.current ? curStake : 0));
        const gem = (st?.stakeCur || stakeCur) === 'gem';

        // Якщо ескроу не списувався (наприклад, неявка суперника до старту бою) — нічого не нараховуємо і не списуємо
        if (!escrowDone.current && curPaid <= 0) {
          return;
        }

        // ДУЕЛЬ СКАСОВАНО / НЕДОСТАТНЬО КОШТІВ / НЕЯВКА: ЖОДНИХ ВИПЛАТ БАНКУ!
        // Тільки повернення власної списаної ставки (якщо вона була списана).
        if (stage === 'cancelled' || reason === 'no_funds' || reason === 'no_show' || !winner || winner === 'null') {
          if (curPaid > 0) {
            if (gem) s.diamonds = (s.diamonds || 0) + curPaid;
            else s.focaccia = (s.focaccia || 0) + curPaid;
            s.lastSave = Date.now();
            storage.set(SAVE_KEY, JSON.stringify(s));
            storage.set('focaccia-balance', JSON.stringify({ f: s.focaccia || 0, d: s.diamonds || 0, ts: Date.now() }));
          }
          return;
        }

        if (winner === meId) {
          const curPot = (st && st.pot && st.pot > 0) ? st.pot : (curStake * 2);
          if (gem) s.diamonds = (s.diamonds || 0) + curPot;
          else s.focaccia = (s.focaccia || 0) + curPot;
          s.lastSave = Date.now();
          storage.set(SAVE_KEY, JSON.stringify(s));
          storage.set('focaccia-balance', JSON.stringify({ f: s.focaccia || 0, d: s.diamonds || 0, ts: Date.now() }));
        } else if (winner === 'draw') {
          if (curPaid > 0) {
            if (gem) s.diamonds = (s.diamonds || 0) + curPaid;
            else s.focaccia = (s.focaccia || 0) + curPaid;
            s.lastSave = Date.now();
            storage.set(SAVE_KEY, JSON.stringify(s));
            storage.set('focaccia-balance', JSON.stringify({ f: s.focaccia || 0, d: s.diamonds || 0, ts: Date.now() }));
          }
        }
      } catch { /* */ }
    });
  }, [stage, duelId, meId, winner, pot, stake, myPaid, stakeCur, reason]);

  useEffect(() => {
    if (stage !== 'countdown' || !startTs || introStartedFor.current === duelId) return;
    introStartedFor.current = duelId;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setIntroPhase('p1');
    timers.push(setTimeout(() => setIntroPhase('p2'), 1100));
    timers.push(setTimeout(() => setIntroPhase('vs'), 2200));
    timers.push(setTimeout(() => setIntroPhase('fade'), 3600));
    timers.push(setTimeout(() => setIntroPhase(''), 4200));
    return () => timers.forEach(clearTimeout);
  }, [stage, startTs, duelId]);

  const nowAligned = () => Date.now() + offsetRef.current;

  const handleTap = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.nativeEvent.isTrusted) return;
    if (stage !== 'live') return;

    setPending((p) => p + 1);
    pendingRef.current += 1;

    // Relative tap coordinates for floating number
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Combo streak
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setCombo((prev) => {
      const next = prev + 1;
      if (next % 10 === 0) haptic.medium();
      else haptic.light();
      return next;
    });
    comboTimerRef.current = setTimeout(() => {
      setCombo(0);
      setCps(0);
    }, 1100);

    // CPS Calculation (sliding window of 1.5s)
    const now = Date.now();
    tapTimesRef.current.push(now);
    tapTimesRef.current = tapTimesRef.current.filter((t) => now - t <= 1500);
    const curCps = Math.round((tapTimesRef.current.length / 1.5) * 10) / 10;
    setCps(curCps);

    // 3D Tilt alternation
    setTilt((prev) => (prev <= 0 ? 2 : -2));

    // Floating particle
    const popId = Date.now() + Math.random();
    const isFire = combo >= 10;
    setFloatingPops((prev) => [
      ...prev.slice(-12),
      {
        id: popId,
        x: Math.max(25, Math.min(rect.width - 25, x)),
        y: Math.max(25, Math.min(rect.height - 25, y)),
        text: isFire ? '🔥 +1' : '+1',
        color: isFire ? 'text-amber-300' : 'text-emerald-300',
      },
    ]);
    setTimeout(() => {
      setFloatingPops((prev) => prev.filter((p) => p.id !== popId));
    }, 650);

    try { navigator.vibrate?.(10); } catch {}
  };

  // ==========================================
  // 1. ПОМИЛКА / НЕДОСТАТНЬО КОШТІВ
  // ==========================================
  if (error) {
    return (
      <div className="h-[100dvh] bg-[#0d0a04] flex items-center justify-center p-6 text-center select-none safe-top safe-bottom">
        <div className="max-w-xs w-full">
          <div className="text-5xl mb-3">⚠️</div>
          <p className="text-amber-200 font-bold mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={resetToLobby}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-xs"
            >
              🔄 В лобі дуелей
            </button>
            <button
              onClick={goToGame}
              className="w-full py-2.5 bg-stone-900 border border-stone-800 text-amber-300/80 font-bold rounded-2xl active:scale-95 transition-all text-xs"
            >
              🫓 До головної гри
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (insufficientFunds) {
    return (
      <div className="h-[100dvh] bg-[#0d0a04] flex items-center justify-center p-6 select-none safe-top safe-bottom">
        <div className="text-center w-full max-w-xs">
          <div className="text-6xl mb-3">💸</div>
          <h2 className="text-xl font-black text-red-400 mb-2">Недостатньо коштів!</h2>
          <p className="text-amber-200/80 text-sm whitespace-pre-wrap mb-5">{insufficientFunds}</p>
          <button
            onClick={resetToLobby}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25 text-xs"
          >
            🔄 В лобі дуелей
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. ПРЕВ'Ю ВІДКРИТОЇ ДУЕЛІ (ДЛЯ ГРАВЦЯ 2)
  // ==========================================
  if (openPreview) {
    const sym = openPreview.stakeCur === 'gem' ? '💎' : '🫓';
    const canAfford = openPreview.stake <= (openPreview.stakeCur === 'gem' ? myDiamonds : myFocaccia);
    return (
      <div className="h-[100dvh] bg-[#0d0a04] text-amber-100 flex flex-col justify-between p-5 select-none overflow-y-auto safe-top safe-bottom">
        <div className="flex items-center justify-between">
          <button onClick={resetToLobby} className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-bold text-stone-400 flex items-center gap-1">
            <span>✕</span> <span>Лобі</span>
          </button>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-amber-300">🫓 {formatNum(myFocaccia)}</span>
            <span className="text-cyan-300">💎 {formatNum(myDiamonds)}</span>
          </div>
        </div>

        <div className="max-w-sm w-full mx-auto text-center space-y-4 my-auto py-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-4xl mx-auto shadow-xl shadow-amber-600/30">
            ⚔️
          </div>
          <div>
            <h2 className="text-2xl font-black text-amber-200">Виклик на дуель!</h2>
            <p className="text-xs text-stone-400 mt-1">
              Гравець <span className="text-amber-300 font-bold">{openPreview.creator?.name || 'Гравець'}</span> кинув відкритий виклик:
            </p>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-amber-500/25 space-y-2.5 text-left text-xs">
            <div className="flex justify-between items-center">
              <span className="text-stone-400">💰 Ставка:</span>
              <span className="font-black text-amber-300 text-sm">{formatNum(openPreview.stake)} {sym}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-400">🏆 Загальний банк:</span>
              <span className="font-black text-emerald-400 text-sm">+{formatNum(openPreview.stake * 2)} {sym}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-400">🎯 Ціль тапів:</span>
              <span className="font-bold text-stone-200">{openPreview.goal} фокач</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-400">⏱ Ліміт часу:</span>
              <span className="font-bold text-stone-200">{Math.round((openPreview.timeMs || 180000) / 60000)} хв</span>
            </div>
          </div>

          {!canAfford && (
            <div className="text-xs text-red-400 font-bold bg-red-950/40 border border-red-500/30 rounded-xl p-2.5">
              ⚠️ У тебе недостатньо {openPreview.stakeCur === 'gem' ? 'алмазів 💎' : 'фокач 🫓'} для цієї ставки!
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <button
              disabled={!canAfford || joiningOpen}
              onClick={handleJoinOpenDuel}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-stone-950 font-black rounded-2xl text-sm shadow-lg shadow-amber-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>⚔️</span>
              <span>{joiningOpen ? 'Підключення...' : 'ПРИЙНЯТИ ВИКЛИК І В БІЙ'}</span>
            </button>
            <button
              onClick={resetToLobby}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-400 font-bold rounded-2xl text-xs active:scale-95 transition-all"
            >
              Відхилити
            </button>
          </div>
        </div>

        <div className="text-center text-[10px] text-stone-500">
          TapSentinel v5 захищає дуелі від автоклікерів
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. DUEL LOBBY (РЕЖИМ НАЛАШТУВАННЯ ДУЕЛІ)
  // ==========================================
  if (!duelId || duelId === 'lobby') {
    return (
      <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto bg-[#0d0a04] text-amber-100 flex flex-col justify-between p-4 pb-16 select-none safe-top safe-bottom">
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goToGame}
              className="px-3.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-black text-amber-400 hover:text-amber-200 flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
            >
              <span>←</span>
              <span>В гру</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono">
                🫓 {formatNum(myFocaccia)}
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono">
                💎 {formatNum(myDiamonds)}
              </div>
            </div>
          </div>

          <div className="text-center mb-4">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 flex items-center justify-center gap-2">
              <span>⚔️</span> <span>Арена Дуелей</span>
            </h1>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Бийся 1 на 1 у реальному часі на фокачі або алмази!
            </p>
          </div>

          {/* Opponent Selection Mode Tabs */}
          <div className="glass-card rounded-2xl p-1 flex border border-stone-800 mb-3 text-xs font-bold">
            <button
              onClick={() => { setOppMode('active'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                oppMode === 'active' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md' : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>👥</span> <span>Гравці</span>
            </button>
            <button
              onClick={() => { setOppMode('search'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                oppMode === 'search' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md' : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>🔍</span> <span>Пошук</span>
            </button>
            <button
              onClick={() => { setOppMode('open'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                oppMode === 'open' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md' : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>🔗</span> <span>Відкрита</span>
            </button>
          </div>

          {/* Mode 1: Active Players List */}
          {oppMode === 'active' && (
            <div className="glass-card rounded-2xl p-3 border border-stone-800 mb-3">
              <div className="text-[11px] font-bold text-stone-400 mb-2 flex items-center justify-between">
                <span>Обери суперника:</span>
                {selectedOpp && (
                  <span className="text-amber-300 font-black">
                    Обрано: {selectedOpp.name}
                  </span>
                )}
              </div>

              {loadingPlayers ? (
                <div className="py-8 text-center text-xs text-stone-500">Завантаження гравців...</div>
              ) : activePlayers.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">Немає активних гравців поруч. Спробуй пошук або відкриту дуель!</div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {activePlayers.map((p) => {
                    const isSel = selectedOpp?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedOpp(p); haptic.selection(); }}
                        className={cn(
                          'w-full p-2 rounded-xl flex items-center justify-between gap-2 border transition-all text-left',
                          isSel
                            ? 'bg-amber-500/20 border-amber-400/80 shadow-sm shadow-amber-500/20'
                            : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 text-stone-300'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center text-xs font-black text-stone-950 shrink-0">
                            {initial(p.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate text-amber-100">{p.name}</div>
                            {p.username && <div className="text-[10px] text-stone-500 truncate">@{p.username}</div>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {isSel ? (
                            <span className="text-xs font-black text-amber-300 px-2 py-0.5 rounded-lg bg-amber-500/20">
                              ✓ Обрано
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-stone-500">Обрати</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Username / ID Search */}
          {oppMode === 'search' && (
            <div className="glass-card rounded-2xl p-3 border border-stone-800 mb-3 space-y-3">
              <div className="text-[11px] font-bold text-stone-400">Вкажи @username або Telegram ID:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPlayer()}
                  placeholder="@username або ID"
                  className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-amber-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={searching || !searchQuery.trim()}
                  onClick={handleSearchPlayer}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 text-stone-950 font-black rounded-xl text-xs shrink-0"
                >
                  {searching ? '...' : 'Знайти'}
                </button>
              </div>

              {searchError && (
                <div className="text-xs text-red-400 font-bold bg-red-950/40 border border-red-500/30 rounded-xl p-2">
                  ❌ {searchError}
                </div>
              )}

              {selectedOpp && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center text-xs font-black shrink-0">
                      {initial(selectedOpp.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-emerald-200 truncate">{selectedOpp.name}</div>
                      {selectedOpp.username && <div className="text-[10px] text-emerald-400/60 truncate">@{selectedOpp.username}</div>}
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-300 shrink-0">✓ Обрано</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Open Duel */}
          {oppMode === 'open' && (
            <div className="glass-card rounded-2xl p-3 border border-stone-800 mb-3 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl mx-auto">
                🔗
              </div>
              <div className="text-xs font-bold text-amber-200">Відкрита дуель за посиланням</div>
              <p className="text-[11px] text-stone-400">
                Після створення ти отримаєш посилання. Надішли його у групу або другу — перший, хто відкриє, стане твоїм суперником!
              </p>
            </div>
          )}

          {/* Section: Currency & Stake */}
          <div className="glass-card rounded-2xl p-3 border border-stone-800 mb-3 space-y-3">
            {/* Currency toggle */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-400">Валюта ставки:</span>
              <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 gap-1">
                <button
                  type="button"
                  onClick={() => { setLobbyStakeCur('foc'); setLobbyStake(1000); haptic.selection(); }}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-black transition-all',
                    lobbyStakeCur === 'foc' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                  )}
                >
                  🫓 Фокачі
                </button>
                <button
                  type="button"
                  onClick={() => { setLobbyStakeCur('gem'); setLobbyStake(5); haptic.selection(); }}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-black transition-all',
                    lobbyStakeCur === 'gem' ? 'bg-cyan-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                  )}
                >
                  💎 Алмази
                </button>
              </div>
            </div>

            {/* Percentage Chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {[0.1, 0.25, 0.5, 1].map((pct) => {
                const label = pct === 1 ? 'MAX' : `${Math.round(pct * 100)}%`;
                const calculated = Math.max(1, Math.floor(currentBalance * pct));
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => { setLobbyStake(calculated); haptic.light(); }}
                    className={cn(
                      'py-1 rounded-lg text-xs font-black border transition-all cursor-pointer active:scale-95',
                      lobbyStake === calculated
                        ? (lobbyStakeCur === 'gem' ? 'bg-cyan-500 text-stone-950 border-cyan-400' : 'bg-amber-500 text-stone-950 border-amber-400')
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Quick Increment Stake Chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {lobbyStakeCur === 'foc' ? (
                [1000, 10000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setLobbyStake((prev) => Math.min(myFocaccia, prev + amt)); haptic.light(); }}
                    className="py-1 rounded-lg text-[10px] font-black border bg-stone-950 border-stone-800 text-amber-300 hover:border-amber-500/40 active:scale-95 transition-all cursor-pointer"
                  >
                    +{formatNum(amt)}
                  </button>
                ))
              ) : (
                [1, 5, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setLobbyStake((prev) => Math.min(myDiamonds, prev + amt)); haptic.light(); }}
                    className="py-1 rounded-lg text-[10px] font-black border bg-stone-950 border-stone-800 text-cyan-300 hover:border-cyan-500/40 active:scale-95 transition-all cursor-pointer"
                  >
                    +{amt}💎
                  </button>
                ))
              )}
            </div>

            {/* Stake Input */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 mb-1">
                <span>Ставка:</span>
                <span>На балансі: {formatNum(currentBalance)} {lobbyStakeCur === 'gem' ? '💎' : '🫓'}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={lobbyStake || ''}
                  onChange={(e) => setLobbyStake(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-sm font-mono font-black text-amber-200 focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-3 top-2.5 text-sm">
                  {lobbyStakeCur === 'gem' ? '💎' : '🫓'}
                </span>
              </div>
              {lobbyStake > currentBalance && (
                <div className="text-[11px] text-red-400 font-bold mt-1">
                  ⚠️ Ставка перевищує твій баланс!
                </div>
              )}
            </div>
          </div>

          {/* Section: Goal & Round Time */}
          <div className="glass-card rounded-2xl p-3 border border-stone-800 mb-4 space-y-3">
            <div>
              <div className="text-[11px] font-bold text-stone-400 mb-1.5">🎯 Ціль (хто швидше наклікає):</div>
              <div className="grid grid-cols-5 gap-1.5">
                {[50, 100, 250, 500, 1000].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setLobbyGoal(g); haptic.selection(); }}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-black border transition-all',
                      lobbyGoal === g ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm' : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-stone-400 mb-1.5">⏱ Тривалість раунду:</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  [60000, '1 хв'],
                  [120000, '2 хв'],
                  [180000, '3 хв'],
                  [300000, '5 хв'],
                ].map(([ms, lbl]) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => { setLobbyTimeMs(Number(ms)); haptic.selection(); }}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-black border transition-all',
                      lobbyTimeMs === ms ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm' : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA Create Button */}
        <div className="pt-3 pb-6">
          <button
            type="button"
            disabled={creatingDuel || (oppMode !== 'open' && !selectedOpp) || lobbyStake > currentBalance}
            onClick={handleCreateDuel}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-stone-950 font-black rounded-2xl text-sm shadow-xl shadow-amber-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>⚔️</span>
            <span>
              {creatingDuel
                ? 'Створення...'
                : oppMode === 'open'
                ? 'СТВОРИТИ ВІДКРИТУ ДУЕЛЬ'
                : `ВИКЛИКАТИ ${selectedOpp?.name ? selectedOpp.name.toUpperCase() : 'СУПЕРНИКА'}`}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 4. ОЧІКУВАННЯ ПРИЙНЯТТЯ / ПІДКЛЮЧЕННЯ (CHALLENGE / ACCEPTED)
  // ==========================================
  if (stage === 'challenge' || stage === 'accepted') {
    return (
      <div className="h-[100dvh] bg-[#0d0a04] flex items-center justify-center p-6 text-center select-none safe-top safe-bottom">
        <div className="max-w-xs w-full space-y-4">
          <div className="text-6xl animate-bob">⏳</div>

          <div>
            <h2 className="text-xl font-black text-amber-200 mb-1">
              {isOpenRoom
                ? 'Відкрита дуель створена!'
                : isCreator
                ? 'Виклик надіслано!'
                : 'Виклик прийнято!'}
            </h2>
            <p className="text-xs text-stone-400">
              {isOpenRoom
                ? 'Поділися посиланням нижче. Перший гравець, який увійде, розпочне бій!'
                : isCreator
                ? `Очікуємо підключення ${oppName || 'суперника'}...`
                : `Підключення до бою з ${oppName || 'суперником'}...`}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-3 border border-amber-500/20 text-xs text-left space-y-1.5 font-bold">
            <div className="flex justify-between">
              <span className="text-stone-400">Ставка:</span>
              <span className="text-amber-300 font-mono">{formatNum(stake || lobbyStake)} {stakeCur === 'gem' ? '💎' : '🫓'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Ціль:</span>
              <span className="text-stone-200">{goal || lobbyGoal} тапів</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Раунд:</span>
              <span className="text-stone-200">{Math.round((limit || lobbyTimeMs) / 60000)} хв</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={shareDuelLink}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 active:scale-95 transition-all cursor-pointer"
            >
              <span>📤</span>
              <span>Поділитися в Telegram</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyDuelLink}
                className="py-2.5 px-2 bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-amber-300 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <span>📋</span>
                <span>{copiedLink ? 'Скопійовано!' : 'Бот-лінк'}</span>
              </button>

              <button
                type="button"
                onClick={copyDirectWebLink}
                className="py-2.5 px-2 bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-cyan-300 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <span>🌐</span>
                <span>{copiedDirectLink ? 'Скопійовано!' : 'Веб-лінк'}</span>
              </button>
            </div>

            {/* Room Code */}
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-stone-500">
              <span>Код дуелі:</span>
              <button
                type="button"
                onClick={copyDuelCode}
                className="font-mono text-amber-300 font-black px-2 py-0.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-amber-500/40 cursor-pointer"
                title="Натисни, щоб скопіювати код"
              >
                {copiedCode ? 'Скопійовано!' : duelId}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleCancelDuel}
              className="w-full py-2.5 bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 font-bold rounded-2xl text-xs active:scale-95 transition-all"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 5. ДУЕЛЬ СКАСОВАНО
  // ==========================================
  if (stage === 'cancelled') {
    const isNoFunds = reason === 'no_funds';
    const curPaid = myPaid > 0 ? myPaid : (escrowDone.current ? stake : 0);
    return (
      <div className="h-[100dvh] bg-[#0d0a04] flex items-center justify-center p-6 select-none safe-top safe-bottom">
        <div className="text-center w-full max-w-xs">
          <div className="text-7xl mb-3">{isNoFunds ? '💸' : '❌'}</div>
          <h2 className="text-2xl font-black text-amber-200 mb-2">
            {isNoFunds ? 'НЕДОСТАТНЬО КОШТІВ' : 'ДУЕЛЬ СКАСОВАНО'}
          </h2>
          <p className="text-amber-300/80 text-sm mb-4">
            {isNoFunds
              ? 'У одного з гравців недостатньо коштів для ставки. Дуель скасовано, кошти не списано.'
              : reason === 'timeout'
              ? 'Час очікування вичерпано.'
              : reason === 'no_show'
              ? 'Суперник не з\'явився у дуелі. Виклик скасовано.'
              : 'Дуель було скасовано.'}
          </p>
          {curPaid > 0 && (
            <div className="glass-card rounded-2xl p-3 mb-4 text-emerald-300 text-xs font-bold">
              ✅ Твою ставку {formatNum(curPaid)} {stakeCur === 'gem' ? '💎' : '🫓'} повернуто на баланс
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={resetToLobby}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25 text-xs"
            >
              🔄 В лобі дуелей
            </button>
            <button
              onClick={goToGame}
              className="w-full py-2.5 bg-stone-900 border border-stone-800 text-stone-400 font-bold rounded-2xl text-xs active:scale-95"
            >
              🫓 До головної гри
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 6. ФІНАЛ МАТЧУ (ПЕРЕМОГА / ПОРАЗКА / НІЧИЯ)
  // ==========================================
  if (stage === 'finished') {
    const iWin = winner === meId;
    const draw = winner === 'draw';
    const reasonText =
      reason === 'cheat' ? (iWin ? '⚠️ Суперник використав стороннє ПЗ' : '🚫 Виявлено стороннє ПЗ') :
      reason === 'forfeit' ? '🏃 Суперник покинув дуель' :
      reason === 'time' ? '⏱ Час вийшов' :
      `⚡ Хто швидше — ${goal} фокач!`;
    return (
      <div className="h-[100dvh] bg-[#0d0a04] flex items-center justify-center p-6 select-none safe-top safe-bottom">
        <div className="text-center w-full max-w-xs">
          <div className="text-7xl mb-3">{draw ? '🤝' : iWin ? '🏆' : '💔'}</div>
          <h1 className={cn('text-3xl font-black mb-2', draw ? 'text-amber-200' : iWin ? 'text-emerald-300' : 'text-red-300')}>
            {draw ? 'НІЧИЯ' : iWin ? 'ПЕРЕМОГА!' : 'ПОРАЗКА'}
          </h1>
          <p className="text-amber-300/70 text-sm mb-4">{reasonText}</p>
          {!draw && (reason === '100' || reason === 'goal') && <p className="text-amber-200/70 text-xs mb-2">Хто першим наклікав {goal} фокач</p>}
          {iWin && (
            <div className="mb-4">
              <p className="text-emerald-300 font-black text-lg">
                🏆 Твій виграш: +{formatNum(pot > 0 ? pot : stake * 2)} {stakeCur === 'gem' ? '💎' : '🫓'}!
              </p>
              <p className="text-amber-300/80 text-xs mt-1">
                🎁 Бонус за перемогу: +5 💎
              </p>
            </div>
          )}
          {draw && (
            <div className="mb-4">
              <p className="text-amber-200 font-bold text-sm">
                🤝 Ставка {formatNum(myPaid > 0 ? myPaid : stake)} {stakeCur === 'gem' ? '💎' : '🫓'} повернена
              </p>
              <p className="text-amber-300/80 text-xs mt-1">
                🎁 Бонус за нічию: +2 💎
              </p>
            </div>
          )}
          {!iWin && !draw && (
            <div className="mb-4">
              <p className="text-red-400 font-bold text-sm">
                💔 Поразка! Втрачено: −{formatNum(myPaid > 0 ? myPaid : stake)} {stakeCur === 'gem' ? '💎' : '🫓'}
              </p>
            </div>
          )}
          <div className="glass-card rounded-2xl p-3 mb-5 flex justify-between text-sm font-black">
            <span className="text-amber-200">{myName || 'Ти'}: {displayScore}</span>
            <span className="text-amber-400/70">{oppName}: {oppScore}</span>
          </div>
          <div className="space-y-2">
            <button
              onClick={resetToLobby}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25 text-xs"
            >
              🔄 В лобі дуелей
            </button>
            <button
              onClick={goToGame}
              className="w-full py-2.5 bg-stone-900 border border-stone-800 text-stone-400 font-bold rounded-2xl text-xs active:scale-95"
            >
              🫓 До головної гри
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 7. ПАУЗА (СУПЕРНИК ВИЙШОВ)
  // ==========================================
  if (stage === 'paused') {
    return (
      <div className="h-[100dvh] bg-[#0d0a04] flex items-center justify-center p-6 select-none safe-top safe-bottom">
        <div className="text-center">
          <div className="text-6xl mb-3 animate-bob">⏸</div>
          <h2 className="text-xl font-black text-amber-100 mb-2">Суперник вийшов!</h2>
          <p className="text-amber-300/60 text-sm mb-4">Якщо він не повернеться — перемога технічним нокаутом</p>
          <div className="text-5xl font-black text-red-300 tabular-nums">{Math.ceil(pausedLeft / 1000)}</div>
        </div>
      </div>
    );
  }

  // ===== ОСНОВНИЙ ЕКРАН: ВІДЛІК + БІЙ =====
  const liveNow = stage === 'live';
  const msToStart = stage === 'countdown' && startTs ? Math.max(0, startTs - nowAligned()) : 0;
  const countdownN = Math.ceil(msToStart / 1000);
  const elapsed = startTs && (stage === 'live' || stage === 'paused') ? Math.max(0, nowAligned() - startTs) : 0;

  const myPct = Math.min(100, Math.round((displayScore / Math.max(1, goal)) * 100));
  const oppPct = Math.min(100, Math.round((oppScore / Math.max(1, goal)) * 100));
  const scoreDiff = displayScore - oppScore;
  const isDanger = oppScore >= goal * 0.85 && oppScore > displayScore;

  return (
    <div className="h-[100dvh] bg-[#0d0a04] text-amber-50 select-none overflow-hidden flex flex-col justify-between safe-top safe-bottom">
      {/* 1. TOP BAR: TIMER + STAKES + FORFEIT */}
      <div className="shrink-0 glass border-b border-amber-500/20 px-3 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={async () => {
            if (stage === 'live' || stage === 'countdown' || stage === 'paused') {
              if (!confirm('Ти точно хочеш здатися у цій дуелі? Твоя ставка згорить!')) return;
              await handleForfeitDuel();
            } else {
              await handleCancelDuel();
            }
          }}
          className="px-2.5 py-1 rounded-xl bg-stone-900 border border-stone-800 text-[11px] font-black text-amber-400 hover:text-amber-200 active:scale-95 transition-all cursor-pointer"
        >
          {stage === 'live' || stage === 'countdown' || stage === 'paused' ? '🏳️ Здатися' : '← Лобі'}
        </button>

        {/* Pot badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/15 to-amber-500/10 border border-amber-500/30">
          <span className="text-xs">🏆</span>
          <span className="text-xs font-black text-amber-200 font-mono">
            {formatNum(pot > 0 ? pot : stake * 2)} {stakeCur === 'gem' ? '💎' : '🫓'}
          </span>
        </div>

        {/* Time Remaining */}
        <div className={cn(
          "px-2.5 py-1 rounded-xl border text-xs font-mono font-black tabular-nums transition-colors",
          elapsed > limit * 0.8
            ? "bg-rose-950/80 border-rose-500/50 text-rose-300 animate-pulse"
            : "bg-stone-900 border-stone-800 text-stone-300"
        )}>
          ⏱ {fmt(Math.max(0, limit - elapsed))}
        </div>
      </div>

      {/* 2. TUG-OF-WAR LIVE RACE METER (у режимі бою) */}
      {liveNow && (
        <div className="shrink-0 bg-stone-950/90 border-b border-stone-800/80 px-3.5 py-2.5 space-y-2 shadow-md">
          {/* Opponents and live gap indicator */}
          <div className="flex items-center justify-between text-xs font-black">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-emerald-300 truncate max-w-[85px]">{myName || 'Ти'}</span>
              <span className="text-emerald-400 font-mono text-sm tabular-nums">({displayScore})</span>
            </div>

            {/* Dynamic Lead Indicator */}
            <div className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-black">
              {scoreDiff > 0 ? (
                <span className="text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 rounded-full animate-duel-lead inline-block shadow-sm">
                  🔥 +{scoreDiff} ТИ ВЕДЕШ!
                </span>
              ) : scoreDiff < 0 ? (
                <span className="text-rose-300 bg-rose-950/90 border border-rose-500/40 px-2 py-0.5 rounded-full animate-pulse inline-block shadow-sm">
                  ⚠️ {scoreDiff} СУПЕРНИК ВЕДЕ!
                </span>
              ) : (
                <span className="text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full inline-block">
                  ⚔️ НІЧИЯ ({displayScore}:{oppScore})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 min-w-0 justify-end">
              <span className="text-sky-300 font-mono text-sm tabular-nums">({oppScore})</span>
              <span className="text-sky-300 truncate max-w-[85px]">{oppName}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
            </div>
          </div>

          {/* Dual Progress Bar */}
          <div className="relative h-4 bg-stone-900 rounded-full overflow-hidden border border-stone-800 flex items-center p-0.5">
            {/* My Progress (Left -> Center) */}
            <div
              className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 rounded-l-full transition-all duration-150 relative shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{ width: `${myPct / 2}%` }}
            />

            {/* Center Goal Flag */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
              <span className="text-[10px] leading-none drop-shadow">🏁</span>
            </div>

            {/* Opponent Progress (Right -> Center) */}
            <div className="flex-1 flex justify-end">
              <div
                className="h-full bg-gradient-to-l from-rose-600 via-rose-400 to-amber-400 rounded-r-full transition-all duration-150 relative shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                style={{ width: `${oppPct / 2}%` }}
              />
            </div>
          </div>

          {/* Goal and percentages hint */}
          <div className="flex justify-between text-[10px] text-stone-500 font-mono font-bold">
            <span className="text-emerald-400/80">{myPct}% до цілі</span>
            <span className="text-amber-300/90">🎯 Ціль: {goal} тапів</span>
            <span className="text-sky-400/80">{oppPct}% до цілі</span>
          </div>
        </div>
      )}

      {/* Интро VS: фазовая машина — аватар 1 → аватар 2 → VS → затухание. Абсолютные позиции — ноль дёрганий */}
      {stage === 'countdown' && introPhase !== '' && (
        <div
          className="flex-1 relative"
          style={introPhase === 'fade' ? { animation: 'duel-fade-all 0.6s ease forwards' } : undefined}
        >
          {/* твой аватар — левый центр */}
          <div className="absolute" style={{ left: '22%', top: '46%', transform: 'translate(-50%, -50%)' }}>
            <div style={{ animation: introPhase === 'p1' ? 'duel-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both' : undefined }}>
              <Avatar src={myPhoto} name={myName || 'Ти'} u={myU} side="left" />
            </div>
          </div>

          {/* VS — центр */}
          {(introPhase === 'vs' || introPhase === 'fade') && (
            <div className="absolute z-10" style={{ left: '50%', top: '46%', transform: 'translate(-50%, -50%)' }}>
              <div
                className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-orange-500 drop-shadow-[0_0_22px_rgba(251,146,60,0.9)]"
                style={{ animation: 'duel-vs-pop 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) both' }}
              >
                VS
              </div>
            </div>
          )}

          {/* аватар соперника — правый центр */}
          {(introPhase === 'p2' || introPhase === 'vs' || introPhase === 'fade') && (
            <div className="absolute" style={{ left: '78%', top: '46%', transform: 'translate(-50%, -50%)' }}>
              <div style={{ animation: introPhase === 'p2' ? 'duel-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both' : undefined }}>
                <Avatar name={oppName || 'Соперник'} u={oppU} side="right" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Отсчёт */}
      {stage === 'countdown' && introPhase === '' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div key={countdownN} className="text-8xl font-black text-amber-300" style={{ animation: 'num-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
              {countdownN > 0 ? countdownN : '🔥'}
            </div>
            <p className="text-amber-400/70 text-xs mt-3 font-bold">Хто першим наклікає {goal} фокач!</p>
          </div>
        </div>
      )}

      {/* 3. BATTLE ARENA (Жвавий клікер) */}
      {liveNow && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
          {/* Danger Alert if opponent is close to goal */}
          {isDanger && (
            <div className="absolute top-2 z-20 px-3.5 py-1.5 rounded-full bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-black shadow-lg shadow-rose-950/60 animate-bounce flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Суперник на {oppScore}/{goal}! Тисни швидше!</span>
            </div>
          )}

          {/* Combo & CPS HUD */}
          <div className="mb-3 text-center min-h-[44px] flex flex-col items-center justify-center">
            {combo >= 3 ? (
              <div className={cn(
                "px-3.5 py-1 rounded-full text-xs font-black shadow-lg transition-all animate-scale-pop flex items-center gap-2",
                combo >= 15
                  ? "bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 text-stone-950 shadow-orange-500/40"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              )}>
                <span>{combo >= 15 ? '🔥 НА ПІКУ' : '⚡ COMBO'}</span>
                <span className="font-mono text-sm">x{combo}</span>
                {cps > 0 && <span className="text-[10px] opacity-80">({cps} тап/с)</span>}
              </div>
            ) : (
              <div className="text-xs font-bold text-stone-500">
                Тапай якнайшвидше — сервер фіксує темп!
              </div>
            )}
          </div>

          {/* Interactive Loaf Clicker Button with 3D Physics */}
          <div className="relative flex items-center justify-center">
            {/* Pulsing Aura on fire */}
            <div className={cn(
              "absolute -inset-4 rounded-full transition-opacity duration-300 pointer-events-none",
              combo >= 10 ? "opacity-100 animate-duel-fire" : "opacity-0"
            )} />

            {/* Floating popups */}
            {floatingPops.map((pop) => (
              <div
                key={pop.id}
                className={cn("absolute text-xl font-black font-mono animate-duel-pop z-30 drop-shadow-md select-none pointer-events-none", pop.color)}
                style={{ left: `${pop.x}px`, top: `${pop.y}px` }}
              >
                {pop.text}
              </div>
            ))}

            <button
              type="button"
              onPointerDown={handleTap}
              style={{
                transform: `rotate(${tilt}deg)`,
                touchAction: 'manipulation',
              }}
              className="w-56 h-56 rounded-full bg-gradient-to-b from-amber-500 via-orange-500 to-amber-700 border-[6px] border-yellow-300 shadow-[0_0_55px_rgba(245,158,11,0.45)] active:scale-[0.88] transition-transform duration-75 flex flex-col items-center justify-center cursor-pointer select-none group relative overflow-hidden"
            >
              {/* Inner highlight */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-60 pointer-events-none" />

              <span className="text-7xl group-active:scale-95 transition-transform duration-75 drop-shadow-lg leading-none select-none">
                🫓
              </span>

              <span className="text-[11px] font-black text-amber-950 mt-2 uppercase tracking-wider bg-yellow-300/90 px-3 py-0.5 rounded-full shadow-sm">
                ТИСНИ!
              </span>
            </button>

            {/* Pending buffer badge */}
            {pending > 0 && (
              <div className="absolute -right-2 -top-2 bg-emerald-500 text-stone-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-lg border border-emerald-300 animate-bounce">
                +{pending}
              </div>
            )}
          </div>

          {/* Big Score counter */}
          <div className="mt-5 text-center">
            <div className="text-3xl font-black tabular-nums text-amber-200">
              {displayScore} <span className="text-base text-stone-500 font-normal">/ {goal}</span>
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5 font-bold">
              {goal - displayScore > 0 ? `Залишилось ${goal - displayScore} тапів до перемоги` : '🔥 МЕТА ДОСЯГНУТА! Очікуємо фінішу...'}
            </div>
          </div>
        </div>
      )}

      {/* Очікування/countdown низ */}
      <div className="shrink-0 px-4 pb-3 text-center text-[10px] text-amber-500/40 font-semibold">
        TapSentinel v5 захищає дуель від автоклікерів
      </div>
    </div>
  );
}
