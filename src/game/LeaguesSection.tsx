import React, { useState, useEffect } from 'react';
import {
  DIVISIONS,
  type DivisionInfo,
  type LeagueCompetitor,
  generateLeagueBracket,
  getWeekRemainingMs,
  formatTimeRemaining,
} from './leagues';
import { cn } from '../utils/cn';

interface LeaguesSectionProps {
  division: number; // 0 to 5
  playerScore: number;
  playerName: string;
  onClaimWeeklyReward?: () => void;
  hasUnclaimedWeeklyReward?: boolean;
  lang: 'uk' | 'ru';
}

export const LeaguesSection: React.FC<LeaguesSectionProps> = ({
  division,
  playerScore,
  playerName,
  onClaimWeeklyReward,
  hasUnclaimedWeeklyReward,
  lang,
}) => {
  const [remMs, setRemMs] = useState(getWeekRemainingMs());

  useEffect(() => {
    const timer = setInterval(() => setRemMs(getWeekRemainingMs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const divInfo: DivisionInfo = DIVISIONS[division] || DIVISIONS[0];
  const competitors: LeagueCompetitor[] = generateLeagueBracket(division, playerScore, playerName);
  const playerIndex = competitors.findIndex((c) => c.isPlayer);
  const playerRank = playerIndex >= 0 ? playerIndex + 1 : 1;

  const isPromotionZone = playerRank <= divInfo.promoteTop && divInfo.promoteTop > 0;
  const isDemotionZone =
    divInfo.demoteBottom > 0 && playerRank > competitors.length - divInfo.demoteBottom;

  return (
    <div className="space-y-3.5">
      {/* DIVISION HERO BANNER */}
      <div
        className={cn(
          'p-4 rounded-3xl border shadow-xl relative overflow-hidden bg-gradient-to-r',
          divInfo.bgGradient
        )}
        style={{ borderColor: `${divInfo.color}60` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl filter drop-shadow">{divInfo.badge}</span>
            <div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                {lang === 'uk' ? 'Поточна ліга' : 'Текущая лига'}
              </div>
              <h3 className="text-base font-black text-white" style={{ color: divInfo.color }}>
                {lang === 'uk' ? divInfo.nameUk : divInfo.nameRu}
              </h3>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-mono font-black text-white">
              ⏱️ {formatTimeRemaining(remMs, lang)}
            </div>
            <div className="text-[10px] text-white/50">
              {lang === 'uk' ? 'до підсумків тижня' : 'до итогов недели'}
            </div>
          </div>
        </div>

        {/* Player Status In League */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-black">
            <span className="text-white/60">{lang === 'uk' ? 'Твоє місце:' : 'Твоё место:'}</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full font-mono',
                isPromotionZone
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : isDemotionZone
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              )}
            >
              #{playerRank} {isPromotionZone ? '🟢 Зона підвищення' : isDemotionZone ? '🔴 Зона вильоту' : '🟡 Безпечна зона'}
            </span>
          </div>

          <div className="font-mono font-bold text-amber-200">
            {playerScore.toLocaleString()} 🫓
          </div>
        </div>
      </div>

      {/* REWARD NOTICE / CLAIM */}
      {hasUnclaimedWeeklyReward && onClaimWeeklyReward && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center gap-2 font-black text-xs">
            <span className="text-lg">🎁</span>
            <span>{lang === 'uk' ? 'Нагорода за минулий тиждень готова!' : 'Награда за прошлую неделю готова!'}</span>
          </div>
          <button
            type="button"
            onClick={onClaimWeeklyReward}
            className="px-3 py-1 rounded-xl bg-stone-950 text-amber-300 font-black text-xs hover:bg-stone-900 active:scale-95 transition cursor-pointer"
          >
            {lang === 'uk' ? 'Забрати' : 'Забрать'}
          </button>
        </div>
      )}

      {/* DIVISION REWARDS PREVIEW */}
      <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/10 space-y-1.5 text-xs">
        <div className="font-bold text-white/70 text-[11px] mb-1">
          🏆 {lang === 'uk' ? 'Нагороди наприкінці тижня:' : 'Награды в конце недели:'}
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
            <div className="font-black text-emerald-300">🥇 1 Місце</div>
            <div className="font-bold text-white/80">{divInfo.rewards.top1.label}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
            <div className="font-black text-emerald-300">🥈 2 Місце</div>
            <div className="font-bold text-white/80">{divInfo.rewards.top2.label}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
            <div className="font-black text-emerald-300">🥉 3 Місце</div>
            <div className="font-bold text-white/80">{divInfo.rewards.top3.label}</div>
          </div>
        </div>
      </div>

      {/* LEAGUE BRACKET TABLE */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-white/50 px-2 py-1">
          <span>{lang === 'uk' ? 'Учасники групи (20 пекарів)' : 'Участники группы (20 пекарей)'}</span>
          <span>{lang === 'uk' ? 'Очки тижня' : 'Очки недели'}</span>
        </div>

        <div className="space-y-1">
          {competitors.map((c, idx) => {
            const rank = idx + 1;
            const isMe = c.isPlayer;
            const isPromo = rank <= divInfo.promoteTop && divInfo.promoteTop > 0;
            const isDemo = divInfo.demoteBottom > 0 && rank > competitors.length - divInfo.demoteBottom;

            return (
              <div
                key={c.id}
                className={cn(
                  'px-3 py-2 rounded-xl border flex items-center justify-between transition-all text-xs',
                  isMe
                    ? 'border-amber-400 bg-amber-500/20 shadow-md font-bold'
                    : isPromo
                    ? 'border-emerald-500/20 bg-emerald-950/20'
                    : isDemo
                    ? 'border-red-500/20 bg-red-950/20'
                    : 'border-white/5 bg-zinc-950/40'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'w-5 font-mono font-black text-center',
                      rank === 1
                        ? 'text-yellow-400'
                        : rank === 2
                        ? 'text-slate-300'
                        : rank === 3
                        ? 'text-amber-600'
                        : 'text-white/40'
                    )}
                  >
                    {rank}
                  </span>
                  <span className="text-base">{c.avatar}</span>
                  <span className={cn('truncate', isMe ? 'text-amber-200 font-black' : 'text-white/80')}>
                    {c.name} {isMe && `(${lang === 'uk' ? 'Ти' : 'Ты'})`}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isPromo && <span className="text-[10px] text-emerald-400">▲</span>}
                  {isDemo && <span className="text-[10px] text-red-400">▼</span>}
                  <span className="font-mono font-bold text-white/90">
                    {c.score.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
