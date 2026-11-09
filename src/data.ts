export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 900;

export type StationId = 'fridge' | 'cuttingBoard' | 'stove' | 'oven' | 'counter';
export type IngredientId = 'tomato' | 'egg' | 'noodles' | 'bread' | 'cheese' | 'apple' | 'banana' | 'grapes';
export type VerbId = 'chop' | 'boil' | 'bake' | 'serve';
export type WordId = IngredientId | VerbId;
export type RecipeId = 'tomato_egg_noodles' | 'pizza' | 'fruit_salad';

export interface Ingredient {
  id: IngredientId;
  english: string;
  chinese: string;
  image: string;
}

export interface RecipeStep {
  station: StationId;
  ingredientId?: IngredientId;
  verb?: VerbId;
  verbCn?: string;
}

export interface Recipe {
  id: RecipeId;
  english: string;
  chinese: string;
  price: number;
  dishImage: string;
  ingredients: { id: IngredientId; count: number }[];
  steps: RecipeStep[];
}

export type VesselId = 'pot' | 'oven' | 'bowl';
export interface PreparationRule {
  requiresCut: boolean;
  destination: VesselId;
  preparedImage?: string;
}

export interface Resident {
  id: string;
  name: string;
  chinese: string;
  female: boolean;
  image: string;
}

export const INGREDIENTS: Record<IngredientId, Ingredient> = {
  tomato: { id: 'tomato', english: 'Tomato', chinese: '番茄', image: '/assets/ingredients/tomato.webp' },
  egg: { id: 'egg', english: 'Egg', chinese: '鸡蛋', image: '/assets/ingredients/egg.webp' },
  noodles: { id: 'noodles', english: 'Noodles', chinese: '面条', image: '/assets/ingredients/noodles.webp' },
  bread: { id: 'bread', english: 'Bread', chinese: '面包', image: '/assets/ingredients/bread.webp' },
  cheese: { id: 'cheese', english: 'Cheese', chinese: '芝士', image: '/assets/ingredients/cheese.webp' },
  apple: { id: 'apple', english: 'Apple', chinese: '苹果', image: '/assets/ingredients/apple.webp' },
  banana: { id: 'banana', english: 'Banana', chinese: '香蕉', image: '/assets/ingredients/banana.webp' },
  grapes: { id: 'grapes', english: 'Grapes', chinese: '葡萄', image: '/assets/ingredients/grapes.webp' },
};

export const RECIPES: Recipe[] = [
  {
    id: 'tomato_egg_noodles', english: 'Tomato Egg Noodles', chinese: '番茄鸡蛋面', price: 30,
    dishImage: '/assets/dishes/tomato_egg_noodles_food.webp',
    ingredients: [{ id: 'tomato', count: 2 }, { id: 'egg', count: 1 }, { id: 'noodles', count: 1 }],
    steps: [
      { station: 'fridge', ingredientId: 'tomato' },
      { station: 'fridge', ingredientId: 'egg' },
      { station: 'fridge', ingredientId: 'noodles' },
      { station: 'cuttingBoard', verb: 'chop', verbCn: '切一切' },
      { station: 'stove', verb: 'boil', verbCn: '煮一煮' },
    ],
  },
  {
    id: 'pizza', english: 'Pizza', chinese: '披萨', price: 30,
    dishImage: '/assets/dishes/pizza_food.webp',
    ingredients: [{ id: 'bread', count: 1 }, { id: 'tomato', count: 1 }, { id: 'cheese', count: 1 }],
    steps: [
      { station: 'fridge', ingredientId: 'bread' },
      { station: 'fridge', ingredientId: 'tomato' },
      { station: 'fridge', ingredientId: 'cheese' },
      { station: 'cuttingBoard', verb: 'chop', verbCn: '切一切' },
      { station: 'oven', verb: 'bake', verbCn: '烤一烤' },
    ],
  },
  {
    id: 'fruit_salad', english: 'Fruit Salad', chinese: '水果沙拉', price: 25,
    dishImage: '/assets/dishes/fruit_salad_food.webp',
    ingredients: [{ id: 'apple', count: 1 }, { id: 'banana', count: 1 }, { id: 'grapes', count: 1 }],
    steps: [
      { station: 'fridge', ingredientId: 'apple' },
      { station: 'fridge', ingredientId: 'banana' },
      { station: 'fridge', ingredientId: 'grapes' },
      { station: 'cuttingBoard', verb: 'chop', verbCn: '切一切' },
    ],
  },
];

export const PREPARATION_RULES: Record<RecipeId, Partial<Record<IngredientId, PreparationRule>>> = {
  tomato_egg_noodles: {
    tomato: { requiresCut: true, destination: 'pot', preparedImage: '/assets/prepared/tomato_chunks.webp' },
  },
  pizza: {
    tomato: { requiresCut: true, destination: 'oven', preparedImage: '/assets/prepared/tomato_slices.webp' },
    cheese: { requiresCut: true, destination: 'oven', preparedImage: '/assets/prepared/cheese_shreds.webp' },
  },
  fruit_salad: {
    apple: { requiresCut: true, destination: 'bowl' },
    banana: { requiresCut: true, destination: 'bowl' },
  },
};

