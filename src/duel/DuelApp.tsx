import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';

const API = 'https://focaccia-bot.vercel.app/api/duel';
const GOAL = 100;
const LIMIT_MS = 15 * 60 * 1000;

type Snap = {
  ok?: boolean;
  error?: string;
  stage: 'challenge' | 'accepted' | 'countdown' | 'live' | 'paused' | 'finished' | 'cancelled';
  me?: { id: string; name: string; score: number };
  opp?: { id: string; name: string; score: number; missing?: boolean };
  goal?: number;
  startTs?: number;
  elapsed?: number;
  limit?: number;
  serverNow?: number;
  winner?: string | null;
  reason?: string | null;
  pausedLeft?: number;
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function DuelApp({ duelId }: { duelId: string }) {
  const tg = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
  const meId = String(tg?.initDataUnsafe?.user?.id || '');
  const myName = String(tg?.initDataUnsafe?.user?.first_name || 'Гравець');
  const myU = String(tg?.initDataUnsafe?.user?.username || '');

  const [stage, setStage] = useState('…');
  const [base, setBase] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [oppName, setOppName] = useState('Соперник');
  const [oppU, setOppU] = useState('');
  const [pending, setPending] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pausedLeft, setPausedLeft] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [startTs, setStartTs] = useState(0);
  const [error, setError] = useState('');
  const [, forceTick] = useState(0);

  const pendingRef = useRef(0);
  const inFlight = useRef(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  // счёт = серверный + неотправленные
  const displayScore = base + pending;

  // цикл синхронизации с сервером (1 раз в ~900мс)
  useEffect(() => {
    if (!duelId || !meId) return;
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
          body: JSON.stringify({ action: 'sync', duelId, userId: meId, delta }),
        });
        const data: Snap = await res.json();
        if (data.ok === false && data.error) {
          setError(data.error === 'not a player' ? 'Ты не участник этой дуэли' : 'Дуэль не найдена');
          setStage('error');
          return;
        }
        if (typeof data.serverNow === 'number') {
          offsetRef.current = data.serverNow - Date.now();
          setOffset(offsetRef.current);
        }
        if (typeof data.startTs === 'number' && data.startTs > 0) setStartTs(data.startTs);
        if (data.me) setBase(data.me.score);
        if (data.opp) {
          setOppScore(data.opp.score);
          setOppName(data.opp.name || 'Соперник');
          setOppU(data.opp.u || '');
        }
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
  }, [duelId, meId]);

  // локальный тик: перерисовка таймера/отсчёта 10 раз в секунду
  useEffect(() => {
    const iv = setInterval(() => forceTick((v) => v + 1), 100);
    return () => clearInterval(iv);
  }, []);

  const nowAligned = () => Date.now() + offsetRef.current;

  const handleTap = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.nativeEvent.isTrusted) return;
    if (stage !== 'live') return;
    setPending((p) => p + 1);
    pendingRef.current += 1;
    navigator.vibrate?.(8);
  };

  const closeApp = () => {
    try { tg?.close(); } catch { window.close(); }
  };

  // ===== ОШИБКА / НЕ УЧАСТНИК =====
  if (error) {
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🔒</div>
          <p className="text-amber-200 font-bold">{error}</p>
        </div>
      </div>
    );
  }

  // ===== БЕЗ TG / БЕЗ ID ДУЭЛИ =====
  if (!meId || !duelId) {
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-3">⚔️</div>
          <p className="text-amber-200 font-bold mb-2">Дуэль</p>
          <p className="text-amber-300/60 text-sm">Открой дуэль через кнопку в боте</p>
        </div>
      </div>
    );
  }

  const liveNow = stage === 'live';
  const msToStart = stage === 'countdown' && startTs ? Math.max(0, startTs - nowAligned()) : 0;
  const countdownN = Math.ceil(msToStart / 1000);
  const elapsed = startTs && (stage === 'live' || stage === 'paused') ? Math.max(0, nowAligned() - startTs) : 0;

  // Интро: фазовая машина (детерминированная, без CSS-задержек)
  // p1: мой аватар влетает (1.1с) → p2: аватар соперника (1.1с) → vs: VS (1.4с) → fade: затухание (0.6с)
  const [introPhase, setIntroPhase] = useState<'' | 'p1' | 'p2' | 'vs' | 'fade'>('');
  const introStartedFor = useRef('');

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

  // аватарка: фото Telegram если есть, иначе кружок с инициалом
  const myPhoto = (tg?.initDataUnsafe?.user as { photo_url?: string } | undefined)?.photo_url;
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

  // ===== ФИНАЛ =====
  if (stage === 'finished') {
    const iWin = winner === meId;
    const draw = winner === 'draw';
    const reasonText =
      reason === 'cheat' ? (iWin ? '⚠️ Соперник использовал стороннее ПО' : '🚫 Обнаружено стороннее ПО') :
      reason === 'forfeit' ? '🏃 Соперник покинул дуэль' :
      reason === 'time' ? '⏱ Время вышло' :
      '⚡ Кто быстрее — 100 фокач!';
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center p-6">
        <div className="text-center w-full max-w-xs">
          <div className="text-7xl mb-3">{draw ? '🤝' : iWin ? '🏆' : '💔'}</div>
          <h1 className={cn('text-3xl font-black mb-2', draw ? 'text-amber-200' : iWin ? 'text-emerald-300' : 'text-red-300')}>
            {draw ? 'НИЧЬЯ' : iWin ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
          </h1>
          <p className="text-amber-300/70 text-sm mb-4">{reasonText}</p>
          {!draw && !draw && reason === '100' && <p className="text-amber-200/70 text-xs mb-2">Кто первым накликал 100 фокач</p>}
          {iWin && <p className="text-emerald-300/80 text-sm mb-4">Награда: +5💎 (забери в основной игре)</p>}
          <div className="glass-card rounded-2xl p-3 mb-5 flex justify-between text-sm font-black">
            <span className="text-amber-200">{myName || 'Ты'}: {displayScore}</span>
            <span className="text-amber-400/70">{oppName}: {oppScore}</span>
          </div>
          <button onClick={closeApp} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold py-3 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/25">
            Выйти
          </button>
        </div>
      </div>
    );
  }

  // ===== ПАУЗА (соперник вышел) =====
  if (stage === 'paused') {
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-3 animate-bob">⏸</div>
          <h2 className="text-xl font-black text-amber-100 mb-2">Соперник вышел!</h2>
          <p className="text-amber-300/60 text-sm mb-4">Если он не вернётся — победа техническим нокаутом</p>
          <div className="text-5xl font-black text-red-300 tabular-nums">{Math.ceil(pausedLeft / 1000)}</div>
        </div>
      </div>
    );
  }

  // ===== ОЖИДАНИЕ ПОСЛЕ ПРИНЯТИЯ =====
  if (stage === 'accepted' || stage === 'challenge') {
    return (
      <div className="h-screen bg-[#0d0a04] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-3 animate-bob">⏳</div>
          <p className="text-amber-200 font-bold">Ожидаем соперника в игре…</p>
        </div>
      </div>
    );
  }

  // ===== ОСНОВНОЙ ЭКРАН: ОТСЧЁТ + БОЙ =====
  return (
    <div className="h-screen bg-[#0d0a04] text-amber-50 select-none overflow-hidden flex flex-col">
      {/* Верх: таймер + счёт */}
      <div className="shrink-0 glass border-b border-amber-500/15 px-4 py-2">
        <div className="flex justify-between items-center text-[11px] font-bold">
          <div className="text-center">
            <div className="text-emerald-300 font-black text-base tabular-nums">{displayScore}</div>
            <div className="text-amber-500/50">ТЫ</div>
          </div>
          <div className="text-center">
            <div className={cn('font-black tabular-nums text-sm', elapsed > LIMIT_MS * 0.8 ? 'text-red-300' : 'text-amber-200')}>
              ⏱ {fmt(LIMIT_MS - elapsed)} / 15:00
            </div>
            <div className="text-amber-500/40">до ничьей</div>
          </div>
          <div className="text-center">
            <div className="text-sky-300 font-black text-base tabular-nums">{oppScore}</div>
            <div className="text-amber-500/50 truncate max-w-[90px]">{oppName}</div>
          </div>
        </div>
      </div>

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
            <p className="text-amber-400/50 text-xs mt-2">Кто быстрее накликает {GOAL} фокач!</p>
          </div>
        </div>
      )}

      {/* Бой */}
      {liveNow && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
          <div className="relative">
            <button
              onPointerDown={handleTap}
              className="w-52 h-52 rounded-full overflow-hidden border-[6px] border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.4)] active:scale-90 transition-transform duration-75"
            >
              <span className="text-[7rem] leading-none">🫓</span>
            </button>
            {pending > 0 && (
              <div className="absolute -right-2 -top-2 bg-emerald-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                +{pending}
              </div>
            )}
          </div>
          <div className="text-3xl font-black tabular-nums text-amber-200">{displayScore} <span className="text-base text-amber-500/50">/ {GOAL}</span></div>
          <p className="text-amber-500/40 text-[11px]">Тапай как можно быстрее — счёт идёт на сервере</p>
        </div>
      )}

      {/* ожидание/countdown низ */}
      <div className="shrink-0 px-4 pb-4 text-center text-[10px] text-amber-500/30">
        TapSentinel v5 следит за честностью дуэли — автокликеры дисквалифицируются
      </div>
    </div>
  );
}
