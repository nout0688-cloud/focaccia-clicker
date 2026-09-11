import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../game/data';
import { SKINS, RARITY_LABELS } from '../game/skins';
import { getCatSkin } from '../game/cat';
import { cn } from '../utils/cn';

const API = 'https://focaccia-bot.vercel.app/api/trade';
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

export default function TradeApp({ tradeId }: { tradeId: string }) {
  const meId = String(tg?.initDataUnsafe?.user?.id || '');
  const myName = String(tg?.initDataUnsafe?.user?.first_name || 'Гравець');
  const myU = String(tg?.initDataUnsafe?.user?.username || '');

  const [trade, setTrade] = useState<TradeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local user inventory from save
  const [, setUserSave] = useState<any>(null);
  const [myFocaccia, setMyFocaccia] = useState(0);
  const [myDiamonds, setMyDiamonds] = useState(0);
  const [myOwnedSkins, setMyOwnedSkins] = useState<string[]>([]);
  const [myOwnedCatSkins, setMyOwnedCatSkins] = useState<string[]>([]);

  // Current offer being edited
  const [focOffer, setFocOffer] = useState(0);
  const [diaOffer, setDiaOffer] = useState(0);
  const [selectedSkins, setSelectedSkins] = useState<string[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'mine' | 'partner'>('mine');
  const [skinModalOpen, setSkinModalOpen] = useState(false);
  const [skinTab, setSkinTab] = useState<'bread' | 'cat'>('bread');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTimer, setConfirmTimer] = useState(3);
  const [scamAlert, setScamAlert] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCompletedSettled, setIsCompletedSettled] = useState(false);

  const prevOppOfferRef = useRef<Offer | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  // Load user inventory from localStorage + CloudStorage + Server
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
        setUserSave(loadedSave);
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

  // Polling sync with server every 850ms
  useEffect(() => {
    if (!tradeId || !meId) return;

    let iv: ReturnType<typeof setInterval> | undefined;

    const syncTick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const payload: any = {
          action: 'sync',
          tradeId,
          userId: meId,
          name: myName,
          u: myU,
        };

        // Only send offer updates if not currently locked
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
          setError(
            data.error === 'not_found'
              ? 'Трейд не знайдено або термін його дії закінчився'
              : data.error === 'not_a_participant'
              ? 'У цьому трейді вже є 2 учасники'
              : `Помилка: ${data.error}`
          );
          setLoading(false);
          return;
        }

        // Anti-scam detection: did partner change anything?
        if (data.opp?.offer && prevOppOfferRef.current) {
          const p = prevOppOfferRef.current;
          const cur = data.opp.offer;
          const focChanged = p.focaccia !== cur.focaccia;
          const diaChanged = p.diamonds !== cur.diamonds;
          const skinsChanged = JSON.stringify(p.skins.slice().sort()) !== JSON.stringify(cur.skins.slice().sort());

          if (focChanged || diaChanged || skinsChanged) {
            haptic.warning();
            setScamAlert('⚠️ Партнер змінив свою пропозицію! Перевір предмети перед блокуванням.');
            setTimeout(() => setScamAlert(null), 6000);
          }
        }
        if (data.opp?.offer) {
          prevOppOfferRef.current = { ...data.opp.offer };
        }

        setTrade(data);
        setLoading(false);

        // If completed or cancelled, stop polling
        if (data.stage !== 'active' && iv) {
          clearInterval(iv);
        }
      } catch {
        /* network blip */
      } finally {
        inFlightRef.current = false;
      }
    };

    syncTick();
    iv = setInterval(syncTick, 850);
    return () => { if (iv) clearInterval(iv); };
  }, [tradeId, meId, focOffer, diaOffer, selectedSkins, trade?.me?.locked]);

  // Safety countdown timer for Confirm modal
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

  // Handle Lock toggle
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
          tradeId,
          userId: meId,
          locked: wantLock,
        }),
      });
      // Optimistic local update
      setTrade((prev) => (prev && prev.me ? { ...prev, me: { ...prev.me, locked: wantLock, confirmed: false } } : prev));
    } catch {
      haptic.error();
    }
  };

  // Handle Confirm Click
  const handleFinalConfirm = async () => {
    if (!trade || trade.stage !== 'active') return;
    haptic.success();
    setConfirmModalOpen(false);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          tradeId,
          userId: meId,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setTrade((prev) => (prev && prev.me ? { ...prev, me: { ...prev.me, confirmed: true }, stage: data.stage || prev.stage } : prev));
      }
    } catch {
      haptic.error();
    }
  };

  // Handle Cancel Trade
  const handleCancelTrade = async () => {
    if (!trade || trade.stage !== 'active') return;
    haptic.error();

    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          tradeId,
          userId: meId,
          reason: 'Скасовано гравцем',
        }),
      });
      setTrade((prev) => (prev ? { ...prev, stage: 'cancelled', cancelledReason: 'Ти скасував цей трейд' } : prev));
    } catch { /* */ }
  };

  // When trade completes, settle and write updated items to local save & cloud
  useEffect(() => {
    if (trade?.stage !== 'completed' || isCompletedSettled) return;
    setIsCompletedSettled(true);
    haptic.success();

    const settleSave = async () => {
      const raw = await storage.get(SAVE_KEY);
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        const myGive = trade.me?.offer || { focaccia: 0, diamonds: 0, skins: [] };
        const myReceive = trade.opp?.offer || { focaccia: 0, diamonds: 0, skins: [] };

        // 1. Currency settlement
        const currentFoc = Number(s.focaccia) || 0;
        const currentDia = Number(s.diamonds) || 0;
        const newFoc = Math.max(0, currentFoc - myGive.focaccia + myReceive.focaccia);
        const newDia = Math.max(0, currentDia - myGive.diamonds + myReceive.diamonds);
        s.focaccia = newFoc;
        s.diamonds = newDia;

        // 2. Skins settlement
        let currentSkins: string[] = Array.isArray(s.skins?.owned) ? s.skins.owned : ['skin_classic'];
        // Remove given skins (never remove skin_classic)
        currentSkins = currentSkins.filter((sk) => !myGive.skins.includes(sk) || sk === 'skin_classic');
        // Add received skins
        myReceive.skins.forEach((sk) => {
          if (!sk.startsWith('cat:') && !currentSkins.includes(sk)) {
            currentSkins.push(sk);
          }
        });

        // If currently equipped skin was traded away, revert to classic
        let equipped = s.skins?.equipped || 'skin_classic';
        if (!currentSkins.includes(equipped)) {
          equipped = 'skin_classic';
        }

        s.skins = {
          ...s.skins,
          owned: currentSkins,
          equipped,
        };

        // 3. Cat skins settlement
        let currentCatSkins: string[] = Array.isArray(s.cat?.ownedSkins) ? s.cat.ownedSkins : ['murchik'];
        const givenCatSkins = myGive.skins.filter((sk) => sk.startsWith('cat:')).map((sk) => sk.replace('cat:', ''));
        const receivedCatSkins = myReceive.skins.filter((sk) => sk.startsWith('cat:')).map((sk) => sk.replace('cat:', ''));

        currentCatSkins = currentCatSkins.filter((c) => !givenCatSkins.includes(c) || c === 'murchik');
        receivedCatSkins.forEach((c) => {
          if (!currentCatSkins.includes(c)) currentCatSkins.push(c);
        });

        let equippedCat = s.cat?.skin || 'murchik';
        if (!currentCatSkins.includes(equippedCat)) {
          equippedCat = 'murchik';
        }

        if (s.cat) {
          s.cat.ownedSkins = currentCatSkins;
          s.cat.skin = equippedCat;
        }

        s.lastSave = Date.now();

        // Write to local & CloudStorage
        storage.set(SAVE_KEY, JSON.stringify(s));
        storage.set('focaccia-balance', JSON.stringify({ f: newFoc, d: newDia, ts: Date.now() }));
      } catch (err) {
        console.error('Error settling trade save:', err);
      }
    };

    settleSave();
  }, [trade?.stage, isCompletedSettled]);

  const handleShareLink = () => {
    const url = `https://nout0688-cloud.github.io/focaccia-clicker/?v=1.4.0&trade=${tradeId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopySuccess(true);
      haptic.light();
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  const returnToGame = () => {
    haptic.medium();
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  // Render skin badge item
  const renderSkinCard = (skinKey: string, onRemove?: () => void) => {
    const isCat = skinKey.startsWith('cat:');
    const actualId = isCat ? skinKey.replace('cat:', '') : skinKey;

    if (isCat) {
      const cat = getCatSkin(actualId);
      return (
        <div key={skinKey} className="relative flex items-center gap-2 bg-stone-950/80 border border-amber-600/40 rounded-xl p-2 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-500/50 flex items-center justify-center text-xl overflow-hidden shrink-0">
            🐱
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-amber-200 truncate">{cat.nameUk}</div>
            <div className="text-[10px] text-amber-400/80 font-medium truncate">Кіт • {cat.breedUk}</div>
          </div>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-6 h-6 rounded-full bg-rose-950/80 text-rose-300 flex items-center justify-center text-xs hover:bg-rose-900 border border-rose-700/50"
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
      <div key={skinKey} className={cn("relative flex items-center gap-2 bg-stone-950/80 border rounded-xl p-2 shadow-sm", skin.borderColor || 'border-stone-700')}>
        <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700/60 flex items-center justify-center overflow-hidden shrink-0">
          <img src={skin.img} alt={skin.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-amber-100 truncate">{skin.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[9px] px-1.5 py-0.2 rounded font-semibold", rarity?.color || 'text-stone-300')}>
              {rarity?.uk || 'Скін'}
            </span>
            <span className="text-[10px] text-stone-400 truncate">{skin.bonusDesc}</span>
          </div>
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-6 h-6 rounded-full bg-rose-950/80 text-rose-300 flex items-center justify-center text-xs hover:bg-rose-900 border border-rose-700/50"
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0906] text-amber-100 flex flex-col items-center justify-center p-4">
        <div className="text-4xl animate-bounce mb-3">🤝</div>
        <div className="text-sm font-bold text-amber-300">Підключення до кімнати трейду...</div>
        <div className="text-xs text-stone-500 mt-1">ID: {tradeId}</div>
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="min-h-screen bg-[#0c0906] text-amber-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-lg font-black text-rose-400 mb-2">Не вдалося увійти в трейд</h2>
        <p className="text-xs text-stone-400 max-w-xs mb-6">{error || 'Трейд не знайдено або сталася помилка.'}</p>
        <button
          onClick={returnToGame}
          className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-stone-950 font-black rounded-xl text-sm shadow-lg shadow-amber-900/30 active:scale-95 transition-all"
        >
          🫓 Повернутися в гру
        </button>
      </div>
    );
  }

  // Finished celebration screen
  if (trade.stage === 'completed') {
    const myGive = trade.me?.offer || { focaccia: 0, diamonds: 0, skins: [] };
    const myReceive = trade.opp?.offer || { focaccia: 0, diamonds: 0, skins: [] };

    return (
      <div className="min-h-screen bg-radial from-amber-950/40 via-[#0c0906] to-[#080604] text-amber-100 flex flex-col items-center justify-center p-5 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-4xl shadow-2xl shadow-amber-500/40 mb-4 animate-bounce">
          🎉
        </div>
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400 mb-1">
          Обмін успішно завершено!
        </h1>
        <p className="text-xs text-amber-300/80 mb-6">
          Предмети та валюту безпечно передано між акаунтами.
        </p>

        <div className="w-full max-w-sm bg-stone-900/80 border border-amber-500/30 rounded-2xl p-4 mb-6 text-left space-y-4 shadow-xl backdrop-blur-md">
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3">
            <div className="text-xs font-black text-emerald-400 flex items-center gap-1 mb-2">
              <span>📥</span> ТИ ОТРИМАВ:
            </div>
            <div className="space-y-1 text-xs text-stone-300">
              {myReceive.focaccia > 0 && <div className="font-bold text-amber-300">+{formatNum(myReceive.focaccia)} 🫓 фокач</div>}
              {myReceive.diamonds > 0 && <div className="font-bold text-cyan-300">+{myReceive.diamonds} 💎 алмазів</div>}
              {myReceive.skins.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] text-stone-400 font-semibold">Скіни ({myReceive.skins.length} шт.):</div>
                  {myReceive.skins.map((sk) => renderSkinCard(sk))}
                </div>
              )}
              {myReceive.focaccia === 0 && myReceive.diamonds === 0 && myReceive.skins.length === 0 && (
                <div className="text-stone-500 italic">Нічого (подарунок партнеру)</div>
              )}
            </div>
          </div>

          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3">
            <div className="text-xs font-black text-rose-400 flex items-center gap-1 mb-2">
              <span>📤</span> ТИ ВІДДАВ:
            </div>
            <div className="space-y-1 text-xs text-stone-300">
              {myGive.focaccia > 0 && <div>-{formatNum(myGive.focaccia)} 🫓 фокач</div>}
              {myGive.diamonds > 0 && <div>-{myGive.diamonds} 💎 алмазів</div>}
              {myGive.skins.length > 0 && (
                <div className="text-[11px] text-stone-400">Скіни: {myGive.skins.map((s) => SKINS[s.replace('cat:', '')]?.name || s).join(', ')}</div>
              )}
              {myGive.focaccia === 0 && myGive.diamonds === 0 && myGive.skins.length === 0 && (
                <div className="text-stone-500 italic">Нічого (безкоштовно)</div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={returnToGame}
          className="w-full max-w-sm py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black rounded-xl text-base shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>🫓</span> Повернутися в гру
        </button>
      </div>
    );
  }

  // Cancelled screen
  if (trade.stage === 'cancelled') {
    return (
      <div className="min-h-screen bg-[#0c0906] text-amber-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-600/50 flex items-center justify-center text-3xl mb-4 text-rose-400">
          ✕
        </div>
        <h2 className="text-xl font-black text-rose-300 mb-2">Трейд скасовано</h2>
        <p className="text-xs text-stone-400 max-w-xs mb-6">
          {trade.cancelledReason || 'Обмін було перервано або скасовано.'}
        </p>
        <button
          onClick={returnToGame}
          className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-amber-200 font-bold rounded-xl text-sm border border-stone-700"
        >
          🫓 Повернутися в гру
        </button>
      </div>
    );
  }

  const me = trade.me;
  const opp = trade.opp;
  const bothLocked = !!(me?.locked && opp?.locked);
  const myLocked = !!me?.locked;
  const oppLocked = !!opp?.locked;

  return (
    <div className="min-h-screen bg-[#0d0a07] text-stone-100 flex flex-col pb-8">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#0d0a07]/90 backdrop-blur-md border-b border-stone-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center text-lg shadow-md shadow-amber-900/30">
            🤝
          </div>
          <div>
            <div className="text-sm font-black text-amber-200 flex items-center gap-1.5">
              <span>Кімната Трейду</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-400 font-mono">
                {tradeId.slice(-6)}
              </span>
            </div>
            <div className="text-[11px] text-stone-400 flex items-center gap-1">
              {opp ? (
                <>
                  <span className={cn("w-2 h-2 rounded-full inline-block", opp.online ? "bg-emerald-400 animate-pulse" : "bg-stone-500")} />
                  <span className="truncate max-w-[130px]">{opp.name}</span>
                  {opp.u && <span className="text-[10px] text-stone-500">(@{opp.u})</span>}
                </>
              ) : (
                <span className="text-amber-400 animate-pulse">Очікування підключення партнера...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!opp && (
            <button
              onClick={handleShareLink}
              className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-600/30 active:scale-95 transition-all flex items-center gap-1"
            >
              <span>🔗</span>
              <span>{copySuccess ? 'Скопійовано!' : 'Лінк'}</span>
            </button>
          )}
          <button
            onClick={handleCancelTrade}
            className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-rose-400 hover:bg-rose-950/30 flex items-center justify-center text-sm transition-all"
            title="Скасувати трейд"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Anti-Scam Alert Banner */}
      {scamAlert && (
        <div className="mx-4 mt-3 bg-amber-950/90 border border-amber-500/60 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2 shadow-lg animate-shake">
          <span className="text-lg shrink-0">⚠️</span>
          <div>{scamAlert}</div>
        </div>
      )}

      {/* Waiting for partner notice */}
      {!opp && (
        <div className="m-4 bg-gradient-to-r from-amber-950/40 via-stone-900/60 to-amber-950/40 border border-amber-500/30 rounded-2xl p-4 text-center">
          <div className="text-2xl mb-1.5 animate-bounce">⏳</div>
          <div className="text-sm font-bold text-amber-300 mb-1">Партнер ще не увійшов у трейд</div>
          <p className="text-xs text-stone-400 mb-3 max-w-xs mx-auto">
            Надішли посилання другові, щоб він відкрив кімнату обміну:
          </p>
          <div className="flex items-center gap-2 max-w-xs mx-auto">
            <input
              type="text"
              readOnly
              value={`https://nout0688-cloud.github.io/focaccia-clicker/?v=1.4.0&trade=${tradeId}`}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-200/80 select-all font-mono"
            />
            <button
              onClick={handleShareLink}
              className="px-3 py-1.5 bg-amber-500 text-stone-950 font-black text-xs rounded-lg hover:bg-amber-400 shrink-0"
            >
              {copySuccess ? '✓' : 'Копія'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="px-4 mt-3 flex md:hidden gap-2">
        <button
          onClick={() => { setActiveTab('mine'); haptic.selection(); }}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border",
            activeTab === 'mine'
              ? "bg-amber-600/20 border-amber-500/50 text-amber-300 shadow-sm"
              : "bg-stone-900/60 border-stone-800/80 text-stone-400"
          )}
        >
          <span>📤</span>
          <span>Твоя пропозиція</span>
          {myLocked && <span className="text-[10px] text-emerald-400">🔒</span>}
        </button>
        <button
          onClick={() => { setActiveTab('partner'); haptic.selection(); }}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border",
            activeTab === 'partner'
              ? "bg-amber-600/20 border-amber-500/50 text-amber-300 shadow-sm"
              : "bg-stone-900/60 border-stone-800/80 text-stone-400"
          )}
        >
          <span>📥</span>
          <span>Партнер ({opp ? opp.name : '…'})</span>
          {oppLocked && <span className="text-[10px] text-emerald-400">🔒</span>}
        </button>
      </div>

      {/* Main Trade Grid: My Offer & Partner's Offer */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* === LEFT CARD: MY OFFER === */}
        <div className={cn(
          "bg-stone-900/70 border rounded-2xl p-4 flex flex-col backdrop-blur-sm transition-all",
          myLocked ? "border-emerald-600/40 shadow-lg shadow-emerald-950/20" : "border-stone-800",
          activeTab === 'mine' ? "block" : "hidden md:flex"
        )}>
          <div className="flex items-center justify-between pb-3 border-b border-stone-800/80 mb-3">
            <div>
              <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <span>📤 ТВОЯ ПРОПОЗИЦІЯ</span>
                {myLocked && <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40 font-bold">ЗАФІКСОВАНО</span>}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">
                Баланс: <span className="text-amber-300 font-semibold">{formatNum(myFocaccia)} 🫓</span> • <span className="text-cyan-300 font-semibold">{myDiamonds} 💎</span>
              </div>
            </div>
            <button
              onClick={handleToggleLock}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 border shadow-sm",
                myLocked
                  ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30"
                  : "bg-stone-800 hover:bg-stone-700 text-amber-300 border-stone-700"
              )}
            >
              <span>{myLocked ? '🔓 Змінити' : '🔒 Зафіксувати'}</span>
            </button>
          </div>

          {/* Focaccia Offer Input */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1.5">
              <span className="flex items-center gap-1">🫓 Фокачі:</span>
              <span className="text-amber-400 font-mono">{formatNum(focOffer)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                disabled={myLocked}
                min={0}
                max={myFocaccia}
                value={focOffer === 0 ? '' : focOffer}
                placeholder="0"
                onChange={(e) => {
                  const val = Math.max(0, Math.min(myFocaccia, parseInt(e.target.value, 10) || 0));
                  setFocOffer(val);
                }}
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm font-black text-amber-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
              <button
                disabled={myLocked}
                onClick={() => setFocOffer(0)}
                className="px-2.5 py-2 bg-stone-800/80 hover:bg-stone-700 text-stone-400 text-xs font-bold rounded-xl border border-stone-700 disabled:opacity-50"
              >
                0
              </button>
            </div>
            {/* Quick buttons */}
            {!myLocked && (
              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-1">
                {[10000, 100000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    disabled={myFocaccia < amt}
                    onClick={() => {
                      setFocOffer((prev) => Math.min(myFocaccia, prev + amt));
                      haptic.light();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-800/60 hover:bg-stone-800 text-[10px] text-amber-300 font-semibold border border-stone-700/60 shrink-0 disabled:opacity-40"
                  >
                    +{formatNum(amt)}
                  </button>
                ))}
                <button
                  onClick={() => { setFocOffer(myFocaccia); haptic.light(); }}
                  className="px-2 py-0.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-[10px] text-amber-300 font-bold border border-amber-600/40 shrink-0 ml-auto"
                >
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Diamonds Offer Input */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1.5">
              <span className="flex items-center gap-1">💎 Алмази:</span>
              <span className="text-cyan-400 font-mono">{diaOffer} 💎</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                disabled={myLocked}
                min={0}
                max={myDiamonds}
                value={diaOffer === 0 ? '' : diaOffer}
                placeholder="0"
                onChange={(e) => {
                  const val = Math.max(0, Math.min(myDiamonds, parseInt(e.target.value, 10) || 0));
                  setDiaOffer(val);
                }}
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm font-black text-cyan-200 placeholder-stone-600 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
              <button
                disabled={myLocked}
                onClick={() => setDiaOffer(0)}
                className="px-2.5 py-2 bg-stone-800/80 hover:bg-stone-700 text-stone-400 text-xs font-bold rounded-xl border border-stone-700 disabled:opacity-50"
              >
                0
              </button>
            </div>
            {/* Quick buttons */}
            {!myLocked && (
              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-1">
                {[5, 25, 100].map((amt) => (
                  <button
                    key={amt}
                    disabled={myDiamonds < amt}
                    onClick={() => {
                      setDiaOffer((prev) => Math.min(myDiamonds, prev + amt));
                      haptic.light();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-800/60 hover:bg-stone-800 text-[10px] text-cyan-300 font-semibold border border-stone-700/60 shrink-0 disabled:opacity-40"
                  >
                    +{amt} 💎
                  </button>
                ))}
                <button
                  onClick={() => { setDiaOffer(myDiamonds); haptic.light(); }}
                  className="px-2 py-0.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-[10px] text-cyan-300 font-bold border border-cyan-600/40 shrink-0 ml-auto"
                >
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Skins in Offer */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-300 mb-2">
              <span className="flex items-center gap-1">🎨 Обрані скіни ({selectedSkins.length}):</span>
              {!myLocked && (
                <button
                  onClick={() => { setSkinModalOpen(true); haptic.light(); }}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>+ Додати скін</span>
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1 min-h-[90px] max-h-[220px] overflow-y-auto pr-1">
              {selectedSkins.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 border border-dashed border-stone-800 rounded-xl text-center text-xs text-stone-500">
                  <span>Скіни не обрано</span>
                  {!myLocked && <span className="text-[10px] text-amber-400/80 mt-1 cursor-pointer" onClick={() => setSkinModalOpen(true)}>Натисни тут, щоб обрати скін з інвентарю</span>}
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

        {/* === RIGHT CARD: PARTNER'S OFFER === */}
        <div className={cn(
          "bg-stone-900/70 border rounded-2xl p-4 flex flex-col backdrop-blur-sm transition-all",
          oppLocked ? "border-emerald-600/40 shadow-lg shadow-emerald-950/20" : "border-stone-800",
          activeTab === 'partner' ? "block" : "hidden md:flex"
        )}>
          <div className="flex items-center justify-between pb-3 border-b border-stone-800/80 mb-3">
            <div>
              <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <span>📥 ПРОПОЗИЦІЯ ПАРТНЕРА</span>
                {oppLocked ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40 font-bold">ЗАФІКСОВАНО</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 font-semibold">ОБИРАЄ...</span>
                )}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">
                Гравець: <span className="text-amber-200 font-bold">{opp ? opp.name : 'Очікування...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {opp?.confirmed ? (
                <span className="text-emerald-400 font-black flex items-center gap-1">
                  <span>✅</span> Підтверджено
                </span>
              ) : oppLocked ? (
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <span>🔒</span> Зафіксовано
                </span>
              ) : (
                <span className="text-stone-500 font-semibold">Редагує</span>
              )}
            </div>
          </div>

          {/* Partner Focaccia & Diamonds displays */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-stone-400 mb-0.5">Фокачі 🫓</div>
              <div className="text-base font-black text-amber-300 font-mono">
                {opp?.offer?.focaccia ? formatNum(opp.offer.focaccia) : '0'}
              </div>
            </div>
            <div className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-stone-400 mb-0.5">Алмази 💎</div>
              <div className="text-base font-black text-cyan-300 font-mono">
                {opp?.offer?.diamonds || 0} 💎
              </div>
            </div>
          </div>

          {/* Partner Skins */}
          <div className="flex-1 flex flex-col">
            <div className="text-[11px] font-bold text-stone-300 mb-2">
              🎨 Скіни від партнера ({opp?.offer?.skins?.length || 0}):
            </div>
            <div className="space-y-2 flex-1 min-h-[90px] max-h-[220px] overflow-y-auto pr-1">
              {(!opp?.offer?.skins || opp.offer.skins.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center p-4 border border-dashed border-stone-800 rounded-xl text-center text-xs text-stone-500">
                  <span>Партнер ще не запропонував скінів</span>
                </div>
              ) : (
                opp.offer.skins.map((sk) => renderSkinCard(sk))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Area */}
      <div className="sticky bottom-0 bg-[#0d0a07]/95 backdrop-blur-md border-t border-stone-800/80 p-4 flex flex-col gap-2.5 max-w-2xl mx-auto w-full">
        {/* Status Prompt */}
        <div className="text-center text-xs font-semibold">
          {!opp ? (
            <span className="text-amber-400 animate-pulse">Очікування підключення другого гравця...</span>
          ) : !myLocked ? (
            <span className="text-stone-300">Налаштуй свою пропозицію та натисни <strong className="text-amber-300">🔒 Зафіксувати</strong></span>
          ) : !oppLocked ? (
            <span className="text-amber-300/90 animate-pulse">Очікуємо, поки {opp.name} зафіксує свою пропозицію...</span>
          ) : bothLocked && !me?.confirmed ? (
            <span className="text-emerald-300 font-bold">Обидві сторони готові! Перевір предмети та підтверди обмін.</span>
          ) : (
            <span className="text-cyan-300 font-bold">Очікування фінального підтвердження від {opp.name}...</span>
          )}
        </div>

        {/* Action Button */}
        <button
          disabled={!bothLocked || !!me?.confirmed}
          onClick={() => {
            setConfirmModalOpen(true);
            haptic.medium();
          }}
          className={cn(
            "w-full py-3.5 rounded-2xl text-base font-black transition-all flex items-center justify-center gap-2 shadow-lg",
            bothLocked && !me?.confirmed
              ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-stone-950 shadow-emerald-500/30 hover:scale-[1.01] active:scale-95 animate-pulse"
              : me?.confirmed
              ? "bg-emerald-950 border border-emerald-500/50 text-emerald-400 opacity-90 cursor-default"
              : "bg-stone-800 text-stone-500 border border-stone-700/50 opacity-60 cursor-not-allowed"
          )}
        >
          {me?.confirmed ? (
            <>
              <span>⏳</span> Твоє підтвердження прийнято!
            </>
          ) : (
            <>
              <span>🤝</span> ПІДТВЕРДИТИ ОБМІН
            </>
          )}
        </button>
      </div>

      {/* MODAL 1: Skin Inventory Picker */}
      {skinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
              <div className="text-base font-black text-amber-200 flex items-center gap-2">
                <span>🎨</span> Твій Інвентар Скінів
              </div>
              <button
                onClick={() => setSkinModalOpen(false)}
                className="w-7 h-7 rounded-full bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs: Bread Skins vs Cat Skins */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSkinTab('bread')}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border",
                  skinTab === 'bread'
                    ? "bg-amber-600/20 border-amber-500/50 text-amber-300"
                    : "bg-stone-950 border-stone-800 text-stone-400"
                )}
              >
                🫓 Скіни Фокачі
              </button>
              <button
                onClick={() => setSkinTab('cat')}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border",
                  skinTab === 'cat'
                    ? "bg-amber-600/20 border-amber-500/50 text-amber-300"
                    : "bg-stone-950 border-stone-800 text-stone-400"
                )}
              >
                🐱 Скіни Кота
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {skinTab === 'bread' ? (
                // Filter out classic skin (classic cannot be traded)
                myOwnedSkins.filter((sk) => sk !== 'skin_classic').length === 0 ? (
                  <div className="py-10 text-center text-stone-500 text-xs">
                    У тебе немає доступних для обміну скінів фокачі.
                    <div className="text-[10px] text-stone-600 mt-1">(Базова фокача є невід'ємною)</div>
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
                          "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                          isSelected
                            ? "bg-amber-950/50 border-amber-500 shadow-md shadow-amber-950/30"
                            : "bg-stone-950/60 border-stone-800 hover:border-stone-700"
                        )}
                      >
                        <div className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-700 overflow-hidden shrink-0 flex items-center justify-center">
                          <img src={skin.img} alt={skin.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-amber-100 truncate">{skin.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("text-[9px] px-1.5 py-0.2 rounded font-semibold", rarity?.color)}>
                              {rarity?.uk}
                            </span>
                            <span className="text-[10px] text-stone-400 truncate">{skin.bonusDesc}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center border text-xs font-bold transition-all shrink-0",
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
                // Cat skins (exclude default murchik)
                myOwnedCatSkins.filter((sk) => sk !== 'murchik').length === 0 ? (
                  <div className="py-10 text-center text-stone-500 text-xs">
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
                          "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                          isSelected
                            ? "bg-amber-950/50 border-amber-500 shadow-md shadow-amber-950/30"
                            : "bg-stone-950/60 border-stone-800 hover:border-stone-700"
                        )}
                      >
                        <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-600/50 flex items-center justify-center text-2xl shrink-0">
                          🐱
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-amber-100 truncate">{cat.nameUk}</div>
                          <div className="text-[10px] text-amber-400/80 font-medium truncate">{cat.breedUk}</div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center border text-xs font-bold transition-all shrink-0",
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
              onClick={() => { setSkinModalOpen(false); haptic.medium(); }}
              className="mt-4 w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-stone-950 font-black rounded-xl text-sm"
            >
              Зберегти вибір ({selectedSkins.length})
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: 2-Step Safety Verification Confirm Dialog */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-stone-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl animate-bob text-center">
            <div className="text-4xl mb-2">⚖️</div>
            <h3 className="text-lg font-black text-amber-200 mb-1">Підтвердження Трейду</h3>
            <p className="text-xs text-stone-400 mb-4">
              Уважно перевір обидві пропозиції. Після підтвердження операція є безповоротною!
            </p>

            <div className="space-y-2.5 text-left text-xs mb-5">
              <div className="bg-rose-950/40 border border-rose-600/40 rounded-xl p-3">
                <div className="font-bold text-rose-300 mb-1">📤 Ти передаєш:</div>
                <div className="text-stone-300">
                  {focOffer > 0 && <div>• {formatNum(focOffer)} 🫓 фокач</div>}
                  {diaOffer > 0 && <div>• {diaOffer} 💎 алмазів</div>}
                  {selectedSkins.length > 0 && (
                    <div>• Скіни: {selectedSkins.map((s) => SKINS[s.replace('cat:', '')]?.name || s).join(', ')}</div>
                  )}
                  {focOffer === 0 && diaOffer === 0 && selectedSkins.length === 0 && (
                    <div className="text-stone-500 italic">Нічого (подарунок)</div>
                  )}
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-xl p-3">
                <div className="font-bold text-emerald-300 mb-1">📥 Ти отримуєш:</div>
                <div className="text-stone-300">
                  {opp?.offer?.focaccia ? <div>• {formatNum(opp.offer.focaccia)} 🫓 фокач</div> : null}
                  {opp?.offer?.diamonds ? <div>• {opp.offer.diamonds} 💎 алмазів</div> : null}
                  {opp?.offer?.skins?.length ? (
                    <div>• Скіни: {opp.offer.skins.map((s) => SKINS[s.replace('cat:', '')]?.name || s).join(', ')}</div>
                  ) : null}
                  {!opp?.offer?.focaccia && !opp?.offer?.diamonds && !opp?.offer?.skins?.length && (
                    <div className="text-stone-500 italic">Нічого</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs"
              >
                Назад
              </button>
              <button
                disabled={confirmTimer > 0}
                onClick={handleFinalConfirm}
                className={cn(
                  "flex-1 py-3 font-black rounded-xl text-xs transition-all",
                  confirmTimer > 0
                    ? "bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 text-stone-950 hover:from-emerald-400 hover:to-teal-500 active:scale-95 shadow-lg shadow-emerald-600/30"
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
