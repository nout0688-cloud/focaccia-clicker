export interface AncientRecipe {
  id: string;
  nameUk: string;
  nameRu: string;
  emoji: string;
  taglineUk: string;
  taglineRu: string;
  loreUk: string;
  loreRu: string;
  cost: {
    ingredients: Record<string, number>;
    diamonds: number;
    minPrestige?: number;
  };
  bonusDescriptionUk: string;
  bonusDescriptionRu: string;
  bonuses: {
    bossDamageMult?: number;
    clickPowerMult?: number;
    cpsMult?: number;
    offlineHoursAdd?: number;
    energyRegenMult?: number;
    catExpeditionSpeedMult?: number;
    catExpeditionLootMult?: number;
    potionDurationMult?: number;
    critChanceAdd?: number;
  };
}

export const ANCIENT_RECIPES: AncientRecipe[] = [
  {
    id: 'recipe_dragon',
    nameUk: 'Пекельна Фокача Дракона',
    nameRu: 'Адская Фокачча Дракона',
    emoji: '🐉',
    taglineUk: '+25% урону по всіх босах та рейду',
    taglineRu: '+25% урона по всем боссам и рейду',
    loreUk: 'Випечена в жерлі вулкана у полум’ї стародавнього дракона з вулканічними оливками.',
    loreRu: 'Испечена в жерле вулкана в пламени древнего дракона с вулканическими оливками.',
    cost: {
      ingredients: { volcano_olive: 4, star_yeast: 2 },
      diamonds: 15,
    },
    bonusDescriptionUk: '+25% урону по босах та рейду назавжди',
    bonusDescriptionRu: '+25% урона по боссам и рейду навсегда',
    bonuses: {
      bossDamageMult: 1.25,
    },
  },
  {
    id: 'recipe_astral',
    nameUk: 'Астральний Коржик Мандрівника',
    nameRu: 'Астральная Лепёшка Странника',
    emoji: '🌌',
    taglineUk: '+6 год. офлайну та +20% до відновлення енергії',
    taglineRu: '+6 ч. офлайна и +20% к восстановлению энергии',
    loreUk: 'Тісто замішане на зоряному пилі сузір’я Пекаря, що сповільнює біг часу.',
    loreRu: 'Тесто замешано на звёздной пыли созвездия Пекаря, замедляющей ход времени.',
    cost: {
      ingredients: { star_yeast: 3, moon_honey: 4 },
      diamonds: 25,
    },
    bonusDescriptionUk: '+6 год. до максимуму офлайн-доходу та +20% до регену енергії',
    bonusDescriptionRu: '+6 ч. к максимуму офлайн-дохода и +20% к регену энергии',
    bonuses: {
      offlineHoursAdd: 6,
      energyRegenMult: 1.20,
    },
  },
  {
    id: 'recipe_imperial_truffle',
    nameUk: 'Імператорська Трюфельна Фокача',
    nameRu: 'Императорская Трюфельная Фокачча',
    emoji: '🍄',
    taglineUk: '+50% сили кліку та +15% CPS назавжди',
    taglineRu: '+50% силы клика и +15% CPS навсегда',
    loreUk: 'Секретний рецепт монархів Лігурії: тонкі скибочки золотого трюфеля та містичний базилік.',
    loreRu: 'Секретный рецепт монархов Лигурии: тонкие ломтики золотого трюфеля и мистический базилик.',
    cost: {
      ingredients: { truffle: 3, mystic_basil: 5 },
      diamonds: 50,
    },
    bonusDescriptionUk: '+50% сили кліку та +15% CPS назавжди',
    bonusDescriptionRu: '+50% силы клика и +15% CPS навсегда',
    bonuses: {
      clickPowerMult: 1.50,
      cpsMult: 1.15,
    },
  },
  {
    id: 'recipe_druid_whisper',
    nameUk: 'Смарагдовий Шепіт Друїда',
    nameRu: 'Изумрудный Шёпот Друида',
    emoji: '🍃',
    taglineUk: '+35% ефективності котячих експедицій',
    taglineRu: '+35% эффективности кошачьих экспедиций',
    loreUk: 'Оповита лісовою магією хранителів природи, що благословляє котика на щедрий лут.',
    loreRu: 'Окутана лесной магией хранителей природы, благословляющей котика на щедрую добычу.',
    cost: {
      ingredients: { mystic_basil: 6, moon_honey: 4 },
      diamonds: 30,
    },
    bonusDescriptionUk: 'Експедиції на 25% швидші та приносять +35% здобичі',
    bonusDescriptionRu: 'Экспедиции на 25% быстрее и приносят +35% добычи',
    bonuses: {
      catExpeditionSpeedMult: 0.75,
      catExpeditionLootMult: 1.35,
    },
  },
  {
    id: 'recipe_genesis',
    nameUk: 'Фокача Першопочатку Буття',
    nameRu: 'Фокачча Первоначала Бытия',
    emoji: '♾️',
    taglineUk: '+25% CPS, +50% тривалості зіллів та +5% криту',
    taglineRu: '+25% CPS, +50% длительности зелий и +5% крита',
    loreUk: 'Легендарне первозданне тісто, що зберегло космічний жар зародження всесвіту.',
    loreRu: 'Легендарное первозданное тесто, сохранившее космический жар зарождения вселенной.',
    cost: {
      ingredients: { truffle: 4, volcano_olive: 5, star_yeast: 5 },
      diamonds: 80,
      minPrestige: 1,
    },
    bonusDescriptionUk: '+25% CPS, +50% до часу дії алхімічних зіллів, +5% крит',
    bonusDescriptionRu: '+25% CPS, +50% ко времени действия алхимических зелий, +5% крит',
    bonuses: {
      cpsMult: 1.25,
      potionDurationMult: 1.50,
      critChanceAdd: 0.05,
    },
  },
];

