import React from 'react';
import {
  ANCIENT_RECIPES,
  AncientRecipe,
  canUnlockRecipe,
  getCombinedRecipeBonuses,
} from './recipes';
import { INGREDIENTS } from './alchemy';

interface RecipesSectionProps {
  unlockedRecipes: string[];
  ingredients: Record<string, number>;
  playerDiamonds: number;
  playerPrestige: number;
  onUnlockRecipe: (recipe: AncientRecipe) => void;
  lang: 'uk' | 'ru';
}

export const RecipesSection: React.FC<RecipesSectionProps> = ({
  unlockedRecipes = [],
  ingredients = {},
  playerDiamonds,
  playerPrestige,
  onUnlockRecipe,
  lang,
}) => {
  const bonuses = getCombinedRecipeBonuses(unlockedRecipes);
  const totalCount = ANCIENT_RECIPES.length;
  const unlockedCount = unlockedRecipes.length;

  return (
    <div className="space-y-4 pb-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br from-amber-950/70 via-stone-900 to-amber-900/30 border border-amber-500/40 shadow-xl">
        <div className="absolute -top-12 -right-8 w-44 h-44 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl filter drop-shadow">📖</span>
            <div>
              <h2 className="text-sm font-black text-amber-200">
                {lang === 'uk' ? 'Книга Прадавніх Рецептів' : 'Книга Древних Рецептов'}
              </h2>
              <p className="text-[10px] text-amber-300/70">
                {lang === 'uk'
                  ? 'Секретні легендарні фокачі з постійними пасивними бонусами'
                  : 'Секретные легендарные фокаччи с постоянными пассивными бонусами'}
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-full bg-black/50 border border-amber-400/40 text-[11px] font-black text-amber-300 font-mono shrink-0 shadow-inner">
            {unlockedCount} / {totalCount}
          </div>
        </div>

        {/* Active Combined Account Buffs Banner */}
        <div className="mt-3 p-2.5 rounded-2xl bg-black/40 border border-amber-500/20 grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 text-stone-300">
            <span>⚔️</span>
            <span>
              {lang === 'uk' ? 'Урон босам:' : 'Урон боссам:'}{' '}
              <strong className="text-red-300 font-mono">
                {bonuses.bossDamageMult > 1 ? `+${Math.round((bonuses.bossDamageMult - 1) * 100)}%` : '0%'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-300">
            <span>👆</span>
            <span>
              {lang === 'uk' ? 'Сила кліку:' : 'Сила клика:'}{' '}
              <strong className="text-amber-300 font-mono">
                {bonuses.clickPowerMult > 1 ? `+${Math.round((bonuses.clickPowerMult - 1) * 100)}%` : '0%'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-300">
            <span>⏳</span>
            <span>
              {lang === 'uk' ? 'Офлайн час:' : 'Офлайн время:'}{' '}
              <strong className="text-cyan-300 font-mono">
                {bonuses.offlineHoursAdd > 0 ? `+${bonuses.offlineHoursAdd} год` : '0 год'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-300">
            <span>🧭</span>
            <span>
              {lang === 'uk' ? 'Експедиції:' : 'Экспедиции:'}{' '}
              <strong className="text-emerald-300 font-mono">
                {bonuses.catExpeditionLootMult > 1 ? `+${Math.round((bonuses.catExpeditionLootMult - 1) * 100)}%` : '0%'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Recipes List */}
      <div className="space-y-3">
        {ANCIENT_RECIPES.map((recipe) => {
          const isUnlocked = unlockedRecipes.includes(recipe.id);
          const { canUnlock } = canUnlockRecipe(
            recipe,
            ingredients,
            playerDiamonds,
            playerPrestige,
            unlockedRecipes
          );

          return (
            <div
              key={recipe.id}
              className={`relative overflow-hidden rounded-2xl p-3.5 border transition-all ${
                isUnlocked
                  ? 'bg-gradient-to-r from-amber-950/40 via-stone-900/90 to-yellow-950/30 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                  : 'bg-stone-900/80 border-white/10 hover:border-amber-500/30'
              }`}
            >
              {/* Top Row: Icon + Name + Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
                      isUnlocked
                        ? 'bg-amber-400/20 border-amber-400/40 shadow-inner'
                        : 'bg-white/5 border-white/10 grayscale opacity-80'
                    }`}
                  >
                    {recipe.emoji}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-amber-100 truncate">
                      {lang === 'uk' ? recipe.nameUk : recipe.nameRu}
                    </h3>
                    <div className="text-[10px] font-bold text-amber-400/90">
                      {lang === 'uk' ? recipe.taglineUk : recipe.taglineRu}
                    </div>
                  </div>
                </div>

                {isUnlocked ? (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                    {lang === 'uk' ? '✓ Розкрито' : '✓ Раскрыто'}
                  </span>
                ) : (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-stone-400 text-[9px] font-bold">
                    {lang === 'uk' ? '🔒 Закрито' : '🔒 Закрыто'}
                  </span>
                )}
              </div>

              {/* Lore description */}
              <p className="text-[10px] text-stone-400 leading-relaxed mb-3 italic">
                «{lang === 'uk' ? recipe.loreUk : recipe.loreRu}»
              </p>

              {/* Permanent Buff Banner */}
              <div
                className={`p-2 rounded-xl mb-3 flex items-center gap-2 text-[10px] font-bold border ${
                  isUnlocked
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-black/30 border-amber-500/20 text-amber-200/80'
                }`}
              >
                <span>✨</span>
                <span>{lang === 'uk' ? recipe.bonusDescriptionUk : recipe.bonusDescriptionRu}</span>
              </div>

              {/* If Locked: Cost & Unlock Action */}
              {!isUnlocked && (
                <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-stone-400">
                    {lang === 'uk' ? 'Необхідні інгредієнти та ресурси:' : 'Необходимые ингредиенты и ресурсы:'}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Ingredients needed */}
                    {Object.entries(recipe.cost.ingredients).map(([ingId, needed]) => {
                      const owned = ingredients[ingId] || 0;
                      const hasEnough = owned >= needed;
                      const ingInfo = INGREDIENTS[ingId];

                      return (
                        <span
                          key={ingId}
                          className={`px-2 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                            hasEnough
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                              : 'bg-red-950/30 border-red-500/30 text-red-300'
                          }`}
                        >
                          <span>{ingInfo?.icon || '🌿'}</span>
                          <span>{lang === 'uk' ? ingInfo?.nameUk : ingInfo?.nameRu}:</span>
                          <strong className="font-mono">
                            {owned}/{needed}
                          </strong>
                        </span>
                      );
                    })}

                    {/* Diamonds cost */}
                    <span
                      className={`px-2 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                        playerDiamonds >= recipe.cost.diamonds
                          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                          : 'bg-red-950/30 border-red-500/30 text-red-300'
                      }`}
                    >
                      <span>💎</span>
                      <span>
                        {recipe.cost.diamonds} {lang === 'uk' ? 'Діам.' : 'Диам.'}
                      </span>
                      <span className="font-mono text-[9px] opacity-75">({playerDiamonds})</span>
                    </span>

                    {/* Prestige requirement */}
                    {Boolean(recipe.cost.minPrestige) && (
                      <span
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                          playerPrestige >= (recipe.cost.minPrestige || 0)
                            ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                            : 'bg-red-950/30 border-red-500/30 text-red-300'
                        }`}
                      >
                        <span>🔄</span>
                        <span>
                          {lang === 'uk'
                            ? `Престиж ${recipe.cost.minPrestige}+`
                            : `Престиж ${recipe.cost.minPrestige}+`}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Unlock Button */}
                  <button
                    type="button"
                    disabled={!canUnlock}
                    onClick={() => onUnlockRecipe(recipe)}
                    className={`w-full mt-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
                      canUnlock
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 cursor-pointer active:scale-95 shadow-amber-500/25'
                        : 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <span>📜</span>
                    <span>
                      {lang === 'uk' ? 'Вивчити та Спекти Рецепт' : 'Изучить и Испечь Рецепт'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