export function preparationFor(recipe: Recipe, id: IngredientId): PreparationRule {
  const destination: VesselId = recipe.id === 'tomato_egg_noodles' ? 'pot' : recipe.id === 'pizza' ? 'oven' : 'bowl';
  return PREPARATION_RULES[recipe.id][id] ?? { requiresCut: false, destination };
}

export const RESIDENTS: Resident[] = [
  { id: 'mei', name: 'Mei', chinese: '梅梅', female: true, image: '/assets/people/mei.webp' },
  { id: 'leo', name: 'Leo', chinese: '里奥', female: false, image: '/assets/people/leo.webp' },
  { id: 'aya', name: 'Aya', chinese: '阿雅', female: true, image: '/assets/people/aya.webp' },
  { id: 'noah', name: 'Noah', chinese: '诺亚', female: false, image: '/assets/people/noah.webp' },
  { id: 'lina', name: 'Lina', chinese: '丽娜', female: true, image: '/assets/people/lina.webp' },
  { id: 'grandpa', name: 'Grandpa Ben', chinese: '本爷爷', female: false, image: '/assets/people/grandpa.webp' },
  { id: 'rosa', name: 'Rosa', chinese: '罗莎', female: true, image: '/assets/people/rosa.webp' },
  { id: 'eli', name: 'Eli', chinese: '伊莱', female: false, image: '/assets/people/eli.webp' },
  { id: 'mira', name: 'Mira', chinese: '米拉', female: true, image: '/assets/people/mira.webp' },
  { id: 'sam', name: 'Sam', chinese: '山姆', female: false, image: '/assets/people/sam.webp' },
];

export const REACTIONS = [
  { id: 'delicious', text: 'Mmm! That was delicious!' },
  { id: 'happy_tummy', text: 'My tummy is so happy!' },
  { id: 'best_meal', text: 'Best meal ever!' },
  { id: 'thank_you', text: 'So tasty! Thank you!' },
  { id: 'every_bite', text: 'I loved every bite!' },
  { id: 'super_yummy', text: 'That was super yummy!' },
  { id: 'again', text: 'Can I have this again tomorrow?' },
  { id: 'more_please', text: 'More please! It is so good!' },
] as const;

export const WORD_META: Record<WordId, { english: string; chinese: string }> = {
  apple: { english: 'apple', chinese: '苹果' },
  bake: { english: 'bake', chinese: '烘烤' },
  banana: { english: 'banana', chinese: '香蕉' },
  boil: { english: 'boil', chinese: '水煮' },
  bread: { english: 'bread', chinese: '面包' },
  cheese: { english: 'cheese', chinese: '芝士' },
  chop: { english: 'chop', chinese: '切切' },
  egg: { english: 'egg', chinese: '鸡蛋' },
  grapes: { english: 'grapes', chinese: '葡萄' },
  noodles: { english: 'noodles', chinese: '面条' },
  serve: { english: 'serve', chinese: '上菜' },
  tomato: { english: 'tomato', chinese: '番茄' },
};

export const ALL_WORDS = Object.keys(WORD_META) as WordId[];

export const STATION_META: Record<StationId, { name: string; english: string }> = {
  fridge: { name: '冰箱', english: 'Find the ingredient' },
  cuttingBoard: { name: '刀架', english: 'Chop, chop!' },
  stove: { name: '灶台', english: 'Boil, boil!' },
  oven: { name: '烤箱', english: 'Bake, bake!' },
  counter: { name: '出餐柜台', english: 'Plate it up!' },
};

export const CHEF_ANCHORS: Record<StationId, { x: number; y: number }> = {
  fridge: { x: 335, y: 345 },
  cuttingBoard: { x: 470, y: 345 },
  stove: { x: 710, y: 345 },
  oven: { x: 850, y: 345 },
  counter: { x: 720, y: 345 },
};

export const STATION_HIT_AREAS: Record<StationId, { x: number; y: number; width: number; height: number }> = {
  fridge: { x: 135, y: 45, width: 190, height: 280 },
  cuttingBoard: { x: 390, y: 18, width: 215, height: 140 },
  stove: { x: 635, y: 110, width: 200, height: 180 },
  oven: { x: 855, y: 70, width: 205, height: 255 },
  counter: { x: 450, y: 365, width: 480, height: 110 },
};

export const TABLE_ANCHORS = [
  { x: 270, y: 590 }, { x: 930, y: 590 }, { x: 205, y: 778 }, { x: 995, y: 778 },
];
export const GUEST_SEATS = [
  { x: 395, y: 650 }, { x: 805, y: 650 }, { x: 360, y: 820 }, { x: 840, y: 820 },
];
export const SERVE_ANCHORS = [
  { x: 440, y: 680 }, { x: 760, y: 680 }, { x: 350, y: 825 }, { x: 850, y: 825 },
];

export function recipeById(id: RecipeId): Recipe {
  const recipe = RECIPES.find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown recipe: ${id}`);
  return recipe;
}
