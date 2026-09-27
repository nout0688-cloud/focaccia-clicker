import React, { useState, useEffect } from 'react';
import {
  EXPEDITION_LOCATIONS,
  type ExpeditionLocation,
  type ActiveExpedition,
  getCatExpeditionDuration,
} from './expeditions';
import { INGREDIENTS } from './alchemy';
import { cn } from '../utils/cn';

interface ExpeditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  catLevel: number;
  isCatUnlocked: boolean;
  activeExpedition: ActiveExpedition | null;
  onStartExpedition: (locationId: string) => void;
  onClaimExpedition: () => void;
  onInstantComplete?: (diamondCost: number) => void;
  playerDiamonds: number;
  lang: 'uk' | 'ru';
}

export const ExpeditionModal: React.FC<ExpeditionModalProps> = ({
  isOpen,
  onClose,
  catLevel,
  isCatUnlocked,
  activeExpedition,
  onStartExpedition,
  onClaimExpedition,
  onInstantComplete,
  playerDiamonds,
  lang,
}) => {
  const [now, setNow] = useState(Date.now());
  const [selectedLoc, setSelectedLoc] = useState<ExpeditionLocation>(EXPEDITION_LOCATIONS[0]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const activeLoc = activeExpedition
    ? EXPEDITION_LOCATIONS.find((l) => l.id === activeExpedition.locationId) || EXPEDITION_LOCATIONS[0]
    : null;

  const elapsedMs = activeExpedition ? now - activeExpedition.startTime : 0;
  const totalMs = activeExpedition ? activeExpedition.durationMs : 1;
  const progressRatio = Math.min(1, Math.max(0, elapsedMs / totalMs));
  const isFinished = progressRatio >= 1;
  const remainingSec = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
  const instantCost = Math.max(1, Math.ceil(remainingSec / 300)); // 1 diamond per 5 min

  const formatRemaining = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none safe-bottom animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#12100d] border-t sm:border border-amber-500/40 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-zinc-950/85 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-lg shadow shrink-0 animate-bounce">
              🧭
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                {lang === 'uk' ? 'Експедиції Мурчика' : 'Экспедиции Мурчика'}
              </h3>
              <p className="text-[10px] text-emerald-300/80 font-medium truncate">
                {lang === 'uk'
                  ? 'Відправляйте котика за рідкісними інгредієнтами та скарбами'
                  : 'Отправляйте котика за редкими ингредиентами и сокровищами'}
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

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {!isCatUnlocked && (
            <div className="glass-card rounded-2xl p-5 text-center border-amber-500/30 space-y-2">
              <div className="text-4xl">🐱💤</div>
              <div className="font-black text-amber-200 text-sm">
                {lang === 'uk' ? 'Мурчик ще не розблокований!' : 'Мурчик ещё не разблокирован!'}
              </div>
              <p className="text-xs text-amber-300/70">
                {lang === 'uk'
                  ? 'Розблокуйте котика Мурчика в налаштуваннях або магазині, щоб вирушити в експедиції.'
                  : 'Разблокируйте котика Мурчика в настройках или магазине, чтобы отправиться в экспедиции.'}
              </p>
            </div>
          )}

          {/* ACTIVE EXPEDITION BANNER */}
          {isCatUnlocked && activeExpedition && activeLoc && (
            <div className="relative rounded-2xl p-4 border border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 via-stone-900/80 to-emerald-950/70 shadow-lg overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-pulse">{activeLoc.icon}</span>
                  <div>
                    <div className="text-xs font-black text-emerald-300">
                      {lang === 'uk' ? 'Експедиція в дорозі:' : 'Экспедиция в пути:'}
                    </div>
                    <div className="text-sm font-black text-white">
                      {lang === 'uk' ? activeLoc.nameUk : activeLoc.nameRu}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black font-mono text-emerald-200">
                    {isFinished ? '✅ ГОТОВО!' : formatRemaining(remainingSec)}
                  </div>
                  <div className="text-[10px] text-emerald-400/70">
                    {isFinished
                      ? lang === 'uk' ? 'Можна забирати' : 'Можно забирать'
                      : lang === 'uk' ? 'до повернення' : 'до возвращения'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative w-full h-3 bg-black/60 rounded-full overflow-hidden border border-emerald-500/30">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000"
                  style={{ width: `${Math.floor(progressRatio * 100)}%` }}
                />
              </div>

              {/* Action button */}
              <div className="flex gap-2 pt-1">
                {isFinished ? (
                  <button
                    type="button"
                    onClick={onClaimExpedition}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer"
                  >
                    🎉 {lang === 'uk' ? 'Забрати здобич!' : 'Забрать добычу!'}
                  </button>
                ) : (
                  onInstantComplete && (
                    <button
                      type="button"
                      onClick={() => onInstantComplete(instantCost)}
                      disabled={playerDiamonds < instantCost}
                      className={cn(
                        'flex-1 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition border cursor-pointer',
                        playerDiamonds >= instantCost
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
                          : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                      )}
                    >
                      <span>⚡ {lang === 'uk' ? 'Завершити миттєво' : 'Завершить мгновенно'}</span>
                      <span className="font-mono text-cyan-300">({instantCost} 💎)</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* AVAILABLE LOCATIONS LIST */}
          {isCatUnlocked && !activeExpedition && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300/80 px-1">
                <span>{lang === 'uk' ? 'Оберіть пункт призначення:' : 'Выберите пункт назначения:'}</span>
                <span className="text-[11px] text-amber-400">
                  {lang === 'uk' ? `Рівень котика: ${catLevel}` : `Уровень котика: ${catLevel}`} 🐾
                </span>
              </div>

              <div className="space-y-2.5">
                {EXPEDITION_LOCATIONS.map((loc) => {
                  const isLocked = catLevel < loc.requiredCatLevel;
                  const durationMs = getCatExpeditionDuration(loc.baseDurationMs, catLevel);
                  const durationMin = Math.round(durationMs / 60000);
                  const isSelected = selectedLoc.id === loc.id;

                  return (
                    <div
                      key={loc.id}
                      onClick={() => !isLocked && setSelectedLoc(loc)}
                      className={cn(
                        'p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden',
                        isSelected
                          ? 'border-amber-400/80 bg-zinc-900/90 shadow-lg shadow-amber-500/10'
                          : 'border-white/10 bg-zinc-950/60 hover:border-amber-500/30',
                        isLocked && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl p-1.5 rounded-xl bg-black/40 border border-white/5">
                            {loc.icon}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-sm text-white">
                                {lang === 'uk' ? loc.nameUk : loc.nameRu}
                              </h4>
                              {isLocked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-950/80 border border-red-500/40 text-red-300 font-bold">
                                  🔒 {lang === 'uk' ? `Потрібен Рівень ${loc.requiredCatLevel}` : `Нужен Уровень ${loc.requiredCatLevel}`}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-white/60 line-clamp-1 mt-0.5">
                              {lang === 'uk' ? loc.descUk : loc.descRu}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-amber-300">
                            ⏱️ {durationMin >= 60 ? `${(durationMin / 60).toFixed(1)} год` : `${durationMin} хв`}
                          </div>
                        </div>
                      </div>

                      {/* Guaranteed and potential loot tags */}
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white/40">{lang === 'uk' ? 'Здобич:' : 'Добыча:'}</span>
                          {loc.guaranteedIngredients.map((g) => {
                            const ing = INGREDIENTS[g.id];
                            return (
                              <span
                                key={g.id}
                                className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-amber-200 font-medium"
                              >
                                {ing ? ing.icon : '🌿'} {g.count} шт
                              </span>
                            );
                          })}
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-bold">
                            💎 {loc.possibleLoot.diamondsMin}-{loc.possibleLoot.diamondsMax}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-950/60 border border-purple-500/30 text-purple-300 font-bold">
                            +{loc.possibleLoot.passXp} XP
                          </span>
                        </div>

                        {!isLocked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartExpedition(loc.id);
                            }}
                            className="px-3 py-1.5 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer"
                          >
                            🚀 {lang === 'uk' ? 'Відправити' : 'Отправить'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