export interface RecipeBonuses {
  bossDamageMult: number;
  clickPowerMult: number;
  cpsMult: number;
  offlineHoursAdd: number;
  energyRegenMult: number;
  catExpeditionSpeedMult: number;
  catExpeditionLootMult: number;
  potionDurationMult: number;
  critChanceAdd: number;
}

export function getCombinedRecipeBonuses(unlockedIds: string[] = []): RecipeBonuses {
  const result: RecipeBonuses = {
    bossDamageMult: 1,
    clickPowerMult: 1,
    cpsMult: 1,
    offlineHoursAdd: 0,
    energyRegenMult: 1,
    catExpeditionSpeedMult: 1,
    catExpeditionLootMult: 1,
    potionDurationMult: 1,
    critChanceAdd: 0,
  };

  const set = new Set(unlockedIds);
  for (const recipe of ANCIENT_RECIPES) {
    if (!set.has(recipe.id)) continue;
    const b = recipe.bonuses;
    if (b.bossDamageMult) result.bossDamageMult *= b.bossDamageMult;
    if (b.clickPowerMult) result.clickPowerMult *= b.clickPowerMult;
    if (b.cpsMult) result.cpsMult *= b.cpsMult;
    if (b.offlineHoursAdd) result.offlineHoursAdd += b.offlineHoursAdd;
    if (b.energyRegenMult) result.energyRegenMult *= b.energyRegenMult;
    if (b.catExpeditionSpeedMult) result.catExpeditionSpeedMult *= b.catExpeditionSpeedMult;
    if (b.catExpeditionLootMult) result.catExpeditionLootMult *= b.catExpeditionLootMult;
    if (b.potionDurationMult) result.potionDurationMult *= b.potionDurationMult;
    if (b.critChanceAdd) result.critChanceAdd += b.critChanceAdd;
  }

  return result;
}

export function canUnlockRecipe(
  recipe: AncientRecipe,
  ingredients: Record<string, number> = {},
  diamonds: number = 0,
  prestige: number = 0,
  unlockedIds: string[] = []
): { canUnlock: boolean; reason?: string } {
  if (unlockedIds.includes(recipe.id)) {
    return { canUnlock: false, reason: 'already_unlocked' };
  }

  if (recipe.cost.minPrestige && prestige < recipe.cost.minPrestige) {
    return { canUnlock: false, reason: 'prestige_low' };
  }

  if (diamonds < recipe.cost.diamonds) {
    return { canUnlock: false, reason: 'diamonds_low' };
  }

  for (const [ingId, count] of Object.entries(recipe.cost.ingredients)) {
    if ((ingredients[ingId] || 0) < count) {
      return { canUnlock: false, reason: 'ingredients_low' };
    }
  }

  return { canUnlock: true };
}
