import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../game/data';
import { SKINS, RARITY_LABELS } from '../game/skins';
import { getCatSkin } from '../game/cat';
import { cn } from '../utils/cn';

const API = 'https://focaccia-bot.vercel.app/api/trade';
const BOT_USERNAME = 'focacciaclicker_bot';
const SAVE_KEY = 'focaccia-clicker-v1';

const tg = typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp : undefined;

const haptic = {
  light: () => { try { tg?.HapticFeedback?.impactOccurred('light'); } catch {} },
  medium: () => { try { tg?.HapticFeedback?.impactOccurred('medium'); } catch {} },
  heavy: () => {
    try { tg?.HapticFeedback?.impactOccurred('heavy'); } catch {}
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80); } catch {}
  },
  success: () => { try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {} },
  warning: () => { try { tg?.HapticFeedback?.notificationOccurred('warning'); } catch {} },
  error: () => { try { tg?.HapticFeedback?.notificationOccurred('error'); } catch {} },
  selection: () => { try { tg?.HapticFeedback?.selectionChanged(); } catch {} },
};

const storage = {
  async get(key: string): Promise<string | null> {
    const getLocal = (): string | null => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    };
    const localVal = getLocal();

    let cloudVal: string | null = null;
    const cs = tg?.CloudStorage;
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
      if (tg?.CloudStorage) tg.CloudStorage.setItem(key, value, () => {});
    } catch { /* */ }
  },
};

interface ActivePlayer {
  id: string;
  name: string;
  username?: string;
  score?: number;
}

interface Offer {
  focaccia: number;
  diamonds: number;
  skins: string[];
}

interface TradePlayer {
  id: string;
  name: string;
  u?: string;
  offer: Offer;
  locked: boolean;
  confirmed: boolean;
  online?: boolean;
}

interface TradeState {
  ok?: boolean;
  error?: string;
  stage: 'active' | 'completed' | 'cancelled';
  completedAt?: number | null;
  cancelledReason?: string | null;
  serverNow?: number;
  me?: TradePlayer;
  opp?: TradePlayer | null;
}

