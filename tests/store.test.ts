import { describe, expect, it } from 'vitest';
import { RestaurantStore, type StorageLike } from '../src/store';

function storage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe('restaurant local save', () => {
  it('starts with 100 coins and persists unique learned words', () => {
    const backend = storage();
    const store = new RestaurantStore(backend);
    expect(store.snapshot().coins).toBe(100);
    expect(store.learnWord('tomato')).toBe(true);
    expect(store.learnWord('tomato')).toBe(false);
    expect(new RestaurantStore(backend).snapshot().words).toEqual(['tomato']);
  });

  it('settles a meal exactly once, including duplicate payment clicks', () => {
    const store = new RestaurantStore(storage());
    store.recordMeal('meal-1', 'pizza', 30);
    expect(store.snapshot().coins).toBe(100);
    expect(store.settleMeal('meal-1')).toBe(true);
    expect(store.settleMeal('meal-1')).toBe(false);
    store.recordMeal('meal-1', 'pizza', 30);
    expect(store.settleMeal('meal-1')).toBe(false);
    expect(store.snapshot().coins).toBe(130);
  });

  it('recovers pending payment after reload without paying twice', () => {
    const backend = storage();
    const first = new RestaurantStore(backend);
    first.recordMeal('meal-reload', 'fruit_salad', 25);
    const reloaded = new RestaurantStore(backend);
    expect(reloaded.settlePending()).toBe(25);
    expect(reloaded.snapshot().coins).toBe(125);
    expect(reloaded.settlePending()).toBe(0);
    expect(new RestaurantStore(backend).snapshot().coins).toBe(125);
  });

  it('reaches exactly 185 coins and 12 words after one of each recipe', () => {
    const store = new RestaurantStore(storage());
    const words = ['tomato', 'egg', 'noodles', 'boil', 'serve', 'bread', 'cheese', 'chop', 'bake', 'apple', 'banana', 'grapes'] as const;
    for (const word of words) store.learnWord(word);
    for (const [ref, recipe, amount] of [['1', 'tomato_egg_noodles', 30], ['2', 'pizza', 30], ['3', 'fruit_salad', 25]] as const) {
      store.recordMeal(ref, recipe, amount);
      store.settleMeal(ref);
    }
    expect(store.snapshot().coins).toBe(185);
    expect(store.snapshot().words).toHaveLength(12);
    store.reset();
    expect(store.snapshot().coins).toBe(100);
    expect(store.snapshot().words).toHaveLength(0);
    expect(store.snapshot().pending).toEqual({});
  });

  it('recovers safely from corrupt JSON', () => {
    const backend = storage();
    backend.setItem('little-chef-restaurant-v1', '{broken');
    expect(new RestaurantStore(backend).snapshot().coins).toBe(100);
  });
});
