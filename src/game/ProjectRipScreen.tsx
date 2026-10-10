import React, { useState, useEffect, useMemo } from 'react';
import { playSfx } from './sfx';

interface ProjectRipScreenProps {
  lang: 'uk' | 'ru';
  isDev: boolean;
  respectsCount: number;
  onPayRespect: () => void;
  onOpenAdmin?: () => void;
}

interface FallingRose {
  id: number;
  left: number; // 0 - 100%
  duration: number; // seconds
  delay: number; // seconds
  size: number; // px
  rotationStart: number;
  rotationEnd: number;
  swayAmount: number; // px
  emoji: string;
  opacity: number;
}

interface PlacedRose {
  id: number;
  x: number; // % from left
  y: number; // % from top
  rotation: number;
  scale: number;
}

export const ProjectRipScreen: React.FC<ProjectRipScreenProps> = ({
  lang,
  isDev,
  respectsCount,
  onPayRespect,
  onOpenAdmin,
}) => {
  const [personalRespects, setPersonalRespects] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('focaccia_personal_respects')) || 0;
    } catch {
      return 0;
    }
  });

  const tombstoneTapsRef = React.useRef(0);
  const [placedRoses, setPlacedRoses] = useState<PlacedRose[]>([]);
  const [recentFPress, setRecentFPress] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; x: number; y: number }[]>([]);

  // Procedural random falling roses in the background
  const fallingRoses = useMemo<FallingRose[]>(() => {
    const list: FallingRose[] = [];
    const emojis = ['🥀', '🥀', '🥀', '🥀', '🌹', '🥀', '🍂', '🥀'];
    for (let i = 0; i < 24; i++) {
      list.push({
        id: i,
        left: (i * 4.2 + (i % 3) * 1.5) % 100,
        duration: 5.5 + ((i * 1.7) % 4.5),
        delay: ((i * 1.3) % 6),
        size: 16 + ((i * 3) % 18),
        rotationStart: (i * 35) % 360,
        rotationEnd: ((i * 35) % 360) + (i % 2 === 0 ? 360 : -360),
        swayAmount: 18 + ((i * 7) % 24),
        emoji: emojis[i % emojis.length],
        opacity: 0.45 + ((i % 5) * 0.1),
      });
    }
    return list;
  }, []);

  // Handle Press F
  const handlePressF = (e?: React.MouseEvent | React.TouchEvent) => {
    try {
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
      }
    } catch {}

    playSfx('funeral_bell');
    setTimeout(() => playSfx('rose_drop'), 180);

    setRecentFPress(true);
    setTimeout(() => setRecentFPress(false), 350);

    const nextPersonal = personalRespects + 1;
    setPersonalRespects(nextPersonal);
    try {
      localStorage.setItem('focaccia_personal_respects', String(nextPersonal));
    } catch {}

    onPayRespect();

    // Spawn placed rose on grave
    const clickX = e && 'clientX' in e ? e.clientX : window.innerWidth / 2;
    const clickY = e && 'clientY' in e ? e.clientY : window.innerHeight * 0.65;

    const newPlacedRose: PlacedRose = {
      id: Date.now() + Math.random(),
      x: 35 + Math.random() * 30, // scatter near tombstone base
      y: 72 + Math.random() * 12,
      rotation: -45 + Math.random() * 90,
      scale: 0.85 + Math.random() * 0.4,
    };
    setPlacedRoses((prev) => [...prev.slice(-18), newPlacedRose]);

    // Spawn floating respect badge
    const newFloat = { id: Date.now() + Math.random(), x: clickX, y: clickY };
    setFloatingTexts((prev) => [...prev, newFloat]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((f) => f.id !== newFloat.id));
    }, 1200);
  };

  // Keyboard 'F' or 'f' listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
        handlePressF();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [personalRespects]);

  // Secret admin unlock via tombstone taps
  const handleTombstoneClick = () => {
    tombstoneTapsRef.current += 1;
    if (tombstoneTapsRef.current >= 5) {
      tombstoneTapsRef.current = 0;
      if (onOpenAdmin) onOpenAdmin();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#07070a] text-zinc-100 select-none overflow-hidden flex flex-col items-center justify-between p-4 sm:p-6 font-sans">
      {/* Background Ambience: Vignette & Graveyard Mist */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-80" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-950/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black via-zinc-950/80 to-transparent pointer-events-none z-10" />

      {/* Floating Fog Drift */}
      <div className="absolute bottom-6 left-[-20%] w-[140%] h-32 bg-indigo-950/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Falling Wilted Roses (🥀) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {fallingRoses.map((rose) => (
          <div
            key={rose.id}
            className="absolute will-change-transform"
            style={{
              left: `${rose.left}%`,
              top: '-8%',
              fontSize: `${rose.size}px`,
              opacity: rose.opacity,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.8)) hue-rotate(-20deg) brightness(0.85)',
              animation: `fallSway ${rose.duration}s cubic-bezier(0.25, 0.1, 0.25, 1) infinite`,
              animationDelay: `${rose.delay}s`,
            }}
          >
            {rose.emoji}
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <div className="relative z-30 w-full max-w-md flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] text-zinc-400 font-mono backdrop-blur-md">
          <span>🕯️</span>
          <span>{lang === 'uk' ? 'Свічки пам’яті' : 'Свечи памяти'}</span>
        </div>

        {/* Admin Secret / Emergency Controls */}
        {isDev && onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-3 py-1 rounded-full bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-lg shadow-red-950/60 flex items-center gap-1.5"
          >
            <span>👑</span>
            <span>{lang === 'uk' ? 'Адмін-панель' : 'Админ-панель'}</span>
          </button>
        )}
      </div>

      {/* Center Monument / Tombstone Area */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-center w-full max-w-sm my-auto">
        {/* Sombre Memorial Candles on Background */}
        <div className="w-full flex items-center justify-between px-6 -mb-4 z-20 pointer-events-none">
          {/* Left Candle Group */}
          <div className="flex items-end gap-1.5">
            <div className="flex flex-col items-center">
              <span className="text-xl animate-candle-flicker">🕯️</span>
              <div className="w-2.5 h-1 bg-amber-500/30 rounded-full blur-sm" />
            </div>
            <div className="flex flex-col items-center opacity-85">
              <span className="text-2xl animate-candle-flicker-slow">🕯️</span>
              <div className="w-3 h-1.5 bg-amber-500/40 rounded-full blur-sm" />
            </div>
          </div>

          {/* Right Candle Group */}
          <div className="flex items-end gap-1.5">
            <div className="flex flex-col items-center opacity-85">
              <span className="text-2xl animate-candle-flicker">🕯️</span>
              <div className="w-3 h-1.5 bg-amber-500/40 rounded-full blur-sm" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl animate-candle-flicker-slow">🕯️</span>
              <div className="w-2.5 h-1 bg-amber-500/30 rounded-full blur-sm" />
            </div>
          </div>
        </div>

        {/* The Gothic Tombstone (🪦) */}
        <div
          onClick={handleTombstoneClick}
          className="relative w-56 sm:w-64 bg-gradient-to-b from-[#2a2b33] via-[#1a1b22] to-[#121318] border-2 border-zinc-600/60 rounded-t-[70px] shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_2px_8px_rgba(255,255,255,0.15)] flex flex-col items-center pt-6 pb-7 px-4 text-center cursor-pointer transition active:scale-[0.99] select-none"
        >
          {/* Subtle Moss / Weathering Overlay */}
          <div className="absolute top-0 right-4 text-xs opacity-40 pointer-events-none">🌿</div>
          <div className="absolute bottom-2 left-3 text-xs opacity-30 pointer-events-none">🌿</div>

          {/* Cross at Top */}
          <div className="text-zinc-400 font-serif text-3xl font-bold tracking-widest mb-1 drop-shadow-md">
            †
          </div>

          {/* R.I.P */}
          <div className="text-zinc-300 font-serif tracking-[0.3em] font-black text-xl mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            R. I. P.
          </div>

          {/* Project Name */}
          <div className="text-amber-200/90 font-black text-xs tracking-wider uppercase mb-1 drop-shadow">
            FOCACCIA CLICKER
          </div>

          {/* Epoch Years */}
          <div className="text-zinc-500 font-mono text-[10px] tracking-widest font-semibold mb-3">
            2024 — 2026
          </div>

          {/* Divider */}
          <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-zinc-500/40 to-transparent mb-3" />

          {/* Epitaph */}
          <p className="text-[11px] font-serif italic text-zinc-400 leading-relaxed max-w-[190px]">
            {lang === 'uk'
              ? '«Тут спочиває найвеличніша пекарня нашого часу...»'
              : '«Здесь покоится величайшая пекарня нашего времени...»'}
          </p>

          <p className="text-[9px] text-zinc-500 font-sans mt-2">
            {lang === 'uk'
              ? 'Земля тобі пухким тістом та золотою скоринкою'
              : 'Земля тебе пышным тестом и золотой корочкой'}
          </p>

          {/* Tombstone Base Glow */}
          <div className="absolute -bottom-3 inset-x-2 h-4 bg-black/90 rounded-full blur-md" />
        </div>

        {/* Earth & Fresh Roses Mound at the foot of the grave */}
        <div className="relative -mt-3 w-64 sm:w-72 h-14 bg-gradient-to-t from-stone-950 via-[#181310] to-transparent rounded-full flex items-center justify-center overflow-visible z-30 pointer-events-none">
          <div className="flex items-center gap-1 text-2xl -mt-2 opacity-95">
            <span className="rotate-[-20deg]">🥀</span>
            <span className="rotate-[15deg]">🥀</span>
            <span className="rotate-[-35deg]">🥀</span>
            <span className="rotate-[10deg] text-3xl">🥀</span>
            <span className="rotate-[-10deg]">🥀</span>
          </div>

          {/* Dynamically Placed Roses when pressing F */}
          {placedRoses.map((r) => (
            <span
              key={r.id}
              className="absolute text-xl pointer-events-none animate-fade-in"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                transform: `rotate(${r.rotation}deg) scale(${r.scale})`,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
              }}
            >
              🥀
            </span>
          ))}
        </div>

        {/* Sombre Titles & Eulogy */}
        <div className="mt-5 text-center space-y-2 max-w-xs">
          <div className="inline-block px-3 py-0.5 rounded-full bg-red-950/70 border border-red-500/40 text-red-300 font-black text-xs uppercase tracking-widest shadow-md shadow-red-950/40">
            {lang === 'uk' ? '☠️ Проєкт помер' : '☠️ Проект умер'}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-wide font-serif">
            {lang === 'uk'
              ? 'Проєкт закрито на невизначений період'
              : 'Проект закрыт на неопределённый период'}
          </h1>

          <p className="text-xs text-zinc-400/90 leading-relaxed font-sans">
            {lang === 'uk'
              ? 'Печі охололи. Борошно розвіялося холодним вітром. Мурчик востаннє згорнувся біля згаслого вогнища... Дякуємо кожному пекарю за теплі спогади та кожен спечений шматочок.'
              : 'Печи остыли. Мука развеялась холодным ветром. Мурчик в последний раз свернулся у угасшего очага... Спасибо каждому пекарю за теплые воспоминания и каждый испеченный кусочек.'}
          </p>
        </div>
      </div>

      {/* Floating Respect indicators */}
      {floatingTexts.map((f) => (
        <div
          key={f.id}
          className="fixed pointer-events-none z-50 text-base font-black text-rose-300 flex items-center gap-1 animate-float-up"
          style={{ left: f.x - 40, top: f.y - 40 }}
        >
          <span>🥀</span>
          <span>+1 Respect</span>
        </div>
      ))}

      {/* Bottom Action Area: PRESS F BUTTON */}
      <div className="relative z-30 w-full max-w-sm flex flex-col items-center gap-3 pb-2">
        {/* Respects Counter */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900/90 border border-white/10 shadow-inner">
            <span className="text-rose-400">🥀</span>
            <span>{lang === 'uk' ? 'Віддано шану:' : 'Почтили память:'}</span>
            <strong className="text-rose-200 font-black text-sm tabular-nums">
              {(respectsCount + personalRespects).toLocaleString()}
            </strong>
          </div>
        </div>

        {/* The Legendary PRESS F Button */}
        <button
          type="button"
          onClick={handlePressF}
          className={`relative w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg transition-all transform active:scale-95 cursor-pointer shadow-2xl flex items-center justify-center gap-3 border ${
            recentFPress
              ? 'bg-rose-950 border-rose-500 text-rose-100 shadow-[0_0_35px_rgba(244,63,94,0.6)] scale-[0.98]'
              : 'bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 hover:from-zinc-800 hover:to-zinc-850 border-zinc-600/60 text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
          }`}
        >
          {/* Keycap styling badge */}
          <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-zinc-500/60 font-mono font-black text-sm text-zinc-200 shadow-inner">
            F
          </span>

          <span className="tracking-wide">
            {lang === 'uk' ? 'PRESS F TO PAY RESPECTS' : 'PRESS F TO PAY RESPECTS'}
          </span>

          <span className="text-2xl animate-bounce">🥀</span>
        </button>

        <p className="text-[10px] text-zinc-500 tracking-wider font-mono text-center">
          {lang === 'uk'
            ? 'Натисніть F на клавіатурі або торкніться кнопки'
            : 'Нажмите F на клавиатуре или коснитесь кнопки'}
        </p>
      </div>

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes fallSway {
          0% {
            transform: translateY(-5vh) rotate(0deg) translateX(0px);
            opacity: 0;
          }
          10% {
            opacity: 0.85;
          }
          50% {
            transform: translateY(50vh) rotate(180deg) translateX(25px);
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(105vh) rotate(360deg) translateX(-15px);
            opacity: 0;
          }
        }
        @keyframes candleFlicker {
          0%, 100% {
            transform: scale(1) translateY(0);
            opacity: 0.95;
            filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.7));
          }
          30% {
            transform: scale(1.08, 0.94) translateY(-1px);
            opacity: 1;
            filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.9));
          }
          65% {
            transform: scale(0.96, 1.04) translateY(1px);
            opacity: 0.85;
            filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.6));
          }
        }
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.9);
            opacity: 1;
          }
          100% {
            transform: translateY(-45px) scale(1.15);
            opacity: 0;
          }
        }
        .animate-candle-flicker {
          animation: candleFlicker 1.8s ease-in-out infinite;
        }
        .animate-candle-flicker-slow {
          animation: candleFlicker 2.4s ease-in-out infinite reverse;
        }
        .animate-float-up {
          animation: floatUp 1.1s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }
        .bg-radial-vignette {
          background: radial-gradient(circle at center, rgba(18, 14, 24, 0.4) 0%, rgba(7, 7, 10, 0.95) 85%);
        }
      `}</style>
    </div>
  );
};