export default function TradeApp({ tradeId: initialTradeId }: { tradeId: string }) {
  const isLobbyProp = !initialTradeId || initialTradeId === 'lobby' || initialTradeId === 'new';
  const [activeTradeId, setActiveTradeId] = useState<string>(isLobbyProp ? '' : initialTradeId);

  // Надійне визначення User ID (без race condition)
  const [meId, setMeId] = useState<string>(() => {
    try {
      const w = typeof window !== 'undefined' ? (window as any) : null;
      const tgApp = w?.Telegram?.WebApp;
      if (tgApp?.initDataUnsafe?.user?.id) return String(tgApp.initDataUnsafe.user.id);
      if (tgApp?.initData) {
        const p = new URLSearchParams(tgApp.initData);
        const uStr = p.get('user');
        if (uStr) {
          const uObj = JSON.parse(uStr);
          if (uObj?.id) return String(uObj.id);
        }
      }
    } catch {}
    try {
      const p = new URLSearchParams(window.location.search);
      const urlUid = p.get('userId') || p.get('uid');
      if (urlUid) return urlUid;
    } catch {}
    try {
      const stored = localStorage.getItem('focaccia_user_id');
      if (stored) return stored;
    } catch {}
    const newId = String(Math.floor(1000000000 + Math.random() * 9000000000));
    try { localStorage.setItem('focaccia_user_id', newId); } catch {}
    return newId;
  });

  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const isRealTg = Boolean(tg?.initDataUnsafe?.user?.id);
  const myName = String(tg?.initDataUnsafe?.user?.first_name || 'Гравець');
  const myU = String(tg?.initDataUnsafe?.user?.username || '');

  // Локальний інвентар
  const [myFocaccia, setMyFocaccia] = useState(0);
  const [myDiamonds, setMyDiamonds] = useState(0);
  const [myOwnedSkins, setMyOwnedSkins] = useState<string[]>([]);
  const [myOwnedCatSkins, setMyOwnedCatSkins] = useState<string[]>([]);

  // ===== Стейт ЛОБІ =====
  const [lobbyTab, setLobbyTab] = useState<'active' | 'search' | 'open' | 'code'>('active');
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerFilter, setPlayerFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchFound, setSearchFound] = useState<ActivePlayer | null>(null);
  const [searchError, setSearchError] = useState('');
  const [creatingTrade, setCreatingTrade] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // ===== Стейт КІМНАТИ ТРЕЙДУ =====
  const [trade, setTrade] = useState<TradeState | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Поточна пропозиція у кімнаті
  const [focOffer, setFocOffer] = useState(0);
  const [diaOffer, setDiaOffer] = useState(0);
  const [selectedSkins, setSelectedSkins] = useState<string[]>([]);

  // Модалки та UI
  const [skinModalOpen, setSkinModalOpen] = useState(false);
  const [skinTab, setSkinTab] = useState<'bread' | 'cat'>('bread');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTimer, setConfirmTimer] = useState(3);
  const [scamAlert, setScamAlert] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCompletedSettled, setIsCompletedSettled] = useState(false);

  const prevOppOfferRef = useRef<Offer | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  // Оновлення meId якщо Telegram передав initData пізніше
  useEffect(() => {
    if (tg?.initDataUnsafe?.user?.id) {
      const tgId = String(tg.initDataUnsafe.user.id);
      setMeId(tgId);
      try { localStorage.setItem('focaccia_user_id', tgId); } catch {}
    }
  }, []);

  // Завантаження інвентарю з SaveState
  useEffect(() => {
    let active = true;
    const loadInventory = async () => {
      let loadedSave: any = null;
      try {
        const raw = await storage.get(SAVE_KEY);
        if (raw) loadedSave = JSON.parse(raw);
      } catch { /* */ }

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
        setMyFocaccia(Math.floor(Number(loadedSave.focaccia) || 0));
        setMyDiamonds(Math.floor(Number(loadedSave.diamonds) || 0));
        const breadSkins = Array.isArray(loadedSave.skins?.owned) ? loadedSave.skins.owned : ['skin_classic'];
        setMyOwnedSkins(breadSkins);
        const catSkins = Array.isArray(loadedSave.cat?.ownedSkins) ? loadedSave.cat.ownedSkins : ['murchik'];
        setMyOwnedCatSkins(catSkins);
      }
    };

    loadInventory();
    return () => { active = false; };
  }, [meId]);

  // Завантаження списку активних гравців для Лобі
  useEffect(() => {
    if (activeTradeId) return;
    let active = true;
    setLoadingPlayers(true);

    fetch(`${API}?action=get_active_players&userId=${meId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data?.ok && Array.isArray(data.players)) {
          setActivePlayers(data.players);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPlayers(false);
      });

    return () => { active = false; };
  }, [activeTradeId, meId]);

  // Створення трейду з обраним гравцем або відкритого
  const handleCreateTrade = async (targetUserId: string | null = null) => {
    if (creatingTrade) return;
    setCreatingTrade(true);
    haptic.medium();

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          from: meId,
          fromName: myName,
          fromU: myU,
          to: targetUserId,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.tradeId) {
        haptic.success();
        setActiveTradeId(data.tradeId);
        window.history.replaceState(null, '', window.location.pathname + '?v=' + Date.now() + '&trade=' + data.tradeId);
      } else {
        haptic.error();
        alert(`Помилка створення трейду: ${data?.error || 'невідома помилка'}`);
      }
    } catch {
      haptic.error();
      alert('Не вдалося зв’язатися із сервером');
    } finally {
      setCreatingTrade(false);
    }
  };

  // Пошук гравця за @юзернеймом
  const handleSearchPlayer = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchFound(null);
    haptic.light();

    try {
      const res = await fetch(`${API}?action=find_player&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data?.ok && data.player) {
        setSearchFound(data.player);
        haptic.success();
      } else {
        setSearchError('Гравця з таким юзернеймом або ID не знайдено');
        haptic.error();
      }
    } catch {
      setSearchError('Помилка пошуку');
      haptic.error();
    } finally {
      setSearching(false);
    }
  };

  // Вхід до кімнати за кодом або посиланням
  const handleJoinByCode = () => {
    const raw = joinCodeInput.trim();
    if (!raw) return;
    let target = raw;
    const match = raw.match(/tr_[a-zA-Z0-9_-]+/);
    if (match) target = match[0];
    else if (raw.includes('trade=')) {
      const p = new URL(raw.startsWith('http') ? raw : 'https://dummy.com/' + raw).searchParams.get('trade');
      if (p) target = p;
    }
    haptic.medium();
    setActiveTradeId(target);
    window.history.replaceState(null, '', window.location.pathname + '?v=' + Date.now() + '&trade=' + target);
  };

  // Polling синхронізації кімнати (кожні 800мс)
  useEffect(() => {
    if (!activeTradeId || !meId) return;

    let iv: ReturnType<typeof setInterval> | undefined;

    const syncTick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const payload: any = {
          action: 'sync',
          tradeId: activeTradeId,
          userId: meId,
          name: myName,
          u: myU,
          clientBalance: { f: myFocaccia, d: myDiamonds },
        };

        if (!trade?.me?.locked) {
          payload.offer = {
            focaccia: focOffer,
            diamonds: diaOffer,
            skins: selectedSkins,
          };
        }

        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data: TradeState = await res.json();

        if (data.ok === false && data.error) {
          setRoomError(
            data.error === 'not_found'
              ? 'Трейд не знайдено або термін його дії закінчився'
              : data.error === 'not_a_participant'
              ? 'У цій кімнаті вже є 2 учасники'
              : `Помилка: ${data.error}`
          );
          setRoomLoading(false);
          return;
        }

        // Анти-скам: сповіщення при зміні пропозиції партнером
        if (data.opp?.offer && prevOppOfferRef.current) {
          const p = prevOppOfferRef.current;
          const cur = data.opp.offer;
          const focChanged = p.focaccia !== cur.focaccia;
          const diaChanged = p.diamonds !== cur.diamonds;
          const skinsChanged = JSON.stringify(p.skins.slice().sort()) !== JSON.stringify(cur.skins.slice().sort());

          if (focChanged || diaChanged || skinsChanged) {
            haptic.warning();
            setScamAlert('⚠️ Партнер змінив пропозицію! Перевір перед фіксацією.');
            setTimeout(() => setScamAlert(null), 5000);
          }
        }
        if (data.opp?.offer) {
          prevOppOfferRef.current = { ...data.opp.offer };
        }

        setTrade(data);
        setRoomLoading(false);

        if (data.stage !== 'active' && iv) {
          clearInterval(iv);
        }
      } catch {
        /* network glitch */
      } finally {
        inFlightRef.current = false;
      }
    };

    syncTick();
    iv = setInterval(syncTick, 850);
    return () => { if (iv) clearInterval(iv); };
  }, [activeTradeId, meId, focOffer, diaOffer, selectedSkins, trade?.me?.locked, myFocaccia, myDiamonds]);

  // Таймер підтвердження
  useEffect(() => {
    if (!confirmModalOpen) {
      setConfirmTimer(3);
      return;
    }
    const timer = setInterval(() => {
      setConfirmTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [confirmModalOpen]);

  // Фіксація або розблокування (Lock)
  const handleToggleLock = async () => {
    if (!trade || trade.stage !== 'active') return;
    const wantLock = !trade.me?.locked;
    haptic.medium();

    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lock',
          tradeId: activeTradeId,
          userId: meId,
          locked: wantLock,
        }),
      });
      setTrade((prev) => prev && prev.me ? {
        ...prev,
        me: { ...prev.me, locked: wantLock, confirmed: wantLock ? prev.me.confirmed : false },
      } : prev);
    } catch {
      haptic.error();
    }
  };

  // Фінальне підтвердження обміну (Confirm)
  const handleFinalConfirm = async () => {
    if (!trade || trade.stage !== 'active' || confirmTimer > 0) return;
    haptic.heavy();
    setConfirmModalOpen(false);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          tradeId: activeTradeId,
          userId: meId,
          clientBalance: { f: myFocaccia, d: myDiamonds },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        haptic.success();
        setTrade((prev) => prev && prev.me ? {
          ...prev,
          stage: data.stage || prev.stage,
          me: { ...prev.me, confirmed: true },
        } : prev);
      } else {
        haptic.error();
        alert(data.error === 'insufficient_funds_p1' || data.error === 'insufficient_funds_p2'
          ? 'Помилка: на балансі одного з гравців недостатньо коштів для трейду!'
          : `Помилка: ${data.error}`);
      }
    } catch {
      haptic.error();
    }
  };

  // Скасування трейду
  const handleCancelTrade = async () => {
    if (!confirm('Ти впевнений, що хочеш вийти та скасувати цей трейд?')) return;
    haptic.medium();
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', tradeId: activeTradeId, userId: meId, reason: 'Скасовано гравцем' }),
      });
    } catch { /* */ }
    returnToLobby();
  };

  // Збереження результатів після успішного завершення
  useEffect(() => {
    if (trade?.stage !== 'completed' || isCompletedSettled) return;
    setIsCompletedSettled(true);
    haptic.success();

    const settleSave = async () => {
      try {
        let s: any = null;
        const raw = await storage.get(SAVE_KEY);
        if (raw) s = JSON.parse(raw);
        if (!s) s = { focaccia: 0, total: 0, diamonds: 0, skins: { owned: ['skin_classic'], equipped: 'skin_classic' } };

        const myGive = trade.me?.offer || { focaccia: 0, diamonds: 0, skins: [] };
        const myReceive = trade.opp?.offer || { focaccia: 0, diamonds: 0, skins: [] };

        const newFoc = Math.max(0, (Number(s.focaccia) || 0) - myGive.focaccia + myReceive.focaccia);
        const newTotal = Math.max(0, (Number(s.total) || 0) + myReceive.focaccia);
        const newDia = Math.max(0, (Number(s.diamonds) || 0) - myGive.diamonds + myReceive.diamonds);

        s.focaccia = newFoc;
        s.total = newTotal;
        s.diamonds = newDia;

        // Скіни хліба
        let currentSkins: string[] = Array.isArray(s.skins?.owned) ? s.skins.owned : ['skin_classic'];
        const givenBreadSkins = myGive.skins.filter((sk) => !sk.startsWith('cat:'));
        currentSkins = currentSkins.filter((sk) => !givenBreadSkins.includes(sk) || sk === 'skin_classic');

        myReceive.skins.forEach((sk) => {
          if (!sk.startsWith('cat:') && !currentSkins.includes(sk)) {
            currentSkins.push(sk);
          }
        });

        let equipped = s.skins?.equipped || 'skin_classic';
        if (!currentSkins.includes(equipped)) equipped = 'skin_classic';
        s.skins = { ...s.skins, owned: currentSkins, equipped };

        // Скіни котиків
        let currentCatSkins: string[] = Array.isArray(s.cat?.ownedSkins) ? s.cat.ownedSkins : ['murchik'];
        const givenCatSkins = myGive.skins.filter((sk) => sk.startsWith('cat:')).map((sk) => sk.replace('cat:', ''));
        const receivedCatSkins = myReceive.skins.filter((sk) => sk.startsWith('cat:')).map((sk) => sk.replace('cat:', ''));

        currentCatSkins = currentCatSkins.filter((c) => !givenCatSkins.includes(c) || c === 'murchik');
        receivedCatSkins.forEach((c) => {
          if (!currentCatSkins.includes(c)) currentCatSkins.push(c);
        });

        let equippedCat = s.cat?.skin || 'murchik';
        if (!currentCatSkins.includes(equippedCat)) equippedCat = 'murchik';

        if (!s.cat) s.cat = { unlocked: false, level: 1, pestsCaught: 0, skin: 'murchik', ownedSkins: ['murchik'] };
        s.cat.ownedSkins = currentCatSkins;
        s.cat.skin = equippedCat;

        // Фіксуємо ідемпотентність
        s.settledTrades = Array.from(new Set([...(s.settledTrades || []), activeTradeId]));
        s.lastSave = Date.now();

        storage.set(SAVE_KEY, JSON.stringify(s));
        storage.set('focaccia-balance', JSON.stringify({ f: newFoc, d: newDia, ts: Date.now() }));
        try { localStorage.setItem(`trade_settled_${activeTradeId}`, '1'); } catch {}

        // Надсилаємо ack на сервер
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ack_trade', tradeId: activeTradeId, userId: meId }),
        }).catch(() => {});
      } catch (err) {
        console.error('Error settling trade save:', err);
      }
    };

    settleSave();
  }, [trade?.stage, isCompletedSettled, activeTradeId, meId]);

  // Поділитися в Telegram через бота (завжди відкриває TMA з сесією)
  const handleTelegramShare = () => {
    const deepLink = `https://t.me/${BOT_USERNAME}?start=trade_${activeTradeId}`;
    const text = `🤝 Заходь у мій безпечний трейд у Фокача Клікері! Обміняємося фокачами 🫓, алмазами 💎 чи скінами 🎨:`;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;
    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(tgShareUrl);
      else window.open(tgShareUrl, '_blank');
    } catch {
      window.open(tgShareUrl, '_blank');
    }
    haptic.medium();
  };

  // Копіювання посилання (використовує бот-лінк для надійності)
  const handleCopyLink = () => {
    const botLink = `https://t.me/${BOT_USERNAME}?start=trade_${activeTradeId}`;
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(botLink);
        setCopiedLink(true);
        haptic.success();
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch { /* */ }
  };

  const handleCopyDirectLink = () => {
    const directUrl = `https://nout0688-cloud.github.io/focaccia-clicker/?v=${Date.now()}&trade=${activeTradeId}`;
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(directUrl);
        setCopiedDirectLink(true);
        haptic.success();
        setTimeout(() => setCopiedDirectLink(false), 2500);
      }
    } catch { /* */ }
  };

  // Копіювання ID кімнати
  const handleCopyCode = () => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(activeTradeId);
        setCopiedCode(true);
        haptic.light();
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch { /* */ }
  };

  const returnToLobby = () => {
    haptic.light();
    setActiveTradeId('');
    setTrade(null);
    setRoomError(null);
    window.history.replaceState(null, '', window.location.pathname + '?v=' + Date.now() + '&trade=lobby');
  };

  const returnToGame = () => {
    haptic.medium();
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  // Картка відображення скіна
  const renderSkinCard = (skinKey: string, onRemove?: () => void) => {
    const isCat = skinKey.startsWith('cat:');
    const actualId = isCat ? skinKey.replace('cat:', '') : skinKey;

    if (isCat) {
      const cat = getCatSkin(actualId);
      return (
        <div key={skinKey} className="relative flex items-center gap-2 bg-stone-950/90 border border-amber-500/40 rounded-xl p-1.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-xl shrink-0">
            🐱
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black text-amber-200 truncate">{cat.nameUk}</div>
            <div className="text-[9px] text-amber-400/80 font-semibold truncate">Кіт • {cat.breedUk}</div>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-5 h-5 rounded-full bg-rose-950 text-rose-300 flex items-center justify-center text-[10px] hover:bg-rose-900 border border-rose-700/60 active:scale-95 cursor-pointer shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      );
    }

    const skin = SKINS[actualId];
    if (!skin) return null;
    const rarity = RARITY_LABELS[skin.rarity];

    return (
      <div key={skinKey} className={cn("relative flex items-center gap-2 bg-stone-950/90 border rounded-xl p-1.5 shadow-sm", skin.borderColor || 'border-stone-700')}>
        <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center overflow-hidden shrink-0">
          <img src={skin.img} alt={skin.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black text-amber-100 truncate">{skin.name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={cn("text-[8px] px-1 py-0.2 rounded font-black", rarity?.color || 'text-stone-300')}>
              {rarity?.uk || 'Скін'}
            </span>
            <span className="text-[9px] text-stone-400 truncate">{skin.bonusDesc}</span>
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-5 h-5 rounded-full bg-rose-950 text-rose-300 flex items-center justify-center text-[10px] hover:bg-rose-900 border border-rose-700/60 active:scale-95 cursor-pointer shrink-0"
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  // ==========================================
  // 1. ЕКРАН ЛОБІ ТРЕЙДІВ (Trade Lobby)
  // ==========================================
  if (!activeTradeId) {
    const filteredPlayers = activePlayers.filter((p) => {
      if (!playerFilter) return true;
      const q = playerFilter.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.username && p.username.toLowerCase().includes(q));
    });

    return (
      <div className="min-h-[100dvh] bg-[#0c0906] text-stone-100 flex flex-col justify-between select-none safe-top safe-bottom">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#0c0906]/95 backdrop-blur-md border-b border-amber-500/20 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-sm">
          <button
            type="button"
            onClick={returnToGame}
            className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <span>←</span>
            <span>В гру</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-black text-amber-200">
            <span className="text-base">🤝</span>
            <span>Лобі Трейдів</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono bg-stone-900/80 px-2.5 py-1 rounded-xl border border-stone-800 shrink-0">
            <span className="text-amber-400 font-bold">{formatNum(myFocaccia)} 🫓</span>
            <span className="text-stone-600">•</span>
            <span className="text-cyan-400 font-bold">{myDiamonds} 💎</span>
          </div>
        </header>

        {/* Warning if opened in external browser */}
        {!isRealTg && (
          <div className="mx-3.5 mt-3 bg-amber-950/80 border border-amber-500/60 rounded-2xl p-3 text-xs text-amber-200 flex items-center justify-between gap-2">
            <div className="leading-tight">
              <span className="font-bold">⚠️ Браузерна сесія:</span> Відкрийте через Telegram, щоб обмінювати власні предмети!
            </div>
            <button
              type="button"
              onClick={() => {
                const url = `https://t.me/${BOT_USERNAME}?start=trade`;
                window.open(url, '_blank');
              }}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-lg text-[10px] shrink-0"
            >
              В Telegram
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="p-3.5 flex-1 space-y-3.5 max-w-lg mx-auto w-full">
          {/* Segmented Lobby Tabs */}
          <div className="glass-card rounded-2xl p-1 flex border border-stone-800 text-xs font-bold gap-1 bg-stone-950/60">
            <button
              type="button"
              onClick={() => { setLobbyTab('active'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                lobbyTab === 'active'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>👥</span>
              <span>Онлайн</span>
            </button>
            <button
              type="button"
              onClick={() => { setLobbyTab('search'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                lobbyTab === 'search'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>🔍</span>
              <span>Пошук</span>
            </button>
            <button
              type="button"
              onClick={() => { setLobbyTab('open'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                lobbyTab === 'open'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>🔗</span>
              <span>Лінк</span>
            </button>
            <button
              type="button"
              onClick={() => { setLobbyTab('code'); haptic.selection(); }}
              className={cn(
                'flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                lobbyTab === 'code'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <span>⌨️</span>
              <span>Код</span>
            </button>
          </div>

          {/* TAB 1: Гравці онлайн */}
          {lobbyTab === 'active' && (
            <div className="space-y-2.5 animate-fade-in">
              <input
                type="text"
                value={playerFilter}
                onChange={(e) => setPlayerFilter(e.target.value)}
                placeholder="Фільтр за іменем або @юзернеймом..."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-amber-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />

              {loadingPlayers ? (
                <div className="py-12 text-center text-xs text-stone-500 animate-pulse">
                  Завантаження списку активних гравців...
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  Активних гравців не знайдено. Спробуй пошук або відкрите посилання!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-900/70 border border-stone-800/80 hover:border-amber-500/40 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                          👤
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-amber-200 truncate">{p.name}</div>
                          <div className="text-[10px] text-stone-400 truncate">
                            {p.username ? `@${p.username}` : `ID: ${p.id}`}
                            {p.score ? ` • ${formatNum(p.score)} 🫓` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={creatingTrade}
                        onClick={() => handleCreateTrade(p.id)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black text-xs shadow-md shadow-amber-600/20 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Запросити
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Пошук за юзернеймом */}
          {lobbyTab === 'search' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPlayer()}
                  placeholder="@username або ID гравця..."
                  className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-amber-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={searching || !searchQuery.trim()}
                  onClick={handleSearchPlayer}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-black rounded-xl text-xs shrink-0 active:scale-95"
                >
                  {searching ? '...' : 'Знайти'}
                </button>
              </div>

              {searchError && (
                <div className="p-3 bg-rose-950/40 border border-rose-600/40 rounded-xl text-xs text-rose-300">
                  {searchError}
                </div>
              )}

              {searchFound && (
                <div className="p-3.5 rounded-2xl bg-stone-900 border border-emerald-500/50 shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-lg text-emerald-300 shrink-0">
                      ✓
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-amber-100 truncate">{searchFound.name}</div>
                      <div className="text-[10px] text-stone-400 truncate">
                        {searchFound.username ? `@${searchFound.username}` : `ID: ${searchFound.id}`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={creatingTrade}
                    onClick={() => handleCreateTrade(searchFound.id)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-black text-xs shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    Запросити
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Відкритий трейд */}
          {lobbyTab === 'open' && (
            <div className="glass-card rounded-3xl p-5 border border-amber-500/30 bg-stone-900/60 text-center space-y-3.5 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-2xl mx-auto shadow-lg shadow-amber-600/30">
                🔗
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-200">Створити відкритий трейд</h3>
                <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                  Буде створено відкриту кімнату, до якої зможе приєднатися будь-який гравець за твоїм посиланням або кодом!
                </p>
              </div>

              <button
                type="button"
                disabled={creatingTrade}
                onClick={() => handleCreateTrade(null)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 hover:brightness-110 text-stone-950 font-black text-xs shadow-lg shadow-amber-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🤝</span>
                <span>{creatingTrade ? 'Створення...' : 'Створити кімнату зараз'}</span>
              </button>
            </div>
          )}

          {/* TAB 4: Вхід за кодом */}
          {lobbyTab === 'code' && (
            <div className="glass-card rounded-3xl p-5 border border-stone-800 bg-stone-900/60 space-y-3.5 animate-fade-in">
              <div>
                <div className="text-xs font-black text-amber-200 mb-1">Приєднатися за кодом або лінком:</div>
                <div className="text-[11px] text-stone-400">Встав код кімнати (tr_...) або посилання, яке надіслав партнер:</div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                  placeholder="tr_... або посилання"
                  className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={!joinCodeInput.trim()}
                  onClick={handleJoinByCode}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-stone-950 font-black rounded-xl text-xs shrink-0 active:scale-95"
                >
                  Вхід
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 text-center text-[10px] text-stone-600">
          Фокача Клікер • Безпечні обміни v2.0
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. ЕКРАН КІМНАТИ ТРЕЙДУ (Trade Room)
  // ==========================================

  // Стан завантаження кімнати
  if (roomLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0c0906] text-amber-100 flex flex-col items-center justify-center p-6 text-center select-none safe-top safe-bottom">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-xl shadow-amber-600/30 mb-4 animate-bounce">
          🤝
        </div>
        <div className="text-base font-black text-amber-300">Підключення до кімнати...</div>
        <div className="text-xs text-stone-500 font-mono mt-1">ID: {activeTradeId}</div>
      </div>
    );
  }

  // Помилка підключення
  if (roomError || !trade) {
    return (
      <div className="min-h-[100dvh] bg-[#0c0906] text-amber-100 flex flex-col items-center justify-center p-6 text-center select-none safe-top safe-bottom">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-600/50 flex items-center justify-center text-3xl mb-4 text-rose-400 shadow-lg shadow-rose-950/40">
          ⚠️
        </div>
        <h2 className="text-lg font-black text-rose-300 mb-2">Не вдалося увійти в трейд</h2>
        <p className="text-xs text-stone-400 max-w-xs mb-6 leading-relaxed">{roomError || 'Трейд не знайдено або термін його дії закінчився.'}</p>
        <button
          type="button"
          onClick={returnToLobby}
          className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-amber-200 font-black rounded-xl text-xs border border-stone-700 active:scale-95 transition-all"
        >
          ← Повернутися в лобі
        </button>
      </div>
    );
  }

  // Екран успіху
  if (trade.stage === 'completed') {
    const myGive = trade.me?.offer || { focaccia: 0, diamonds: 0, skins: [] };
    const myReceive = trade.opp?.offer || { focaccia: 0, diamonds: 0, skins: [] };

    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-amber-950/30 via-[#0c0906] to-[#080604] text-amber-100 flex flex-col items-center justify-center p-5 text-center select-none safe-top safe-bottom animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-4xl shadow-2xl shadow-amber-500/40 mb-3 animate-bounce">
          🎉
        </div>
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400 mb-1">
          Обмін успішно виконано!
        </h1>
        <p className="text-xs text-stone-400 mb-5">
          Предмети та валюту збережено й надіслано в гру.
        </p>

        <div className="w-full max-w-sm bg-stone-900/80 border border-amber-500/30 rounded-2xl p-4 mb-6 text-left space-y-3 shadow-xl backdrop-blur-md">
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3">
            <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5 mb-2">
              <span>📥</span> ТИ ОТРИМАВ:
            </div>
            <div className="space-y-1 text-xs">
              {myReceive.focaccia > 0 && <div className="font-bold text-amber-300">+{formatNum(myReceive.focaccia)} 🫓 фокач</div>}
              {myReceive.diamonds > 0 && <div className="font-bold text-cyan-300">+{myReceive.diamonds} 💎 алмазів</div>}
              {myReceive.skins.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] text-stone-400 font-bold">Скіни ({myReceive.skins.length}):</div>
                  {myReceive.skins.map((sk) => renderSkinCard(sk))}
                </div>
              )}
              {myReceive.focaccia === 0 && myReceive.diamonds === 0 && myReceive.skins.length === 0 && (
                <div className="text-stone-500 italic">Нічого (подарунок партнеру)</div>
              )}
            </div>
          </div>

          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3">
            <div className="text-xs font-black text-rose-400 flex items-center gap-1.5 mb-2">
              <span>📤</span> ТИ ВІДДАВ:
            </div>
            <div className="space-y-1 text-xs text-stone-300">
              {myGive.focaccia > 0 && <div>-{formatNum(myGive.focaccia)} 🫓 фокач</div>}
              {myGive.diamonds > 0 && <div>-{myGive.diamonds} 💎 алмазів</div>}
              {myGive.skins.length > 0 && (
                <div className="text-[11px] text-stone-400">Скіни: {myGive.skins.map((s) => SKINS[s.replace('cat:', '')]?.name || s).join(', ')}</div>
              )}
              {myGive.focaccia === 0 && myGive.diamonds === 0 && myGive.skins.length === 0 && (
                <div className="text-stone-500 italic">Нічого</div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={returnToGame}
          className="w-full max-w-sm py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black rounded-xl text-sm shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🫓</span>
          <span>Повернутися до гри</span>
        </button>
      </div>
    );
  }

  // Екран скасованого трейду
  if (trade.stage === 'cancelled') {
    return (
      <div className="min-h-[100dvh] bg-[#0c0906] text-amber-100 flex flex-col items-center justify-center p-6 text-center select-none safe-top safe-bottom">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-600/50 flex items-center justify-center text-3xl mb-4 text-rose-400">
          ✕
        </div>
        <h2 className="text-xl font-black text-rose-300 mb-2">Трейд скасовано</h2>
        <p className="text-xs text-stone-400 max-w-xs mb-6">
          {trade.cancelledReason || 'Обмін було перервано або скасовано учасником.'}
        </p>
        <button
          type="button"
          onClick={returnToLobby}
          className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-amber-200 font-bold rounded-xl text-xs border border-stone-700 active:scale-95 transition-all"
        >
          ← Повернутися в лобі
        </button>
      </div>
    );
  }

  const me = trade.me;
  const opp = trade.opp;
  const bothLocked = Boolean(me?.locked && opp?.locked);
  const myLocked = Boolean(me?.locked);
  const oppLocked = Boolean(opp?.locked);

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto bg-[#0c0906] text-stone-100 flex flex-col justify-between pb-16 select-none safe-top safe-bottom">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 bg-[#0c0906]/95 backdrop-blur-md border-b border-amber-500/20 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-sm">
        <button
          type="button"
          onClick={returnToLobby}
          className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
        >
          <span>←</span>
          <span>Лобі</span>
        </button>

        {/* Room Code Badge */}
        <button
          type="button"
          onClick={handleCopyCode}
          className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5 hover:bg-amber-500/20 active:scale-95 transition-all"
          title="Натисни, щоб скопіювати код"
        >
          <span className="text-xs">🤝</span>
          <span className="text-xs font-mono font-black text-amber-300">
            {copiedCode ? 'Скопійовано!' : activeTradeId.slice(-7)}
          </span>
        </button>

        {/* Live Partner Status & Cancel */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {opp ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{opp.name}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-[11px] font-bold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Очікуємо...</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleCancelTrade}
            className="w-7 h-7 rounded-xl bg-stone-900 border border-stone-800 hover:border-rose-500/50 hover:bg-rose-950/40 text-stone-400 hover:text-rose-300 flex items-center justify-center text-xs active:scale-95 transition-all cursor-pointer"
            title="Скасувати трейд"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <div className="p-3.5 space-y-3.5 flex-1">
        {/* Anti-Scam Alert Banner */}
        {scamAlert && (
          <div className="bg-amber-950/90 border border-amber-500/70 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2.5 shadow-lg shadow-amber-950/50 animate-bounce">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="font-bold leading-relaxed">{scamAlert}</div>
          </div>
        )}

        {/* Browser session warning banner */}
        {!isRealTg && (
          <div className="bg-amber-950/80 border border-amber-500/50 rounded-2xl p-3 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span className="text-[11px]">Для повної синхронізації відкрийте трейд через бота:</span>
            <button
              type="button"
              onClick={handleTelegramShare}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-lg text-[10px] shrink-0"
            >
              В Telegram
            </button>
          </div>
        )}

        {/* HERO WAITING CARD (якщо партнер ще не увійшов) */}
        {!opp && (
          <div className="glass-card rounded-3xl p-4.5 border border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-stone-900/70 to-black/70 shadow-xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-2xl mx-auto shadow-md shadow-amber-600/30">
              🔗
            </div>
            <div>
              <h2 className="text-sm font-black text-amber-200">Запроси партнера до обміну</h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Надішли запрошення другу в Telegram — щойно він відкриє його, кімната об'єднається!
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleTelegramShare}
                className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black text-xs shadow-md shadow-amber-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📤</span>
                <span>Поділитися в Telegram</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold text-[11px] border border-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>📋</span>
                  <span>{copiedLink ? 'Скопійовано!' : 'Бот-лінк'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDirectLink}
                  className="py-2.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-cyan-300 font-bold text-[11px] border border-cyan-500/30 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>🌐</span>
                  <span>{copiedDirectLink ? 'Скопійовано!' : 'Веб-лінк'}</span>
                </button>
              </div>
            </div>

            {/* Room Code Quick Display */}
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-stone-500">
              <span>Код кімнати:</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="font-mono text-amber-300 font-bold px-2 py-0.5 rounded-md bg-stone-950 border border-stone-800 hover:border-amber-500/40 cursor-pointer"
                title="Натисни, щоб скопіювати код"
              >
                {copiedCode ? 'Скопійовано!' : activeTradeId}
              </button>
            </div>
          </div>
        )}

        {/* DUAL PANELS OF BOTH SIDES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* === SIDE 1: MY OFFER === */}
          <div className={cn(
            "glass-card rounded-3xl p-4 border flex flex-col gap-3.5 transition-all",
            myLocked ? "border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-950/30" : "border-stone-800 bg-stone-900/60"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-800">
              <div>
                <div className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                  <span>📤 ТВОЯ ПРОПОЗИЦІЯ</span>
                  {myLocked && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-black">
                      ЗАФІКСОВАНО
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  Баланс: <span className="text-amber-300 font-bold">{formatNum(myFocaccia)} 🫓</span> • <span className="text-cyan-300 font-bold">{myDiamonds} 💎</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleLock}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer shadow-sm",
                  myLocked
                    ? "bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 text-stone-950 border-emerald-400 shadow-emerald-600/20"
                )}
              >
                <span>{myLocked ? '🔓 Змінити' : '🔒 Зафіксувати'}</span>
              </button>
            </div>

            {/* 1. Focaccia Selector */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1">
                <span>🫓 Фокачі до передачі:</span>
                <span className="text-amber-300 font-mono font-black">{formatNum(focOffer)}</span>
              </div>
              <div className="relative flex items-center gap-2">
                <input
                  type="number"
                  disabled={myLocked}
                  min={0}
                  max={myFocaccia}
                  value={focOffer || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(myFocaccia, parseInt(e.target.value, 10) || 0));
                    setFocOffer(val);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
                {!myLocked && focOffer > 0 && (
                  <button
                    type="button"
                    onClick={() => setFocOffer(0)}
                    className="absolute right-3 text-stone-500 hover:text-stone-300 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Focaccia Chips */}
              {!myLocked && (
                <div className="space-y-1.5 mt-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    {[0.1, 0.25, 0.5, 1].map((pct) => {
                      const label = pct === 1 ? 'MAX' : `${Math.round(pct * 100)}%`;
                      const calculated = Math.max(0, Math.floor(myFocaccia * pct));
                      return (
                        <button
                          key={pct}
                          type="button"
                          disabled={myFocaccia <= 0}
                          onClick={() => { setFocOffer(calculated); haptic.light(); }}
                          className={cn(
                            'py-1 rounded-lg text-xs font-black border transition-all cursor-pointer active:scale-95',
                            focOffer === calculated && calculated > 0
                              ? 'bg-amber-500 text-stone-950 border-amber-400'
                              : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[10000, 100000, 1000000, 10000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={myFocaccia < amt}
                        onClick={() => {
                          setFocOffer((prev) => Math.min(myFocaccia, prev + amt));
                          haptic.light();
                        }}
                        className="py-1 rounded-lg bg-stone-950 border border-stone-800 text-[10px] text-amber-300 font-bold hover:border-amber-500/40 disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
                      >
                        +{formatNum(amt)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Diamonds Selector */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1">
                <span>💎 Алмази до передачі:</span>
                <span className="text-cyan-300 font-mono font-black">{diaOffer} 💎</span>
              </div>
              <div className="relative flex items-center gap-2">
                <input
                  type="number"
                  disabled={myLocked}
                  min={0}
                  max={myDiamonds}
                  value={diaOffer || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(myDiamonds, parseInt(e.target.value, 10) || 0));
                    setDiaOffer(val);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm font-mono font-black text-cyan-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                {!myLocked && diaOffer > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiaOffer(0)}
                    className="absolute right-3 text-stone-500 hover:text-stone-300 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Diamond Chips */}
              {!myLocked && (
                <div className="space-y-1.5 mt-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    {[0.1, 0.25, 0.5, 1].map((pct) => {
                      const label = pct === 1 ? 'MAX' : `${Math.round(pct * 100)}%`;
                      const calculated = Math.max(0, Math.floor(myDiamonds * pct));
                      return (
                        <button
                          key={pct}
                          type="button"
                          disabled={myDiamonds <= 0}
                          onClick={() => { setDiaOffer(calculated); haptic.light(); }}
                          className={cn(
                            'py-1 rounded-lg text-xs font-black border transition-all cursor-pointer active:scale-95',
                            diaOffer === calculated && calculated > 0
                              ? 'bg-cyan-500 text-stone-950 border-cyan-400'
                              : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 5, 25, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={myDiamonds < amt}
                        onClick={() => {
                          setDiaOffer((prev) => Math.min(myDiamonds, prev + amt));
                          haptic.light();
                        }}
                        className="py-1 rounded-lg bg-stone-950 border border-stone-800 text-[10px] text-cyan-300 font-bold hover:border-cyan-500/40 disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
                      >
                        +{amt}💎
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Skins in Offer */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1.5">
                <span>🎨 Обрані скіни ({selectedSkins.length}):</span>
                {!myLocked && (
                  <button
                    type="button"
                    onClick={() => { setSkinModalOpen(true); haptic.light(); }}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>+ Додати скін</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedSkins.length === 0 ? (
                  <div
                    onClick={() => !myLocked && setSkinModalOpen(true)}
                    className="py-4 border border-dashed border-stone-800 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-amber-500/30 transition-all"
                  >
                    <span className="text-xl mb-0.5">🎨</span>
                    <span className="text-xs text-stone-400 font-bold">Скіни не обрано</span>
                    {!myLocked && (
                      <span className="text-[10px] text-amber-400/80 mt-0.5">Натисни, щоб додати з інвентарю</span>
                    )}
                  </div>
                ) : (
                  selectedSkins.map((sk) =>
                    renderSkinCard(sk, myLocked ? undefined : () => {
                      setSelectedSkins((prev) => prev.filter((item) => item !== sk));
                      haptic.light();
                    })
                  )
                )}
              </div>
            </div>
          </div>

          {/* === SIDE 2: PARTNER OFFER === */}
          <div className={cn(
            "glass-card rounded-3xl p-4 border flex flex-col gap-3.5 transition-all",
            oppLocked ? "border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-950/30" : "border-stone-800 bg-stone-900/60"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-800">
              <div>
                <div className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                  <span>📥 ПРОПОЗИЦІЯ ПАРТНЕРА</span>
                  {oppLocked ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-black">
                      ЗАФІКСОВАНО
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-bold">
                      РЕДАГУЄ...
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  Гравець: <span className="text-amber-300 font-bold">{opp ? opp.name : 'Очікуємо підключення...'}</span>
                  {opp?.u && <span className="text-stone-500 ml-1">@{opp.u}</span>}
                </div>
              </div>

              <div className="text-xs font-black">
                {opp?.confirmed ? (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <span>✓</span> Підтверджено
                  </span>
                ) : oppLocked ? (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <span>🔒</span> Зафіксовано
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-stone-800 text-stone-400 text-[10px]">
                    Обирає...
                  </span>
                )}
              </div>
            </div>

            {/* Partner Focaccia & Diamonds Display */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3 text-center">
                <div className="text-[10px] font-bold text-stone-400 mb-0.5">Фокачі 🫓</div>
                <div className="text-base font-black text-amber-300 font-mono">
                  {opp?.offer?.focaccia ? formatNum(opp.offer.focaccia) : '0'}
                </div>
              </div>
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3 text-center">
                <div className="text-[10px] font-bold text-stone-400 mb-0.5">Алмази 💎</div>
                <div className="text-base font-black text-cyan-300 font-mono">
                  {opp?.offer?.diamonds || 0}
                </div>
              </div>
            </div>

            {/* Partner Skins Display */}
            <div>
              <div className="text-[11px] font-bold text-stone-300 mb-1.5">
                🎨 Скіни від партнера ({opp?.offer?.skins?.length || 0}):
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {(!opp?.offer?.skins || opp.offer.skins.length === 0) ? (
                  <div className="py-5 border border-dashed border-stone-800 rounded-2xl flex flex-col items-center justify-center text-center text-stone-500">
                    <span className="text-xs">Партнер ще не обрав скінів</span>
                  </div>
                ) : (
                  opp.offer.skins.map((sk) => renderSkinCard(sk))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM STICKY ACTION BAR */}
      <div className="sticky bottom-0 bg-[#0c0906]/95 backdrop-blur-md border-t border-stone-800 px-4 py-3 max-w-2xl mx-auto w-full space-y-2 shadow-2xl">
        {/* Helper Hint Text */}
        <div className="text-center text-xs font-bold">
          {!opp ? (
            <span className="text-amber-400 animate-pulse">Очікування підключення партнера...</span>
          ) : !myLocked ? (
            <span className="text-stone-300">
              Налаштуй пропозицію та натисни <span className="text-emerald-400 font-black">🔒 Зафіксувати</span>
            </span>
          ) : !oppLocked ? (
            <span className="text-amber-300/90 animate-pulse">Очікуємо фіксації від {opp.name}...</span>
          ) : bothLocked && !me?.confirmed ? (
            <span className="text-emerald-300 font-black">Обидві сторони зафіксували пропозиції!</span>
          ) : (
            <span className="text-cyan-300 font-bold">Очікування фінального підтвердження від {opp.name}...</span>
          )}
        </div>

        {/* Big Action Button */}
        <button
          type="button"
          disabled={!bothLocked || Boolean(me?.confirmed)}
          onClick={() => {
            setConfirmModalOpen(true);
            haptic.medium();
          }}
          className={cn(
            "w-full py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer",
            bothLocked && !me?.confirmed
              ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-stone-950 shadow-emerald-500/30 active:scale-95 animate-pulse"
              : me?.confirmed
              ? "bg-emerald-950 border border-emerald-500/50 text-emerald-300 opacity-90 cursor-default"
              : "bg-stone-800 text-stone-500 border border-stone-700/50 opacity-50 cursor-not-allowed"
          )}
        >
          {me?.confirmed ? (
            <>
              <span>⏳</span>
              <span>ТВОЄ ПІДТВЕРДЖЕННЯ ПРИЙНЯТО</span>
            </>
          ) : (
            <>
              <span>🤝</span>
              <span>ПІДТВЕРДИТИ ОБМІН</span>
            </>
          )}
        </button>
      </div>

      {/* MODAL 1: Skin Inventory Picker */}
      {skinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
              <div className="text-sm font-black text-amber-200 flex items-center gap-2">
                <span>🎨</span>
                <span>Твій інвентар скінів</span>
              </div>
              <button
                type="button"
                onClick={() => setSkinModalOpen(false)}
                className="w-7 h-7 rounded-full bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs: Bread Skins vs Cat Skins */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSkinTab('bread')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black transition-all border",
                  skinTab === 'bread'
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-stone-950 border-stone-800 text-stone-400"
                )}
              >
                🫓 Скіни Фокачі
              </button>
              <button
                type="button"
                onClick={() => setSkinTab('cat')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black transition-all border",
                  skinTab === 'cat'
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-stone-950 border-stone-800 text-stone-400"
                )}
              >
                🐱 Скіни Кота
              </button>
            </div>

            {/* Skin List */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {skinTab === 'bread' ? (
                myOwnedSkins.filter((sk) => sk !== 'skin_classic').length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-xs">
                    У тебе немає додаткових скінів фокачі для обміну.
                    <div className="text-[10px] text-stone-600 mt-1">(Базова фокача закріплена назавжди)</div>
                  </div>
                ) : (
                  myOwnedSkins.filter((sk) => sk !== 'skin_classic').map((skinId) => {
                    const skin = SKINS[skinId];
                    if (!skin) return null;
                    const isSelected = selectedSkins.includes(skinId);
                    const rarity = RARITY_LABELS[skin.rarity];

                    return (
                      <div
                        key={skinId}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSkins((prev) => prev.filter((id) => id !== skinId));
                          } else {
                            setSelectedSkins((prev) => [...prev, skinId]);
                          }
                          haptic.selection();
                        }}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all",
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 shadow-md shadow-amber-950/30"
                            : "bg-stone-950 border-stone-800 hover:border-stone-700"
                        )}
                      >
                        <div className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-700 overflow-hidden shrink-0 flex items-center justify-center">
                          <img src={skin.img} alt={skin.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-amber-100 truncate">{skin.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-black", rarity?.color)}>
                              {rarity?.uk}
                            </span>
                            <span className="text-[10px] text-stone-400 truncate">{skin.bonusDesc}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center border text-xs font-black transition-all shrink-0",
                          isSelected
                            ? "bg-amber-500 border-amber-400 text-stone-950"
                            : "bg-stone-900 border-stone-700 text-transparent"
                        )}>
                          ✓
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                myOwnedCatSkins.filter((sk) => sk !== 'murchik').length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-xs">
                    У тебе немає додаткових скінів кота для обміну.
                    <div className="text-[10px] text-stone-600 mt-1">(Базовий Мурчик закріплений назавжди)</div>
                  </div>
                ) : (
                  myOwnedCatSkins.filter((sk) => sk !== 'murchik').map((catId) => {
                    const cat = getCatSkin(catId);
                    const skinKey = `cat:${catId}`;
                    const isSelected = selectedSkins.includes(skinKey);

                    return (
                      <div
                        key={catId}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSkins((prev) => prev.filter((id) => id !== skinKey));
                          } else {
                            setSelectedSkins((prev) => [...prev, skinKey]);
                          }
                          haptic.selection();
                        }}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all",
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 shadow-md shadow-amber-950/30"
                            : "bg-stone-950 border-stone-800 hover:border-stone-700"
                        )}
                      >
                        <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-600/50 flex items-center justify-center text-2xl shrink-0">
                          🐱
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-amber-100 truncate">{cat.nameUk}</div>
                          <div className="text-[10px] text-amber-400/80 font-bold truncate">{cat.breedUk}</div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center border text-xs font-black transition-all shrink-0",
                          isSelected
                            ? "bg-amber-500 border-amber-400 text-stone-950"
                            : "bg-stone-900 border-stone-700 text-transparent"
                        )}>
                          ✓
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => { setSkinModalOpen(false); haptic.medium(); }}
              className="mt-4 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black rounded-xl text-xs shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"
            >
              Зберегти вибір ({selectedSkins.length})
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: 2-Step Safety Verification Confirm Dialog */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="w-full max-w-sm bg-stone-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl mx-auto mb-2">
              ⚖️
            </div>
            <h3 className="text-base font-black text-amber-200 mb-1">Підтвердження обміну</h3>
            <p className="text-[11px] text-stone-400 mb-4 leading-relaxed">
              Уважно перевір обидві пропозиції. Після підтвердження операція є остаточною!
            </p>

            <div className="space-y-2 text-left text-xs mb-5">
              <div className="bg-rose-950/40 border border-rose-600/40 rounded-xl p-3">
                <div className="font-black text-rose-300 mb-1 flex items-center gap-1">
                  <span>📤</span> ТИ ВІДДАЄШ:
                </div>
                <div className="text-stone-300 space-y-0.5 text-[11px]">
                  {focOffer > 0 && <div>• {formatNum(focOffer)} 🫓 фокач</div>}
                  {diaOffer > 0 && <div>• {diaOffer} 💎 алмазів</div>}
                  {selectedSkins.length > 0 && (
                    <div>• Скіни ({selectedSkins.length}): {selectedSkins.map((s) => SKINS[s.replace('cat:', '')]?.name || s).join(', ')}</div>
                  )}
                  {focOffer === 0 && diaOffer === 0 && selectedSkins.length === 0 && (
                    <div className="text-stone-500 italic">Нічого (подарунок)</div>
                  )}
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-xl p-3">
                <div className="font-black text-emerald-300 mb-1 flex items-center gap-1">
                  <span>📥</span> ТИ ОТРИМУЄШ:
                </div>
                <div className="text-stone-300 space-y-0.5 text-[11px]">
                  {opp?.offer?.focaccia ? <div>• {formatNum(opp.offer.focaccia)} 🫓 фокач</div> : null}
                  {opp?.offer?.diamonds ? <div>• {opp.offer.diamonds} 💎 алмазів</div> : null}
                  {opp?.offer?.skins?.length ? (
                    <div>• Скіни ({opp.offer.skins.length}): {opp.offer.skins.map((s) => SKINS[s.replace('cat:', '')]?.name || s).join(', ')}</div>
                  ) : null}
                  {!opp?.offer?.focaccia && !opp?.offer?.diamonds && !opp?.offer?.skins?.length && (
                    <div className="text-stone-500 italic">Нічого</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={confirmTimer > 0}
                onClick={handleFinalConfirm}
                className={cn(
                  "flex-1 py-3 font-black rounded-xl text-xs transition-all shadow-md",
                  confirmTimer > 0
                    ? "bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 text-stone-950 hover:from-emerald-400 hover:to-teal-400 active:scale-95 shadow-emerald-600/30 cursor-pointer"
                )}
              >
                {confirmTimer > 0 ? `Зачекай (${confirmTimer}с)` : '✓ Підтвердити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
