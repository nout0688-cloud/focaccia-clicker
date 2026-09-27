import React, { useState } from 'react';
import { cn } from '../utils/cn';
import {
  BAKER_PASS_TIERS,
  type QuestsState,
  XP_PER_TIER,
  PASS_TIERS_COUNT,
} from './quests';

interface QuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questsState: QuestsState;
  onClaimQuest: (questId: string) => void;
  onClaimPassTier: (tier: number, isVip: boolean) => void;
  onUnlockVip: () => void;
  playerDiamonds?: number;
  isPatron?: boolean;
  lang?: 'uk' | 'ru';
}

export const QuestsModal: React.FC<QuestsModalProps> = ({
  isOpen,
  onClose,
  questsState,
  onClaimQuest,
  onClaimPassTier,
  onUnlockVip,
  isPatron,
  lang = 'uk',
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'pass'>('daily');

  if (!isOpen) return null;

  const isVipUnlocked = questsState.vipUnlocked || !!isPatron;
  const currentTier = Math.min(
    PASS_TIERS_COUNT,
    Math.floor(questsState.passXp / XP_PER_TIER)
  );
  const xpIntoCurrentTier = questsState.passXp % XP_PER_TIER;
  const xpProgressPercent = Math.min(100, Math.round((xpIntoCurrentTier / XP_PER_TIER) * 100));

  const hasUnclaimedDaily = questsState.daily.some((q) => q.completed && !q.claimed);

  return (
    <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none safe-bottom animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#14120e] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative shrink-0 px-4 py-3 border-b border-white/10 bg-zinc-950/85 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl shrink-0 shadow-md">
              📜
            </div>
            <div>
              <h3 className="text-base font-black text-amber-100 flex items-center gap-2">
                <span>{lang === 'uk' ? 'Пекарські Контракти' : 'Пекарские Контракты'}</span>
                {hasUnclaimedDaily && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                )}
              </h3>
              <p className="text-[11px] text-amber-400/80 font-medium">
                {lang === 'uk'
                  ? 'Виконуй місії та відкривай рівні Baker Pass'
                  : 'Выполняй миссии и открывай уровни Baker Pass'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold border border-white/10 transition active:scale-95 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 mx-3.5 my-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold z-10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={cn(
              'py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeTab === 'daily'
                ? 'bg-amber-500 text-stone-950 font-black shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            )}
          >
            <span>🎯</span>
            <span>{lang === 'uk' ? 'Щоденні Місії' : 'Ежедневные Миссии'}</span>
            {hasUnclaimedDaily && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-stone-950 text-[10px] font-black animate-bounce">
                !
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pass')}
            className={cn(
              'py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeTab === 'pass'
                ? 'bg-amber-500 text-stone-950 font-black shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            )}
          >
            <span>🎫</span>
            <span>{lang === 'uk' ? 'Baker Pass (Сезон)' : 'Baker Pass (Сезон)'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
              Lv.{currentTier}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-3.5 pb-4 space-y-3">
          {activeTab === 'daily' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  <span>
                    {lang === 'uk'
                      ? 'Місії оновлюються щодня о 00:00'
                      : 'Миссии обновляются ежедневно в 00:00'}
                  </span>
                </div>
                <div className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded text-amber-300 font-bold border border-amber-500/20">
                  {questsState.date}
                </div>
              </div>

              {questsState.daily.map((quest) => {
                const isReady = quest.progress >= quest.target;
                const progressPct = Math.min(100, Math.round((quest.progress / quest.target) * 100));

                return (
                  <div
                    key={quest.id}
                    className={cn(
                      'p-3.5 rounded-2xl border transition-all flex flex-col gap-2.5 relative overflow-hidden',
                      quest.claimed
                        ? 'bg-zinc-900/40 border-white/5 opacity-60'
                        : isReady
                        ? 'bg-gradient-to-r from-emerald-950/40 via-amber-950/30 to-zinc-900/60 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-zinc-900/70 border-white/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-xl shrink-0">
                          {quest.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-100 leading-tight">
                            {lang === 'uk' ? quest.title.uk : quest.title.ru}
                          </h4>
                          <p className="text-[11px] text-stone-300/80 mt-0.5">
                            {lang === 'uk' ? quest.desc.uk : quest.desc.ru}
                          </p>
                        </div>
                      </div>

                      {/* Rewards Pill */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-black/50 px-2 py-1 rounded-xl border border-white/10 text-xs">
                        <span className="text-amber-300 font-bold font-mono">
                          +{quest.rewardFocaccia.toLocaleString()}🫓
                        </span>
                        <span className="text-cyan-300 font-bold font-mono flex items-center gap-0.5">
                          +{quest.rewardDiamonds}💎
                        </span>
                        <span className="text-purple-300 font-bold font-mono text-[10px]">
                          +{quest.rewardXp}XP
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Claim Button */}
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] font-mono text-stone-400 mb-1">
                          <span>{lang === 'uk' ? 'Прогрес' : 'Прогресс'}</span>
                          <span className="font-bold text-amber-200">
                            {Math.min(quest.target, quest.progress)} / {quest.target} ({progressPct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-black/60 overflow-hidden border border-white/10">
                          <div
                            className={cn(
                              'h-full transition-all duration-300',
                              isReady
                                ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        {quest.claimed ? (
                          <span className="text-[11px] font-bold text-stone-500 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
                            {lang === 'uk' ? '✓ Забрано' : '✓ Забрано'}
                          </span>
                        ) : isReady ? (
                          <button
                            type="button"
                            onClick={() => onClaimQuest(quest.id)}
                            className="bg-gradient-to-r from-emerald-500 to-amber-400 text-stone-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition cursor-pointer animate-pulse"
                          >
                            {lang === 'uk' ? 'Забрати' : 'Забрать'}
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-stone-400 px-2.5 py-1.5 rounded-xl bg-white/5">
                            {lang === 'uk' ? 'У процесі' : 'В процессе'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'pass' && (
            <div className="space-y-3.5">
              {/* Season Banner & XP Progress */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/60 via-zinc-900/80 to-purple-950/40 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👑</span>
                    <div>
                      <h4 className="text-sm font-black text-amber-200">
                        {lang === 'uk' ? 'Сезон 1: Ера Стародавнього Тіста' : 'Сезон 1: Эра Древнего Теста'}
                      </h4>
                      <p className="text-[11px] text-amber-400/80 font-medium">
                        {lang === 'uk'
                          ? `Рівень ${currentTier} з ${PASS_TIERS_COUNT} • Всього XP: ${questsState.passXp}`
                          : `Уровень ${currentTier} из ${PASS_TIERS_COUNT} • Всего XP: ${questsState.passXp}`}
                      </p>
                    </div>
                  </div>

                  {!isVipUnlocked ? (
                    <button
                      type="button"
                      onClick={onUnlockVip}
                      className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-stone-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-md active:scale-95 transition cursor-pointer flex items-center gap-1.5 border border-amber-200"
                    >
                      <span>⭐</span>
                      <span>VIP (100💎)</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1">
                      <span>👑</span>
                      <span>VIP АКТИВНО</span>
                    </span>
                  )}
                </div>

                {/* Level progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-amber-300/80 mb-1">
                    <span>
                      {currentTier < PASS_TIERS_COUNT
                        ? `${lang === 'uk' ? 'До наступного рівня' : 'До следующего уровня'}: ${XP_PER_TIER - xpIntoCurrentTier} XP`
                        : lang === 'uk' ? 'Максимальний рівень досягнуто!' : 'Максимальный уровень достигнут!'}
                    </span>
                    <span className="font-bold">{xpProgressPercent}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/60 overflow-hidden border border-amber-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300 transition-all duration-300"
                      style={{ width: `${currentTier >= PASS_TIERS_COUNT ? 100 : xpProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tiers List */}
              <div className="space-y-2">
                {BAKER_PASS_TIERS.map((tierItem) => {
                  const isUnlocked = questsState.passXp >= tierItem.requiredXp;
                  const isFreeClaimed = questsState.claimedFree.includes(tierItem.tier);
                  const isVipClaimed = questsState.claimedVip.includes(tierItem.tier);

                  return (
                    <div
                      key={tierItem.tier}
                      className={cn(
                        'p-2.5 rounded-2xl border transition-all flex items-center gap-3 relative',
                        isUnlocked
                          ? 'bg-zinc-900/80 border-amber-500/30'
                          : 'bg-zinc-950/60 border-white/5 opacity-70'
                      )}
                    >
                      {/* Tier Badge */}
                      <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] text-stone-400 font-bold uppercase">LVL</span>
                        <span className="text-base font-black text-amber-300 leading-none">
                          {tierItem.tier}
                        </span>
                      </div>

                      {/* Rewards Columns */}
                      <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                        {/* Free Track */}
                        <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                          <div className="min-w-0 pr-1">
                            <span className="text-[9px] text-stone-400 block uppercase font-bold">
                              {lang === 'uk' ? 'Звичайна' : 'Обычная'}
                            </span>
                            <span className="font-bold text-stone-200 truncate block text-[11px]">
                              {tierItem.freeReward.icon} {lang === 'uk' ? tierItem.freeReward.label.uk : tierItem.freeReward.label.ru}
                            </span>
                          </div>
                          <div>
                            {isFreeClaimed ? (
                              <span className="text-[10px] font-bold text-stone-500">✓</span>
                            ) : isUnlocked ? (
                              <button
                                type="button"
                                onClick={() => onClaimPassTier(tierItem.tier, false)}
                                className="bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-1 rounded-lg active:scale-95 transition cursor-pointer"
                              >
                                {lang === 'uk' ? 'Взяти' : 'Взять'}
                              </button>
                            ) : (
                              <span className="text-stone-600 text-xs">🔒</span>
                            )}
                          </div>
                        </div>

                        {/* VIP Track */}
                        <div className={cn(
                          'p-2 rounded-xl border flex items-center justify-between',
                          isVipUnlocked
                            ? 'bg-amber-500/10 border-amber-400/30'
                            : 'bg-black/30 border-white/5 opacity-60'
                        )}>
                          <div className="min-w-0 pr-1">
                            <span className="text-[9px] text-amber-400 block uppercase font-black flex items-center gap-1">
                              <span>⭐</span> VIP
                            </span>
                            <span className="font-bold text-amber-200 truncate block text-[11px]">
                              {tierItem.vipReward.icon} {lang === 'uk' ? tierItem.vipReward.label.uk : tierItem.vipReward.label.ru}
                            </span>
                          </div>
                          <div>
                            {isVipClaimed ? (
                              <span className="text-[10px] font-bold text-stone-500">✓</span>
                            ) : isUnlocked && isVipUnlocked ? (
                              <button
                                type="button"
                                onClick={() => onClaimPassTier(tierItem.tier, true)}
                                className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 text-[10px] font-black px-2 py-1 rounded-lg active:scale-95 transition cursor-pointer"
                              >
                                {lang === 'uk' ? 'Взяти' : 'Взять'}
                              </button>
                            ) : (
                              <span className="text-amber-500/50 text-xs">👑</span>
                            )}
                          </div>
                        </div>
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
