// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { RecipeVisual } from './recipe-visual';
import { RecipeImage, RecipePhotoPanel } from './recipe-photo';
vi.mock('@/components/app/app-provider', () => ({ useApp: () => ({ photos: { enabled: false } }) }));
vi.mock('@/components/app/hooks', () => ({ useData: () => null, useAction: () => ({ run: vi.fn(), busy: false }) }));
afterEach(cleanup);
const recipe = { id: 'ciorba-de-perisoare', image_url: '/retete/ciorba-de-perisoare.webp' };
it('leaves list images lazy and normal priority', () => {
  const { container } = render(<RecipeImage recipe={recipe} />);
  expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  expect(container.querySelector('img')?.hasAttribute('fetchpriority')).toBe(false);
});
it('loads the detail photograph eagerly with high priority', () => {
  const { container } = render(<RecipePhotoPanel recipe={recipe} />);
  expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager');
  expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
});
it('does not elevate all large images implicitly', () => {
  const { container } = render(<RecipeVisual recipe={recipe} size="lg" />);
  expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
});
