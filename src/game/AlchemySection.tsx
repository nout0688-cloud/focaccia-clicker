import React, { useState, useEffect } from 'react';
import {
  INGREDIENTS,
  ALCHEMY_POTIONS,
  type AlchemyPotion,
  isBuffActive,
  getBuffRemainingMs,
  formatDurationMmSs,
  canBrewPotion,
} from './alchemy';
import { cn } from '../utils/cn';

interface AlchemySectionProps {
  ingredients: Record<string, number>;
  buffs: Record<string, number>;
  onBrewPotion: (potion: AlchemyPotion) => void;
  onOpenExpeditions: () => void;
  lang: 'uk' | 'ru';
}

export const AlchemySection: React.FC<AlchemySectionProps> = ({
  ingredients,
  buffs,
  onBrewPotion,
  onOpenExpeditions,
  lang,
}) => {
  const [, setTick] = useState(0);
  const [brewingId, setBrewingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBrew = (p: AlchemyPotion) => {
    if (!canBrewPotion(p, ingredients)) return;
    setBrewingId(p.id);
    setTimeout(() => {
      onBrewPotion(p);
      setBrewingId(null);
    }, 600);
  };

  const activeBuffsList = ALCHEMY_POTIONS.filter((p) => isBuffActive(buffs, p.id));

  return (
    <div className="space-y-4">
      {/* CAULDRON HEADER BANNER */}
      <div className="relative rounded-3xl p-5 border border-amber-500/30 bg-gradient-to-b from-stone-900/90 via-amber-950/30 to-stone-950/90 shadow-xl overflow-hidden text-center">
        {/* Ambient Steam Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="text-5xl animate-bounce mb-1">⚗️</div>
          <h3 className="text-base font-black text-amber-200">
            {lang === 'uk' ? 'Алхімічний Казан Бабусі' : 'Алхимический Котёл Бабушки'}
          </h3>
          <p className="text-[11px] text-amber-300/70 max-w-xs mt-0.5">
            {lang === 'uk'
              ? 'Варіть рідкісні зілля з інгредієнтів експедицій для колосальних бустів!'
              : 'Варите редкие зелья из ингредиентов экспедиций для колоссальных бустов!'}
          </p>
        </div>

        {/* ACTIVE TIMED BUFFS ROW */}
        {activeBuffsList.length > 0 && (
          <div className="mt-4 pt-3 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {activeBuffsList.map((p) => {
              const remMs = getBuffRemainingMs(buffs, p.id);
              return (
                <div
                  key={p.id}
                  className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-between gap-2 shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl animate-pulse">{p.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {lang === 'uk' ? p.nameUk : p.nameRu}
                      </div>
                      <div className="text-[10px] text-amber-300/80">
                        {lang === 'uk' ? p.effectUk : p.effectRu}
                      </div>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-black/50 border border-amber-500/30 text-xs font-mono font-black text-amber-300 shrink-0">
                    {formatDurationMmSs(remMs)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INVENTORY OF RARE INGREDIENTS */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-amber-300/80 px-1 mb-2">
          <span>{lang === 'uk' ? 'Твої інгредієнти:' : 'Твои ингредиенты:'}</span>
          <button
            type="button"
            onClick={onOpenExpeditions}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
          >
            <span>🧭 {lang === 'uk' ? 'Усі в експедицію' : 'Все в экспедицию'}</span>
            <span>→</span>
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {Object.values(INGREDIENTS).map((ing) => {
            const count = ingredients[ing.id] || 0;
            return (
              <div
                key={ing.id}
                className={cn(
                  'p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all',
                  count > 0
                    ? 'border-amber-500/30 bg-stone-900/80 shadow'
                    : 'border-white/5 bg-zinc-950/40 opacity-40'
                )}
                title={lang === 'uk' ? ing.descUk : ing.descRu}
              >
                <span className="text-2xl mb-1">{ing.icon}</span>
                <span className="text-[10px] font-bold text-white/70 truncate w-full">
                  {lang === 'uk' ? ing.nameUk.split(' ')[0] : ing.nameRu.split(' ')[0]}
                </span>
                <span className="text-xs font-black font-mono text-amber-300 mt-0.5">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RECIPES LIST */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold text-amber-300/80 px-1">
          {lang === 'uk' ? 'Рецепти зіллів:' : 'Рецепты зелий:'}
        </div>

        <div className="space-y-2">
          {ALCHEMY_POTIONS.map((pot) => {
            const canBrew = canBrewPotion(pot, ingredients);
            const isActive = isBuffActive(buffs, pot.id);
            const isBrewing = brewingId === pot.id;

            return (
              <div
                key={pot.id}
                className={cn(
                  'p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                  isActive
                    ? 'border-amber-400 bg-amber-950/30 shadow-md'
                    : canBrew
                    ? 'border-amber-500/30 bg-zinc-900/80 hover:border-amber-400/60'
                    : 'border-white/10 bg-zinc-950/50 opacity-70'
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-3xl p-2 rounded-xl bg-black/40 border border-white/5 shrink-0">
                    {pot.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-white truncate">
                        {lang === 'uk' ? pot.nameUk : pot.nameRu}
                      </h4>
                      {isActive && (
                        <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                          ⚡ {lang === 'uk' ? 'АКТИВНО' : 'АКТИВНО'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">
                      {lang === 'uk' ? pot.effectUk : pot.effectRu}
                    </p>

                    {/* Ingredients needed */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                      <span className="text-white/40">{lang === 'uk' ? 'Склад:' : 'Состав:'}</span>
                      {Object.entries(pot.cost).map(([ingId, needed]) => {
                        const ing = INGREDIENTS[ingId];
                        const have = ingredients[ingId] || 0;
                        const hasEnough = have >= needed;
                        return (
                          <span
                            key={ingId}
                            className={cn(
                              'px-1.5 py-0.5 rounded-md border font-mono font-bold flex items-center gap-0.5',
                              hasEnough
                                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                                : 'bg-red-950/40 border-red-500/30 text-red-300'
                            )}
                          >
                            <span>{ing ? ing.icon : '🌿'}</span>
                            <span>{have}/{needed}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleBrew(pot)}
                    disabled={!canBrew || isBrewing}
                    className={cn(
                      'w-full sm:w-auto px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer shadow-md',
                      isBrewing
                        ? 'bg-amber-400 text-stone-950 animate-ping'
                        : canBrew
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 active:scale-95'
                        : 'bg-white/5 border border-white/5 text-white/30 cursor-not-allowed'
                    )}
                  >
                    {isBrewing
                      ? '⚗️ ' + (lang === 'uk' ? 'Варіння...' : 'Варка...')
                      : isActive
                      ? '🔄 ' + (lang === 'uk' ? 'Продовжити' : 'Продлить')
                      : '⚗️ ' + (lang === 'uk' ? 'Зварити' : 'Сварить')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
