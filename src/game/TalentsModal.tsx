import React, { useState } from 'react';
import { cn } from '../utils/cn';
import {
  TALENT_NODES,
  TalentBranch,
  TalentsState,
  getAvailableTalentPoints,
  getBranchSpentPoints,
  getTotalSpentPoints,
} from './talents';

interface TalentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  talentsState: TalentsState;
  prestige: number;
  onUpgradeTalent: (nodeId: string) => void;
  onResetTalents: () => void;
  playerDiamonds: number;
  lang?: 'uk' | 'ru';
}

export const TalentsModal: React.FC<TalentsModalProps> = ({
  isOpen,
  onClose,
  talentsState,
  prestige,
  onUpgradeTalent,
  onResetTalents,
  playerDiamonds,
  lang = 'uk',
}) => {
  const [activeBranch, setActiveBranch] = useState<TalentBranch>('berserk');

  if (!isOpen) return null;

  const totalSpent = getTotalSpentPoints(talentsState.nodes || {});
  const availablePoints = getAvailableTalentPoints(prestige, totalSpent);
  const branchSpent = getBranchSpentPoints(talentsState.nodes || {}, activeBranch);

  const branchNodes = Object.values(TALENT_NODES).filter((n) => n.branch === activeBranch);

  const BRANCH_INFO: Record<
    TalentBranch,
    { titleUk: string; titleRu: string; subtitleUk: string; subtitleRu: string; color: string; border: string; bg: string }
  > = {
    berserk: {
      titleUk: 'Шлях Берсерка',
      titleRu: 'Путь Берсерка',
      subtitleUk: 'Сила кліку, нищівні крити та комбо-шквал',
      subtitleRu: 'Сила клика, сокрушительные криты и комбо-шквал',
      color: 'text-red-400',
      border: 'border-red-500/40',
      bg: 'from-red-950/60 to-zinc-900',
    },
    tycoon: {
      titleUk: 'Шлях Магната',
      titleRu: 'Путь Магната',
      subtitleUk: 'Виробництво будівель, нічний прибуток та авто-ремонт',
      subtitleRu: 'Производство зданий, ночной доход и авто-ремонт',
      color: 'text-amber-300',
      border: 'border-amber-500/40',
      bg: 'from-amber-950/60 to-zinc-900',
    },
    mystic: {
      titleUk: 'Шлях Містика',
      titleRu: 'Путь Мистика',
      subtitleUk: 'Рідкісні фокачі, швидкий Мурчик та діамантові жили',
      subtitleRu: 'Редкие фокаччи, быстрый Мурчик и алмазные жилы',
      color: 'text-purple-300',
      border: 'border-purple-500/40',
      bg: 'from-purple-950/60 to-zinc-900',
    },
  };

  const currentBranchInfo = BRANCH_INFO[activeBranch];

  return (
    <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none safe-bottom animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#14120e] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative shrink-0 px-4 py-3 border-b border-white/10 bg-zinc-950/85 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-400/40 flex items-center justify-center text-xl shrink-0 shadow-md">
              🌳
            </div>
            <div>
              <h3 className="text-base font-black text-amber-100 flex items-center gap-2">
                <span>{lang === 'uk' ? 'Дерево Стародавньої Мудрості' : 'Древо Древней Мудрости'}</span>
              </h3>
              <p className="text-[11px] text-amber-400/80 font-medium">
                {lang === 'uk'
                  ? `Ребіртх дає Очки Талантів (⭐)`
                  : `Ребиртх даёт Очки Талантов (⭐)`}
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

        {/* Talent Points Counter Bar */}
        <div className="mx-3.5 mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-600/15 border border-amber-500/30 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-spin-slow">⭐</span>
            <div>
              <div className="text-xs font-black text-amber-200 uppercase tracking-wide">
                {lang === 'uk' ? 'Доступні Очки Талантів' : 'Доступные Очки Талантов'}
              </div>
              <div className="text-lg font-black text-white font-mono leading-none mt-0.5">
                {availablePoints}{' '}
                <span className="text-[11px] font-normal text-stone-400">
                  / {prestige} {lang === 'uk' ? 'зароблено' : 'заработано'}
                </span>
              </div>
            </div>
          </div>

          {totalSpent > 0 && (
            <button
              type="button"
              onClick={onResetTalents}
              className="text-[11px] font-bold text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/10 transition active:scale-95 cursor-pointer"
              title={lang === 'uk' ? 'Скинути всі вкладені очки' : 'Сбросить все очки'}
            >
              🔄 {lang === 'uk' ? 'Скинути' : 'Сбросить'}
            </button>
          )}
        </div>

        {/* Branch Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 mx-3.5 my-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold z-10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveBranch('berserk')}
            className={cn(
              'py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer',
              activeBranch === 'berserk'
                ? 'bg-red-600/90 text-white font-black shadow-md border border-red-400/50'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            )}
          >
            <span className="text-sm">🔴</span>
            <span className="text-[11px]">{lang === 'uk' ? 'Берсерк' : 'Берсерк'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBranch('tycoon')}
            className={cn(
              'py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer',
              activeBranch === 'tycoon'
                ? 'bg-amber-500 text-stone-950 font-black shadow-md border border-amber-300/60'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            )}
          >
            <span className="text-sm">🟡</span>
            <span className="text-[11px]">{lang === 'uk' ? 'Магнат' : 'Магнат'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBranch('mystic')}
            className={cn(
              'py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer',
              activeBranch === 'mystic'
                ? 'bg-purple-600/90 text-white font-black shadow-md border border-purple-400/50'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            )}
          >
            <span className="text-sm">🟣</span>
            <span className="text-[11px]">{lang === 'uk' ? 'Містик' : 'Мистик'}</span>
          </button>
        </div>

        {/* Branch Info Banner */}
        <div className="mx-3.5 px-3 py-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[11px] shrink-0">
          <div>
            <span className={cn('font-black block', currentBranchInfo.color)}>
              {lang === 'uk' ? currentBranchInfo.titleUk : currentBranchInfo.titleRu}
            </span>
            <span className="text-stone-400">
              {lang === 'uk' ? currentBranchInfo.subtitleUk : currentBranchInfo.subtitleRu}
            </span>
          </div>
          <div className="font-mono font-bold text-stone-300 text-right shrink-0 ml-2">
            <span>{branchSpent} ⭐</span>
            <span className="text-[9px] text-stone-500 block uppercase font-sans">
              {lang === 'uk' ? 'вкладено' : 'вложено'}
            </span>
          </div>
        </div>

        {/* Nodes List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2.5">
          {branchNodes.map((node) => {
            const currentLevel = (talentsState.nodes && talentsState.nodes[node.id]) || 0;
            const isMax = currentLevel >= node.maxLevel;
            const isUnlocked = branchSpent >= node.requiredBranchPoints;
            const canAfford = availablePoints >= node.costPerLevel;
            const canUpgrade = isUnlocked && !isMax && canAfford;

            return (
              <div
                key={node.id}
                className={cn(
                  'p-3 rounded-2xl border transition-all relative overflow-hidden flex flex-col gap-2',
                  !isUnlocked
                    ? 'bg-zinc-950/60 border-white/5 opacity-50'
                    : isMax
                    ? 'bg-zinc-900/60 border-amber-500/30'
                    : 'bg-zinc-900/85 border-white/10'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 border shadow',
                        currentLevel > 0
                          ? 'bg-amber-500/20 border-amber-400/40'
                          : 'bg-black/50 border-white/10'
                      )}
                    >
                      {node.icon}
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-amber-100 flex items-center gap-1.5">
                        <span>{lang === 'uk' ? node.name.uk : node.name.ru}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-stone-300">
                          {currentLevel}/{node.maxLevel}
                        </span>
                      </h4>
                      <p className="text-[11px] text-stone-300/80 leading-relaxed mt-0.5">
                        {lang === 'uk' ? node.desc.uk : node.desc.ru}
                      </p>
                    </div>
                  </div>

                  {/* Level Pips */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex gap-1">
                      {Array.from({ length: node.maxLevel }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-2 h-2 rounded-full border transition-all',
                            i < currentLevel
                              ? 'bg-amber-400 border-amber-300 shadow-[0_0_5px_rgba(251,191,36,0.6)]'
                              : 'bg-black/60 border-white/20'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Effect Preview & Action Button */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                  <div className="text-[11px] font-mono text-amber-300/90 font-bold truncate pr-2">
                    {node.effectPerLevel(currentLevel || 1)}
                  </div>

                  <div>
                    {!isUnlocked ? (
                      <span className="text-[10px] text-stone-500 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 font-medium">
                        🔒 {lang === 'uk' ? `Потрібно ${node.requiredBranchPoints} ⭐ в гілці` : `Нужно ${node.requiredBranchPoints} ⭐ в ветке`}
                      </span>
                    ) : isMax ? (
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                        MAX
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpgradeTalent(node.id)}
                        disabled={!canUpgrade}
                        className={cn(
                          'text-xs font-black px-3.5 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shadow-md flex items-center gap-1',
                          canUpgrade
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-stone-950 border border-amber-200 animate-pulse'
                            : 'bg-white/5 text-stone-500 cursor-not-allowed border border-white/5'
                        )}
                      >
                        <span>+1</span>
                        <span>({node.costPerLevel}⭐)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
