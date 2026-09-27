import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ARCADE_ITEMS,
  type ArcadeItem,
  CHEF_WHEEL_SEGMENTS,
  type ChefWheelSegment,
} from './arcade';
import { cn } from '../utils/cn';
import { playSfx } from './sfx';

interface FlyingTarget {
  uid: number;
  item: ArcadeItem;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  opacity: number;
}

interface Point {
  x: number;
  y: number;
  time: number;
}

export type WheelCostType = 'free' | 'focaccia' | 'diamonds';

interface ArcadeSectionProps {
  onGameComplete: (rewards: {
    focaccia: number;
    diamonds: number;
    passXp: number;
    ingredients: Record<string, number>;
  }) => void;
  onSpinWheel: (segment: ChefWheelSegment, cost?: { type: WheelCostType; amount: number }) => void;
  playerFocaccia: number;
  playerDiamonds: number;
  currentCps: number;
  lang: 'uk' | 'ru';
}

const FREE_SPIN_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const EXTRA_SPIN_FOCACCIA_COST = 50000;
const EXTRA_SPIN_DIAMOND_COST = 2;
const STORAGE_FREE_SPIN_KEY = 'focaccia_wheel_last_free_ts';

export const ArcadeSection: React.FC<ArcadeSectionProps> = ({
  onGameComplete,
  onSpinWheel,
  playerFocaccia,
  playerDiamonds,
  currentCps,
  lang,
}) => {
  const [subTab, setSubTab] = useState<'rush' | 'wheel'>('rush');

  /* ---- OVEN RUSH MINIGAME STATE ---- */
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [targets, setTargets] = useState<FlyingTarget[]>([]);
  const [roundRewards, setRoundRewards] = useState<{
    focaccia: number;
    diamonds: number;
    passXp: number;
    ingredients: Record<string, number>;
  } | null>(null);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const [sliceTrail, setSliceTrail] = useState<Point[]>([]);
  const isPointerDownRef = useRef(false);

  const gatheredIngs = useRef<Record<string, number>>({});
  const gatheredDia = useRef(0);
  const nextUid = useRef(1);

  // Wheel State
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelResult, setWheelResult] = useState<ChefWheelSegment | null>(null);
  const [lastFreeSpinTs, setLastFreeSpinTs] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FREE_SPIN_KEY);
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
    }
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeSinceFree = now - lastFreeSpinTs;
  const isFreeSpinReady = timeSinceFree >= FREE_SPIN_COOLDOWN_MS;
  const freeSpinCooldownRemSec = isFreeSpinReady
    ? 0
    : Math.ceil((FREE_SPIN_COOLDOWN_MS - timeSinceFree) / 1000);

  const formatCooldown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const endGame = useCallback(() => {
    setIsPlaying(false);
    setTargets([]);
    setSliceTrail([]);

    // Calculate final rewards
    const comboBonus = 1 + combo * 0.05;
    const baseReward = Math.max(5000, Math.floor((currentCps * 12 + score) * comboBonus));
    const rewards = {
      focaccia: baseReward,
      diamonds: gatheredDia.current,
      passXp: 25,
      ingredients: { ...gatheredIngs.current },
    };

    setRoundRewards(rewards);
    onGameComplete(rewards);
  }, [combo, currentCps, onGameComplete, score]);

  /* ---- MINIGAME GAME LOOP ---- */
  useEffect(() => {
    if (!isPlaying) return;

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Spawner
    const spawner = setInterval(() => {
      setTargets((prev) => {
        if (prev.length >= 6) return prev;
        const rand = Math.random();
        let chosenItem: ArcadeItem;
        if (rand < 0.15) {
          // bomb
          chosenItem = ARCADE_ITEMS.find((i) => i.type === 'bomb') || ARCADE_ITEMS[0];
        } else if (rand < 0.35) {
          // rare ingredient
          const ings = ARCADE_ITEMS.filter((i) => i.type === 'ingredient');
          chosenItem = ings[Math.floor(Math.random() * ings.length)];
        } else if (rand < 0.45) {
          // diamond
          chosenItem = ARCADE_ITEMS.find((i) => i.type === 'diamond') || ARCADE_ITEMS[0];
        } else if (rand < 0.60) {
          // golden
          chosenItem = ARCADE_ITEMS.find((i) => i.type === 'golden') || ARCADE_ITEMS[0];
        } else {
          // normal focaccia
          chosenItem = ARCADE_ITEMS.filter((i) => i.type === 'focaccia')[Math.floor(Math.random() * 3)];
        }

        const newTarget: FlyingTarget = {
          uid: nextUid.current++,
          item: chosenItem,
          x: 12 + Math.random() * 76,
          y: 18 + Math.random() * 60,
          scale: 1,
          opacity: 1,
        };
        return [...prev, newTarget];
      });
    }, 600);

    return () => {
      clearInterval(timer);
      clearInterval(spawner);
    };
  }, [isPlaying, endGame]);

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(30);
    setScore(0);
    setCombo(0);
    setHearts(3);
    setTargets([]);
    setRoundRewards(null);
    setSliceTrail([]);
    gatheredIngs.current = {};
    gatheredDia.current = 0;
  };

  const handleHitTarget = useCallback((t: FlyingTarget) => {
    if (!isPlaying) return;

    // Remove target
    setTargets((prev) => prev.filter((p) => p.uid !== t.uid));

    if (t.item.type === 'bomb') {
      playSfx('bomb');
      setHearts((h) => {
        const nextH = h - 1;
        if (nextH <= 0) endGame();
        return Math.max(0, nextH);
      });
      setCombo(0);
      return;
    }

    // Success slice hit
    playSfx('slice');
    setCombo((c) => {
      const nextCombo = c + 1;
      const comboMult = 1 + Math.min(20, nextCombo) * 0.1;
      setScore((s) => s + Math.floor(t.item.points * comboMult));
      return nextCombo;
    });

    if (t.item.ingredientId) {
      gatheredIngs.current[t.item.ingredientId] = (gatheredIngs.current[t.item.ingredientId] || 0) + 1;
    }
    if (t.item.diamonds) {
      gatheredDia.current += t.item.diamonds;
    }
  }, [isPlaying, endGame]);

  /* ---- SWIPE / SLICE TRAIL MECHANICS ---- */
  const checkSliceCollision = useCallback((px: number, py: number) => {
    if (!arenaRef.current || !isPlaying) return;
    const rect = arenaRef.current.getBoundingClientRect();
    const xPct = ((px - rect.left) / rect.width) * 100;
    const yPct = ((py - rect.top) / rect.height) * 100;

    // Check hit radius in percentage (~9% radius around target center)
    targets.forEach((t) => {
      const dx = t.x - xPct;
      const dy = t.y - yPct;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 9.5) {
        handleHitTarget(t);
      }
    });
  }, [handleHitTarget, isPlaying, targets]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = true;
    const pt = { x: e.clientX, y: e.clientY, time: Date.now() };
    setSliceTrail([pt]);
    checkSliceCollision(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const pt = { x: e.clientX, y: e.clientY, time: Date.now() };
    setSliceTrail((prev) => [...prev.slice(-6), pt]);
    checkSliceCollision(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    setTimeout(() => setSliceTrail([]), 150);
  };

  /* ---- CHEF WHEEL SPIN ---- */
  const handleSpinWheel = (forcedCostType?: WheelCostType) => {
    if (isSpinning) return;

    let cost: { type: WheelCostType; amount: number } | undefined;
    if (isFreeSpinReady && forcedCostType !== 'focaccia' && forcedCostType !== 'diamonds') {
      cost = { type: 'free', amount: 0 };
      const nowTs = Date.now();
      setLastFreeSpinTs(nowTs);
      try {
        localStorage.setItem(STORAGE_FREE_SPIN_KEY, String(nowTs));
      } catch {}
    } else if (forcedCostType === 'diamonds' || (!isFreeSpinReady && playerFocaccia < EXTRA_SPIN_FOCACCIA_COST && playerDiamonds >= EXTRA_SPIN_DIAMOND_COST)) {
      if (playerDiamonds < EXTRA_SPIN_DIAMOND_COST) return;
      cost = { type: 'diamonds', amount: EXTRA_SPIN_DIAMOND_COST };
    } else {
      if (playerFocaccia < EXTRA_SPIN_FOCACCIA_COST) return;
      cost = { type: 'focaccia', amount: EXTRA_SPIN_FOCACCIA_COST };
    }

    setIsSpinning(true);
    setWheelResult(null);

    const segmentIndex = Math.floor(Math.random() * CHEF_WHEEL_SEGMENTS.length);
    const degreesPerSlice = 360 / CHEF_WHEEL_SEGMENTS.length; // 45 deg

    // Center of sector segmentIndex is at: segmentIndex * 45 + 22.5 deg.
    // Desired rotation mod 360 to position sector under top pointer:
    const targetDegNormalized = (360 - ((segmentIndex * degreesPerSlice + degreesPerSlice / 2) % 360)) % 360;
    const currentNorm = ((wheelAngle % 360) + 360) % 360;
    let forwardDeg = (targetDegNormalized - currentNorm + 360) % 360;
    if (forwardDeg < 90) forwardDeg += 360;
    const totalRotation = 5 * 360 + forwardDeg;

    setWheelAngle((prev) => prev + totalRotation);

    // Audio ticks during spin
    for (let i = 1; i <= 8; i++) {
      setTimeout(() => playSfx('wheel_tick'), i * 350);
    }

    setTimeout(() => {
      setIsSpinning(false);
      const chosen = CHEF_WHEEL_SEGMENTS[segmentIndex];
      setWheelResult(chosen);
      playSfx('wheel_win');
      onSpinWheel(chosen, cost);
    }, 3200);
  };

  return (
    <div className="space-y-4">
      {/* Player balance banner */}
      <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-200/80 px-3 py-1.5 bg-black/40 rounded-xl border border-white/5">
        <span>🫓 {Math.floor(playerFocaccia).toLocaleString()}</span>
        <span>💎 {playerDiamonds.toLocaleString()}</span>
      </div>

      {/* Sub Tabs: Pizza Oven Rush vs Chef Wheel */}
      <div className="flex gap-1.5 p-1 glass-card rounded-2xl border border-amber-500/20 bg-black/40">
        <button
          type="button"
          onClick={() => { setSubTab('rush'); setIsPlaying(false); }}
          className={cn(
            'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
            subTab === 'rush'
              ? 'bg-amber-500/25 border border-amber-400 text-amber-200 shadow-md'
              : 'text-amber-300/60 hover:text-amber-200'
          )}
        >
          <span>🍕</span>
          <span>{lang === 'uk' ? 'Кухня: Слайсер' : 'Кухня: Слайсер'}</span>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('wheel'); setIsPlaying(false); }}
          className={cn(
            'flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer relative',
            subTab === 'wheel'
              ? 'bg-amber-500/25 border border-amber-400 text-amber-200 shadow-md'
              : 'text-amber-300/60 hover:text-amber-200'
          )}
        >
          <span>🎡</span>
          <span>{lang === 'uk' ? 'Колесо Шефа' : 'Колесо Шефа'}</span>
          {isFreeSpinReady && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block absolute top-1 right-2" />
          )}
        </button>
      </div>

      {/* --- SUBTAB 1: OVEN RUSH SLICER --- */}
      {subTab === 'rush' && (
        <div className="space-y-3">
          {/* Header Banner */}
          <div className="glass-card rounded-2xl p-4 border border-amber-500/30 text-center relative overflow-hidden">
            <h3 className="text-base font-black text-amber-200">
              🍕 {lang === 'uk' ? 'Кулінарний Слайсер: Гаряча Піч' : 'Кулинарный Слайсер: Горячая Печь'}
            </h3>
            <p className="text-[11px] text-amber-300/70 mt-0.5">
              {lang === 'uk'
                ? 'Проводьте пальцем (свайпайте) або тапайте по випічці! Остерігайтеся вугликів 💣'
                : 'Проводите пальцем (свайпайте) или тапайте по выпечке! Остерегайтесь угольков 💣'}
            </p>
          </div>

          {/* ACTIVE PLAY AREA */}
          {isPlaying ? (
            <div
              ref={arenaRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative rounded-3xl border-2 border-amber-500/40 bg-zinc-950/90 h-[360px] overflow-hidden shadow-2xl select-none touch-none"
              style={{ touchAction: 'none' }}
            >
              {/* Slice SVG Trail */}
              {sliceTrail.length > 1 && arenaRef.current && (
                <svg className="absolute inset-0 pointer-events-none z-30 w-full h-full">
                  <polyline
                    points={sliceTrail
                      .map((p) => {
                        const rect = arenaRef.current?.getBoundingClientRect();
                        if (!rect) return '0,0';
                        return `${p.x - rect.left},${p.y - rect.top}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="filter drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] opacity-90"
                  />
                </svg>
              )}

              {/* Top HUD */}
              <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-20 text-xs font-black">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className="text-sm">
                      {i < hearts ? '❤️' : '🖤'}
                    </span>
                  ))}
                  {combo > 1 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono animate-pulse">
                      x{combo} COMBO!
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="font-mono text-amber-200 text-sm">{score.toLocaleString()} PTS</span>
                  <div className="text-[10px] text-red-400 font-mono">⏱️ {timeLeft}s</div>
                </div>
              </div>

              {/* Items arena */}
              <div className="absolute inset-0 pt-10 pb-4">
                {targets.map((t) => (
                  <button
                    key={t.uid}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHitTarget(t);
                    }}
                    style={{ left: `${t.x}%`, top: `${t.y}%` }}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 active:scale-125 cursor-pointer touch-none select-none',
                      t.item.type === 'bomb' ? 'animate-pulse text-4xl' : 'text-5xl animate-bounce'
                    )}
                  >
                    {t.item.icon}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-amber-500/30 bg-zinc-950/70 p-8 text-center space-y-4">
              <div className="text-6xl animate-bounce">👨‍🍳🍕</div>

              {roundRewards && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-left space-y-1.5 animate-fade-in">
                  <div className="text-xs font-black text-amber-200">
                    🎉 {lang === 'uk' ? 'Раунд завершено! Твої здобутки:' : 'Раунд завершён! Твоя добыча:'}
                  </div>
                  <div className="text-sm font-black text-amber-300 font-mono">
                    +{roundRewards.focaccia.toLocaleString()} 🫓 Фокач
                  </div>
                  {roundRewards.diamonds > 0 && (
                    <div className="text-xs font-black text-cyan-300 font-mono">
                      +{roundRewards.diamonds} 💎 Алмазів
                    </div>
                  )}
                  {Object.keys(roundRewards.ingredients).length > 0 && (
                    <div className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5 flex-wrap">
                      <span>{lang === 'uk' ? 'Інгредієнти:' : 'Ингредиенты:'}</span>
                      {Object.entries(roundRewards.ingredients).map(([id, cnt]) => (
                        <span key={id} className="px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/30">
                          {cnt} шт
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-purple-300 font-bold">
                    +{roundRewards.passXp} Baker Pass XP 🎫
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={startGame}
                  className="px-8 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition cursor-pointer"
                >
                  🚀 {lang === 'uk' ? 'ПОЧАТИ РАУНД (30 сек)' : 'НАЧАТЬ РАУНД (30 сек)'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 2: CHEF'S LUCKY WHEEL --- */}
      {subTab === 'wheel' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 border border-amber-500/30 text-center">
            <h3 className="text-base font-black text-amber-200">
              🎡 {lang === 'uk' ? 'Колесо Фортуни Шеф-Пекаря' : 'Колесо Фортуны Шеф-Пекаря'}
            </h3>
            <p className="text-[11px] text-amber-300/70 mt-0.5">
              {lang === 'uk'
                ? 'Крутіть барабан та вигравайте діаманти, зілля або рідкісні інгредієнти!'
                : 'Крутите барабан и выигрывайте алмазы, зелья или редкие ингредиенты!'}
            </p>
          </div>

          {/* Wheel Graphic */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-64 h-64">
              {/* Pointer Marker */}
              <div className="absolute left-1/2 -top-3 -translate-x-1/2 z-20 text-3xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                🔻
              </div>

              {/* Rotating Wheel Disc */}
              <div
                className="absolute inset-0 rounded-full border-4 border-amber-500/50 shadow-[0_0_40px_rgba(251,191,36,0.3)] transition-transform duration-[3200ms] ease-out overflow-hidden"
                style={{
                  transform: `rotate(${wheelAngle}deg)`,
                  background: 'conic-gradient(#f59e0b 0% 12.5%, #0ea5e9 12.5% 25%, #a855f7 25% 37.5%, #eab308 37.5% 50%, #ec4899 50% 62.5%, #10b981 62.5% 75%, #06b6d4 75% 87.5%, #f97316 87.5% 100%)',
                }}
              >
                {CHEF_WHEEL_SEGMENTS.map((seg, i) => {
                  const angle = (i * 360) / CHEF_WHEEL_SEGMENTS.length + 22.5;
                  return (
                    <div
                      key={seg.id}
                      className="absolute inset-0 flex items-start justify-center pt-3 pointer-events-none"
                      style={{ transform: `rotate(${angle}deg)` }}
                    >
                      <span className="text-xl filter drop-shadow">{seg.icon}</span>
                    </div>
                  );
                })}
              </div>

              {/* Wheel Center Button */}
              <button
                type="button"
                onClick={() => handleSpinWheel()}
                disabled={isSpinning || (!isFreeSpinReady && playerFocaccia < EXTRA_SPIN_FOCACCIA_COST && playerDiamonds < EXTRA_SPIN_DIAMOND_COST)}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-stone-900 border-2 border-amber-400 flex items-center justify-center font-black text-xs text-amber-200 shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition z-10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSpinning ? '...' : isFreeSpinReady ? 'FREE!' : 'SPIN!'}
              </button>
            </div>

            {/* Spin Buttons & Results */}
            <div className="mt-4 text-center space-y-2.5 w-full max-w-xs">
              {wheelResult && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400 text-xs font-black text-amber-200 animate-bounce">
                  🎉 {lang === 'uk' ? 'Виграш:' : 'Выигрыш:'}{' '}
                  {lang === 'uk' ? wheelResult.labelUk : wheelResult.labelRu}!
                </div>
              )}

              {isFreeSpinReady ? (
                <button
                  type="button"
                  onClick={() => handleSpinWheel('free')}
                  disabled={isSpinning}
                  className={cn(
                    'w-full py-2.5 rounded-xl font-black text-xs transition cursor-pointer shadow-lg',
                    !isSpinning
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 active:scale-95 shadow-emerald-500/30'
                      : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                  )}
                >
                  {isSpinning
                    ? (lang === 'uk' ? 'Обертання...' : 'Вращение...')
                    : '🎁 ' + (lang === 'uk' ? 'Безкоштовне обертання!' : 'Бесплатное вращение!')}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-amber-300/80">
                    ⏱️ {lang === 'uk' ? 'Безкоштовний спін через:' : 'Бесплатный спин через:'}{' '}
                    <span className="font-bold text-amber-200">{formatCooldown(freeSpinCooldownRemSec)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSpinWheel('focaccia')}
                      disabled={isSpinning || playerFocaccia < EXTRA_SPIN_FOCACCIA_COST}
                      className={cn(
                        'flex-1 py-2 rounded-xl font-black text-xs transition border cursor-pointer',
                        playerFocaccia >= EXTRA_SPIN_FOCACCIA_COST && !isSpinning
                          ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30 active:scale-95'
                          : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                      )}
                    >
                      <span>50,000 🫓</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSpinWheel('diamonds')}
                      disabled={isSpinning || playerDiamonds < EXTRA_SPIN_DIAMOND_COST}
                      className={cn(
                        'flex-1 py-2 rounded-xl font-black text-xs transition border cursor-pointer',
                        playerDiamonds >= EXTRA_SPIN_DIAMOND_COST && !isSpinning
                          ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/30 active:scale-95'
                          : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                      )}
                    >
                      <span>2 💎</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
