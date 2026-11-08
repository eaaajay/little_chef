import { ALL_WORDS, type RecipeId, type WordId } from './data';

const SAVE_KEY = 'little-chef-restaurant-v1';
const STARTER_COINS = 100;

export interface PendingMeal { amount: number; recipeId: RecipeId }
export interface SaveState {
  version: 1;
  coins: number;
  words: WordId[];
  pending: Record<string, PendingMeal>;
  settledRefs: string[];
  soundOn: boolean;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

function initialState(soundOn = true): SaveState {
  return { version: 1, coins: STARTER_COINS, words: [], pending: {}, settledRefs: [], soundOn };
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

function parseState(raw: string | null): SaveState {
  if (!raw) return initialState();
  try {
    const value = JSON.parse(raw) as Partial<SaveState>;
    const words = Array.isArray(value.words) ? value.words.filter((word): word is WordId => ALL_WORDS.includes(word as WordId)) : [];
    const pending: Record<string, PendingMeal> = {};
    if (value.pending && typeof value.pending === 'object') {
      for (const [ref, meal] of Object.entries(value.pending)) {
        if (meal && typeof meal.amount === 'number' && Number.isFinite(meal.amount) && meal.amount > 0 && typeof meal.recipeId === 'string') {
          pending[ref] = { amount: meal.amount, recipeId: meal.recipeId as RecipeId };
        }
      }
    }
    return {
      version: 1,
      coins: typeof value.coins === 'number' && Number.isFinite(value.coins) && value.coins >= 0 ? Math.floor(value.coins) : STARTER_COINS,
      words: [...new Set(words)],
      pending,
      settledRefs: Array.isArray(value.settledRefs) ? value.settledRefs.filter((ref): ref is string => typeof ref === 'string').slice(-100) : [],
      soundOn: value.soundOn !== false,
    };
  } catch {
    return initialState();
  }
}

/** localStorage-backed wallet with idempotent pending-meal settlement. */
export class RestaurantStore {
  private state: SaveState;
  private readonly storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? (typeof localStorage === 'undefined' ? memoryStorage() : localStorage);
    try { this.state = parseState(this.storage.getItem(SAVE_KEY)); } catch { this.state = initialState(); }
  }

  snapshot(): SaveState {
    return { ...this.state, words: [...this.state.words], pending: { ...this.state.pending }, settledRefs: [...this.state.settledRefs] };
  }

  private save(): void {
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* Storage failure never blocks play. */ }
  }

  learnWord(word: WordId): boolean {
    if (this.state.words.includes(word)) return false;
    this.state.words = [...this.state.words, word].sort();
    this.save();
    return true;
  }

  recordMeal(ref: string, recipeId: RecipeId, amount: number): void {
    if (this.state.settledRefs.includes(ref) || this.state.pending[ref]) return;
    this.state.pending[ref] = { amount, recipeId };
    this.save();
  }

  settleMeal(ref: string): boolean {
    const meal = this.state.pending[ref];
    if (!meal || this.state.settledRefs.includes(ref)) return false;
    this.state.coins += meal.amount;
    delete this.state.pending[ref];
    this.state.settledRefs = [...this.state.settledRefs, ref].slice(-100);
    this.save();
    return true;
  }

  settlePending(): number {
    let total = 0;
    for (const [ref, meal] of Object.entries(this.state.pending)) {
      if (this.state.settledRefs.includes(ref)) { delete this.state.pending[ref]; continue; }
      total += meal.amount;
      this.state.settledRefs.push(ref);
      delete this.state.pending[ref];
    }
    if (total > 0) {
      this.state.coins += total;
      this.state.settledRefs = this.state.settledRefs.slice(-100);
      this.save();
    }
    return total;
  }

  setSound(on: boolean): void { this.state.soundOn = on; this.save(); }

  reset(): void {
    const soundOn = this.state.soundOn;
    this.state = initialState(soundOn);
    this.save();
  }
}
