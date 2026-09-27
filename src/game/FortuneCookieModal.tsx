import React, { useState, useEffect } from 'react';
import {
  Fortune,
  CookieReward,
  getRandomFortune,
  generateCookieReward,
  COOKIE_INSTANT_DIAMOND_COST,
} from './fortuneCookie';
import { playSfx } from './sfx';

interface FortuneCookieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward: (reward: CookieReward) => void;
  onInstantCrackWithDiamonds: () => boolean; // returns true if success
  playerDiamonds: number;
  currentCps: number;
  playerClickPower: number;
  isReady: boolean;
  cooldownRemainingMs: number;
  lang: 'uk' | 'ru';
}

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const FortuneCookieModal: React.FC<FortuneCookieModalProps> = ({
  isOpen,
  onClose,
  onClaimReward,
  onInstantCrackWithDiamonds,
  playerDiamonds,
  currentCps,
  playerClickPower,
  isReady,
  cooldownRemainingMs,
  lang,
}) => {
  const [phase, setPhase] = useState<'idle' | 'cracking' | 'revealed'>('idle');
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [reward, setReward] = useState<CookieReward | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhase('idle');
      setFortune(null);
      setReward(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCrackCookie = () => {
    if (phase !== 'idle') return;

    if (!isReady) {
      // Need diamonds to crack
      const success = onInstantCrackWithDiamonds();
      if (!success) return;
    }

    setPhase('cracking');
    playSfx('cookie_crack');

    // Generate outcome
    const f = getRandomFortune();
    const r = generateCookieReward(currentCps, playerClickPower);
    setFortune(f);
    setReward(r);

    setTimeout(() => {
      setPhase('revealed');
      playSfx('cookie_reward');
    }, 450);
  };

  const handleClaim = () => {
    if (reward) {
      onClaimReward(reward);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none safe-bottom animate-fade-in">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-stone-900 via-[#18140f] to-stone-950 border border-amber-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(251,191,36,0.25)] flex flex-col items-center text-center overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center text-sm font-black transition cursor-pointer active:scale-90"
        >
          ✕
        </button>

        {/* Title */}
        <div className="text-amber-400 text-xs font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <span>✨</span>
          <span>{lang === 'uk' ? 'Печиво Долі' : 'Печенье Судьбы'}</span>
          <span>✨</span>
        </div>
        <div className="text-stone-300/80 text-[11px] mb-4">
          {lang === 'uk'
            ? 'Традиційне печиво з мудрим прогнозом та нагородою'
            : 'Традиционное печенье с мудрым предсказанием и наградой'}
        </div>

        {/* Main Interactive Stage */}
        <div className="relative w-full min-h-[200px] flex flex-col items-center justify-center my-2">
          {phase === 'idle' && (
            <div className="flex flex-col items-center">
              {/* Cookie Button */}
              <button
                type="button"
                onClick={handleCrackCookie}
                className="relative group transition-transform active:scale-95 cursor-pointer"
                title={lang === 'uk' ? 'Натисни, щоб розламати!' : 'Нажми, чтобы разломить!'}
              >
                {/* Glow ring */}
                <div className="absolute inset-[-10px] rounded-full bg-amber-500/20 blur-xl group-hover:bg-amber-500/35 transition-all animate-pulse" />
                <div className="relative text-7xl select-none filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] animate-bob">
                  🥠
                </div>
              </button>

              <div className="mt-4 text-xs font-bold">
                {isReady ? (
                  <span className="text-amber-300 animate-pulse flex items-center gap-1">
                    <span>👆</span>
                    <span>{lang === 'uk' ? 'Торкнися печива, щоб зламати!' : 'Коснись печенья, чтобы разломить!'}</span>
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-stone-400">
                    <span className="text-[11px]">
                      {lang === 'uk' ? 'Безкоштовно через:' : 'Бесплатно через:'} <strong className="text-amber-300 font-mono">{formatMmSs(cooldownRemainingMs)}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === 'cracking' && (
            <div className="relative flex items-center justify-center py-6">
              {/* Splitting Cookie Pieces */}
              <div className="text-6xl animate-ping opacity-60 absolute">💥</div>
              <div className="flex items-center gap-4">
                <span className="text-6xl transition-transform -rotate-45 -translate-x-6 drop-shadow-md">
                  🥠
                </span>
                <span className="text-6xl transition-transform rotate-45 translate-x-6 drop-shadow-md">
                  🥠
                </span>
              </div>
            </div>
          )}

          {phase === 'revealed' && fortune && reward && (
            <div className="w-full flex flex-col items-center animate-scale-in space-y-3">
              {/* Unfolded Parchment Paper */}
              <div className="w-full relative bg-[#f7edd2] text-stone-900 rounded-2xl p-4 shadow-[0_8px_25px_rgba(0,0,0,0.5)] border-2 border-amber-600/30 overflow-hidden">
                <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 select-none pointer-events-none">
                  📜
                </div>
                <div className="text-[10px] uppercase font-black tracking-wider text-amber-900/60 mb-1">
                  {lang === 'uk' ? 'Кулінарне Пророцтво' : 'Кулинарное Предсказание'}
                </div>
                <blockquote className="text-xs font-serif font-bold italic leading-relaxed text-stone-900 my-1">
                  «{lang === 'uk' ? fortune.quoteUk : fortune.quoteRu}»
                </blockquote>
                <div className="text-right text-[10px] font-semibold text-amber-800/70 mt-1">
                  — {lang === 'uk' ? fortune.authorUk : fortune.authorRu}
                </div>
              </div>

              {/* Reward Badge */}
              <div className="w-full glass-card rounded-2xl p-3 border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                  {reward.icon}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="text-xs font-black text-amber-200 truncate">
                    {lang === 'uk' ? reward.titleUk : reward.titleRu}
                  </div>
                  <div className="text-[11px] text-amber-100 font-bold">
                    {lang === 'uk' ? reward.descriptionUk : reward.descriptionRu}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="w-full mt-3 pt-2 border-t border-white/10 flex flex-col gap-2">
          {phase === 'revealed' ? (
            <button
              type="button"
              onClick={handleClaim}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-black text-sm shadow-[0_0_20px_rgba(251,191,36,0.4)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>✨</span>
              <span>{lang === 'uk' ? 'Забрати нагороду!' : 'Забрать награду!'}</span>
            </button>
          ) : !isReady ? (
            <button
              type="button"
              onClick={handleCrackCookie}
              disabled={playerDiamonds < COOKIE_INSTANT_DIAMOND_COST}
              className={`w-full py-2.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md ${
                playerDiamonds >= COOKIE_INSTANT_DIAMOND_COST
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/25'
                  : 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
              }`}
            >
              <span>💎</span>
              <span>
                {lang === 'uk'
                  ? `Зламати за ${COOKIE_INSTANT_DIAMOND_COST} 💎 (Є: ${playerDiamonds})`
                  : `Разломить за ${COOKIE_INSTANT_DIAMOND_COST} 💎 (Есть: ${playerDiamonds})`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCrackCookie}
              className="w-full py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-black text-xs active:scale-95 transition-all cursor-pointer"
            >
              🥠 {lang === 'uk' ? 'Розламати печиво' : 'Разломить печенье'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
