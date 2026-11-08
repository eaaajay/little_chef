import { INGREDIENTS, STATION_META, type IngredientId, type Recipe, type RecipeStep, type StationId, type VerbId, type WordId } from './data';

export interface StepResult {
  ok: boolean;
  word?: WordId;
  verb?: VerbId;
  duration?: number;
  ingredientCount?: number;
  finishedIngredients?: boolean;
  dishReady?: boolean;
}

export interface TaskDescriptor {
  station?: StationId;
  table?: boolean;
  text: string;
  english: string;
  stepNumber: number;
  progress: number;
}

/** Pure recipe state machine. Movement, timers and drawing deliberately live elsewhere. */
export class OrderProgress {
  readonly collected: { id: IngredientId; count: number }[] = [];
  private index = 0;
  private plated = false;

  constructor(readonly recipe: Recipe) {}

  get stepIndex(): number { return this.index; }
  get currentStep(): RecipeStep | undefined { return this.recipe.steps[this.index]; }
  get dishReady(): boolean { return this.plated; }

  takeIngredient(id: IngredientId): StepResult {
    const step = this.currentStep;
    if (this.plated || step?.station !== 'fridge' || step.ingredientId !== id) return { ok: false };
    const count = this.recipe.ingredients.find((item) => item.id === id)?.count ?? 1;
    this.collected.push({ id, count });
    this.index += 1;
    return {
      ok: true,
      word: id,
      ingredientCount: count,
      finishedIngredients: this.currentStep?.station !== 'fridge',
    };
  }

  performStation(station: StationId): StepResult {
    const step = this.currentStep;
    if (this.plated || !step || step.station !== station || station === 'fridge') return { ok: false };
    const verb = step.verb;
    this.index += 1;
    if (this.index >= this.recipe.steps.length) this.plated = true;
    return {
      ok: true,
      word: verb,
      verb,
      duration: verb === 'chop' ? 1200 : verb === 'boil' || verb === 'bake' ? 2200 : 450,
      dishReady: this.plated,
    };
  }

  task(): TaskDescriptor {
    if (this.plated) {
      return { table: true, text: '把菜端给点餐的客人', english: 'Serve it to the right table!', stepNumber: this.recipe.steps.length + 1, progress: 1 };
    }
    const step = this.currentStep;
    if (!step) return { text: '订单完成', english: 'Well done, chef!', stepNumber: this.recipe.steps.length, progress: 1 };
    if (step.ingredientId) {
      const ingredient = INGREDIENTS[step.ingredientId];
      const count = this.recipe.ingredients.find((item) => item.id === step.ingredientId)?.count ?? 1;
      return {
        station: 'fridge',
        text: `打开冰箱，取${ingredient.chinese}${count > 1 ? ` ×${count}` : ''}`,
        english: `Find the ${ingredient.english.toLowerCase()}.`,
        stepNumber: this.index + 1,
        progress: this.index / (this.recipe.steps.length + 1),
      };
    }
    const station = STATION_META[step.station];
    return {
      station: step.station,
      text: `去${station.name}${step.verbCn ?? ''}`,
      english: station.english,
      stepNumber: this.index + 1,
      progress: this.index / (this.recipe.steps.length + 1),
    };
  }
}
