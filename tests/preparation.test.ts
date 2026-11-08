import { describe, expect, it } from 'vitest';
import { preparationFor, recipeById } from '../src/data';

describe('recipe-specific cutting and vessel routing', () => {
  it('routes only tomato to the board before boiling noodles', () => {
    const recipe = recipeById('tomato_egg_noodles');
    expect(recipe.steps.map((step) => step.station)).toEqual(['fridge', 'fridge', 'fridge', 'cuttingBoard', 'stove']);
    expect(preparationFor(recipe, 'tomato')).toMatchObject({ requiresCut: true, destination: 'pot', preparedImage: '/assets/prepared/tomato_chunks.webp' });
    expect(preparationFor(recipe, 'egg')).toEqual({ requiresCut: false, destination: 'pot' });
    expect(preparationFor(recipe, 'noodles')).toEqual({ requiresCut: false, destination: 'pot' });
  });

  it('uses sliced tomato and shredded cheese for pizza, never a stove', () => {
    const recipe = recipeById('pizza');
    expect(preparationFor(recipe, 'bread')).toEqual({ requiresCut: false, destination: 'oven' });
    expect(preparationFor(recipe, 'tomato').preparedImage).toBe('/assets/prepared/tomato_slices.webp');
    expect(preparationFor(recipe, 'cheese').preparedImage).toBe('/assets/prepared/cheese_shreds.webp');
    expect(recipe.steps.some((step) => step.station === 'stove')).toBe(false);
    expect(recipe.steps.some((step) => step.station === 'oven')).toBe(true);
  });

  it('cuts apple and banana into a bowl while grapes go straight in', () => {
    const recipe = recipeById('fruit_salad');
    expect(preparationFor(recipe, 'apple')).toMatchObject({ requiresCut: true, destination: 'bowl' });
    expect(preparationFor(recipe, 'banana')).toMatchObject({ requiresCut: true, destination: 'bowl' });
    expect(preparationFor(recipe, 'grapes')).toEqual({ requiresCut: false, destination: 'bowl' });
    expect(recipe.steps.some((step) => step.station === 'oven' || step.station === 'stove')).toBe(false);
  });
});
