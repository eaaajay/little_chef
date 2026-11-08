import { describe, expect, it } from 'vitest';
import { RECIPES, recipeById, type Recipe, type VerbId, type WordId } from '../src/data';
import { OrderProgress } from '../src/logic';

function finishRecipe(recipe: Recipe): { progress: OrderProgress; words: WordId[] } {
  const progress = new OrderProgress(recipe);
  const words: WordId[] = [];
  for (const step of recipe.steps) {
    const result = step.ingredientId ? progress.takeIngredient(step.ingredientId) : progress.performStation(step.station);
    expect(result.ok, `${recipe.id}: ${step.station}`).toBe(true);
    if (result.word) words.push(result.word);
  }
  return { progress, words };
}

describe('restaurant recipe state machine', () => {
  it('supports all three exact golden paths and prices', () => {
    expect(RECIPES.map((recipe) => recipe.price)).toEqual([30, 30, 25]);
    for (const recipe of RECIPES) {
      expect(recipe.steps.some((step) => step.station === 'counter')).toBe(false);
      const { progress } = finishRecipe(recipe);
      expect(progress.dishReady).toBe(true);
      expect(progress.task().table).toBe(true);
      expect(progress.collected).toHaveLength(3);
      expect(progress.performStation('counter').ok).toBe(false);
    }
  });

  it('takes two tomatoes as one step and rejects wrong or duplicate picks', () => {
    const noodles = new OrderProgress(recipeById('tomato_egg_noodles'));
    expect(noodles.takeIngredient('egg').ok).toBe(false);
    const tomato = noodles.takeIngredient('tomato');
    expect(tomato.ok).toBe(true);
    expect(tomato.ingredientCount).toBe(2);
    expect(noodles.stepIndex).toBe(1);
    expect(noodles.takeIngredient('tomato').ok).toBe(false);
    expect(noodles.currentStep?.ingredientId).toBe('egg');
  });

  it('uses the original chop/boil/bake timings and collects twelve unique words', () => {
    const words = new Set<WordId>();
    for (const recipe of RECIPES) {
      const progress = new OrderProgress(recipe);
      for (const step of recipe.steps) {
        const result = step.ingredientId ? progress.takeIngredient(step.ingredientId) : progress.performStation(step.station);
        if (result.word) words.add(result.word);
        if (result.verb) {
          const expected: Record<VerbId, number> = { chop: 1200, boil: 2200, bake: 2200, serve: 450 };
          expect(result.duration).toBe(expected[result.verb]);
        }
      }
      words.add('serve'); // Collected when the chef actually reaches the guest's table.
    }
    expect(words.size).toBe(12);
  });

  it('does not plate before all required cooking stations are complete', () => {
    const pizza = new OrderProgress(recipeById('pizza'));
    expect(pizza.performStation('counter').ok).toBe(false);
    expect(pizza.dishReady).toBe(false);
    expect(pizza.performStation('oven').ok).toBe(false);
  });
});
