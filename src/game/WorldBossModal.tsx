import React, { useState, useEffect } from 'react';
import {
  type WorldBossState,
  CURRENT_WORLD_BOSS,
  BOSS_REWARD_TIERS,
  getBossPhase,
} from './worldBoss';
import { cn } from '../utils/cn';

interface WorldBossModalProps {
  isOpen: boolean;
  onClose: () => void;
  bossState: WorldBossState;
  onAttack: (isCritWeakPoint?: boolean) => void;
  onClaimTier: (tier: number) => void;
  onRefillStamina: () => void;
  playerDiamonds: number;
  playerClickPower: number;
  lang: 'uk' | 'ru';
}

export const WorldBossModal: React.FC<WorldBossModalProps> = ({
  isOpen,
  onClose,
  bossState,
  onAttack,
  onClaimTier,
  onRefillStamina,
  playerDiamonds,
  playerClickPower,
  lang,
}) => {
  const [weakPoint, setWeakPoint] = useState<{ x: number; y: number } | null>(null);
  const [hitEffect, setHitEffect] = useState(false);
  const [recentHits, setRecentHits] = useState<string[]>([]);

  const currentPhase = getBossPhase(bossState.currentHp, bossState.maxHp);
  const hpPercent = Math.max(0, Math.min(100, (bossState.currentHp / bossState.maxHp) * 100));

  // Spawn weak points in Phase 2
  useEffect(() => {
    if (!isOpen || currentPhase.phase !== 2 || bossState.isDefeated) {
      setWeakPoint(null);
      return;
    }
    const interval = setInterval(() => {
      setWeakPoint({
        x: 20 + Math.random() * 60,
        y: 25 + Math.random() * 50,
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [isOpen, currentPhase.phase, bossState.isDefeated]);

  // Periodic community hits simulation to create raid atmosphere
  useEffect(() => {
    if (!isOpen || bossState.isDefeated) return;
    const names = ['Олена_Baker', 'Максим_Тісто', 'Анна_Круасан', 'Богдан_Піч', 'Юлія_Майстер'];
    const timer = setInterval(() => {
      const name = names[Math.floor(Math.random() * names.length)];
      const dmg = Math.floor(1500 + Math.random() * 4500);
      setRecentHits((prev) => [
        `${name} -${dmg.toLocaleString()} HP!`,
        ...prev.slice(0, 3),
      ]);
    }, 3500);
    return () => clearInterval(timer);
  }, [isOpen, bossState.isDefeated]);

  if (!isOpen) return null;

  const handleStrike = (isCrit: boolean = false) => {
    if (bossState.stamina <= 0 || bossState.isDefeated) return;
    setHitEffect(true);
    setTimeout(() => setHitEffect(false), 200);
    if (isCrit) setWeakPoint(null);
    onAttack(isCrit);
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none safe-bottom animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#12100d] border-t sm:border border-red-500/40 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-36 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-zinc-950/85 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-lg shadow shrink-0 animate-pulse">
              👹
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                {lang === 'uk' ? CURRENT_WORLD_BOSS.nameUk : CURRENT_WORLD_BOSS.nameRu}
              </h3>
              <p className="text-[10px] text-red-300/80 font-medium truncate">
                {lang === 'uk' ? CURRENT_WORLD_BOSS.titleUk : CURRENT_WORLD_BOSS.titleRu}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-sm font-bold border border-white/10 transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Phase Badge & HP Bar */}
          <div className="glass-card rounded-2xl p-4 border border-red-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border"
                style={{
                  backgroundColor: `${currentPhase.color}22`,
                  borderColor: currentPhase.color,
                  color: currentPhase.color,
                }}
              >
                {currentPhase.badge}
              </span>
              <span className="text-xs font-mono font-black text-red-300">
                {bossState.currentHp.toLocaleString()} / {bossState.maxHp.toLocaleString()} HP
              </span>
            </div>

            {/* Boss HP Bar */}
            <div className="relative w-full h-4 bg-black/60 rounded-full overflow-hidden border border-red-500/30 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 transition-all duration-300"
                style={{ width: `${hpPercent}%` }}
              />
            </div>

            <div className="text-[11px] text-white/70 italic text-center">
              "{lang === 'uk' ? currentPhase.descUk : currentPhase.descRu}"
            </div>
          </div>

          {/* BOSS ARENA & ATTACK AREA */}
          <div className="relative rounded-2xl border border-red-500/30 bg-zinc-950/70 p-6 flex flex-col items-center justify-center min-h-[190px] overflow-hidden">
            {/* Boss Avatar */}
            <div
              onClick={() => handleStrike(false)}
              className={cn(
                'text-7xl cursor-pointer select-none transition-transform duration-150 active:scale-90',
                hitEffect && 'scale-110 filter drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]'
              )}
            >
              {CURRENT_WORLD_BOSS.avatar}
            </div>

            {/* Phase 2: Clickable Weak Point */}
            {weakPoint && !bossState.isDefeated && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStrike(true);
                }}
                style={{ left: `${weakPoint.x}%`, top: `${weakPoint.y}%` }}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-amber-300 bg-red-600/70 flex items-center justify-center text-sm font-black text-white shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-ping cursor-pointer"
              >
                🎯 5x!
              </button>
            )}

            {/* Tap prompt or Defeated state */}
            {bossState.isDefeated ? (
              <div className="mt-3 text-center space-y-1.5 animate-fade-in">
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-xs inline-block animate-pulse">
                  👑 {lang === 'uk' ? 'ГОЛЕМ ПОВАЛЕНИЙ!' : 'ГОЛЕМ ПОВЕРЖЕН!'}
                </div>
                <div className="text-[11px] text-white/70">
                  {lang === 'uk'
                    ? 'Відродження наступного титана через:'
                    : 'Возрождение следующего титана через:'}{' '}
                  <span className="font-mono font-bold text-amber-300">
                    {Math.max(1, Math.ceil(((bossState.respawnAt || Date.now()) - Date.now()) / 3600000))} {lang === 'uk' ? 'год.' : 'ч.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => handleStrike(false)}
                  disabled={bossState.stamina <= 0}
                  className={cn(
                    'px-6 py-2 rounded-xl font-black text-sm transition shadow-lg cursor-pointer',
                    bossState.stamina > 0
                      ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white hover:brightness-110 active:scale-95 shadow-red-600/30'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  )}
                >
                  ⚔️ {lang === 'uk' ? 'УДАР ПО ГОЛЕМУ!' : 'УДАР ПО ГОЛЕМУ!'}
                </button>
                <div className="text-[10px] text-white/50 mt-1 font-mono">
                  {lang === 'uk' ? 'Сила тапу:' : 'Сила тапа:'} {playerClickPower.toLocaleString()} 👊
                </div>
              </div>
            )}

            {/* Live combat log ticker */}
            {recentHits.length > 0 && (
              <div className="absolute bottom-1 right-2 text-[9px] text-white/40 font-mono text-right pointer-events-none">
                {recentHits[0]}
              </div>
            )}
          </div>

          {/* STAMINA & STATS */}
          <div className="glass-card rounded-2xl p-3 border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <div className="font-bold text-white/60">
                  {lang === 'uk' ? 'Бойова енергія' : 'Боевая энергия'}
                </div>
                <div className="font-mono font-black text-amber-300">
                  {bossState.stamina} / {bossState.maxStamina}
                </div>
              </div>
            </div>

            {bossState.stamina < bossState.maxStamina && (
              <button
                type="button"
                onClick={onRefillStamina}
                disabled={playerDiamonds < 3}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer',
                  playerDiamonds >= 3
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                )}
              >
                +10 ⚡ (3 💎)
              </button>
            )}

            <div className="text-right">
              <div className="font-bold text-white/60">
                {lang === 'uk' ? 'Твій урон:' : 'Твой урон:'}
              </div>
              <div className="font-mono font-black text-red-300">
                {bossState.playerDamage.toLocaleString()}
              </div>
            </div>
          </div>

          {/* REWARD TIERS */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-amber-300/80 px-1">
              🏆 {lang === 'uk' ? 'Нагороди за внесок у перемогу:' : 'Награды за вклад в победу:'}
            </div>

            <div className="space-y-2">
              {BOSS_REWARD_TIERS.map((tier) => {
                const isClaimed = bossState.claimedTiers.includes(tier.tier);
                const canClaim = bossState.playerDamage >= tier.damageRequired && !isClaimed;
                const progressPct = Math.min(100, Math.floor((bossState.playerDamage / tier.damageRequired) * 100));

                return (
                  <div
                    key={tier.tier}
                    className={cn(
                      'p-3 rounded-xl border transition-all flex items-center justify-between gap-3',
                      isClaimed
                        ? 'border-emerald-500/30 bg-emerald-950/20 opacity-70'
                        : canClaim
                        ? 'border-amber-400 bg-amber-950/40 shadow-lg shadow-amber-500/10'
                        : 'border-white/10 bg-zinc-950/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl">{tier.icon}</span>
                      <div className="min-w-0">
                        <div className="font-black text-xs text-white truncate">
                          {lang === 'uk' ? tier.titleUk : tier.titleRu}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {bossState.playerDamage.toLocaleString()} / {tier.damageRequired.toLocaleString()} DMG ({progressPct}%)
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold">
                          <span className="text-cyan-300">+{tier.diamonds} 💎</span>
                          <span className="text-purple-300">+{tier.passXp} XP</span>
                          <span className="text-amber-300">+{tier.truffles} 🍄</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isClaimed ? (
                        <span className="text-xs font-bold text-emerald-400">✓ {lang === 'uk' ? 'Забрано' : 'Забрано'}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onClaimTier(tier.tier)}
                          disabled={!canClaim}
                          className={cn(
                            'px-3 py-1.5 rounded-xl font-black text-xs transition cursor-pointer',
                            canClaim
                              ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-md animate-bounce'
                              : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                          )}
                        >
                          {lang === 'uk' ? 'Забрати' : 'Забрать'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
