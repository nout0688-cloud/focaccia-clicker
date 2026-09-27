export interface ArcadeItem {
  id: string;
  type: 'focaccia' | 'golden' | 'ingredient' | 'diamond' | 'bomb';
  name: string;
  icon: string;
  points: number;
  ingredientId?: string;
  diamonds?: number;
  focacciaBaseMult: number;
}

export const ARCADE_ITEMS: ArcadeItem[] = [
  { id: 'foc_classic', type: 'focaccia', name: 'Класична Фокача', icon: '🫓', points: 100, focacciaBaseMult: 1 },
  { id: 'foc_olive', type: 'focaccia', name: 'Фокача з Оливками', icon: '🥖', points: 250, focacciaBaseMult: 2.5 },
  { id: 'foc_tomato', type: 'focaccia', name: 'Томатна Фокача', icon: '🍕', points: 400, focacciaBaseMult: 4 },
  { id: 'foc_golden', type: 'golden', name: 'Золота Скоринка', icon: '🌟', points: 1500, focacciaBaseMult: 15 },
  { id: 'ing_basil', type: 'ingredient', name: 'Містичний Базилік', icon: '🌿', points: 300, ingredientId: 'mystic_basil', focacciaBaseMult: 3 },
  { id: 'ing_honey', type: 'ingredient', name: 'Місячний Мед', icon: '🍯', points: 350, ingredientId: 'moon_honey', focacciaBaseMult: 3.5 },
  { id: 'ing_yeast', type: 'ingredient', name: 'Зоряні Дріжджі', icon: '🌾', points: 600, ingredientId: 'star_yeast', focacciaBaseMult: 6 },
  { id: 'ing_olive', type: 'ingredient', name: 'Вулканічні Оливки', icon: '🫒', points: 700, ingredientId: 'volcano_olive', focacciaBaseMult: 7 },
  { id: 'ing_truffle', type: 'ingredient', name: 'Золотий Трюфель', icon: '🍄', points: 2000, ingredientId: 'truffle', focacciaBaseMult: 20 },
  { id: 'gem_dough', type: 'diamond', name: 'Алмазне Тісто', icon: '💎', points: 1200, diamonds: 1, focacciaBaseMult: 10 },
  { id: 'bomb_coal', type: 'bomb', name: 'Пригорілий Шматок', icon: '💣', points: -500, focacciaBaseMult: 0 },
  { id: 'bomb_mold', type: 'bomb', name: 'Цвілий Коржик', icon: '🪳', points: -300, focacciaBaseMult: 0 },
];

export interface ChefWheelSegment {
  id: string;
  icon: string;
  labelUk: string;
  labelRu: string;
  type: 'focaccia' | 'diamonds' | 'ingredient' | 'xp' | 'buff';
  amount?: number;
  ingredientId?: string;
  buffId?: string;
  color: string;
}

export const CHEF_WHEEL_SEGMENTS: ChefWheelSegment[] = [
  { id: 'w_dia5', icon: '💎', labelUk: '5 Діамантів', labelRu: '5 Алмазов', type: 'diamonds', amount: 5, color: '#0ea5e9' },
  { id: 'w_foc_big', icon: '🫓', labelUk: 'Купа Фокач', labelRu: 'Гора Фокачч', type: 'focaccia', amount: 50000, color: '#f59e0b' },
  { id: 'w_truffle', icon: '🍄', labelUk: '2 Трюфелі', labelRu: '2 Трюфеля', type: 'ingredient', ingredientId: 'truffle', amount: 2, color: '#a855f7' },
  { id: 'w_yeast', icon: '🌾', labelUk: '3 Дріжджів', labelRu: '3 Дрожжей', type: 'ingredient', ingredientId: 'star_yeast', amount: 3, color: '#eab308' },
  { id: 'w_pass_xp', icon: '🎫', labelUk: '50 Pass XP', labelRu: '50 Pass XP', type: 'xp', amount: 50, color: '#ec4899' },
  { id: 'w_olives', icon: '🫒', labelUk: '3 Оливки', labelRu: '3 Оливки', type: 'ingredient', ingredientId: 'volcano_olive', amount: 3, color: '#10b981' },
  { id: 'w_dia15', icon: '💎', labelUk: '15 Діамантів!', labelRu: '15 Алмазов!', type: 'diamonds', amount: 15, color: '#06b6d4' },
  { id: 'w_buff', icon: '⚡', labelUk: 'Овердрайв!', labelRu: 'Овердрайв!', type: 'buff', buffId: 'yeast_overdrive', color: '#f97316' },
];
