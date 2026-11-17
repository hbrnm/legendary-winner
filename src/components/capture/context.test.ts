import { expect, it } from 'vitest';
import { actionContext } from './model';
it('maps only supported routes to contextual actions', () => {
  expect(['/', '/retete', '/camara/', '/cumparaturi/', '/buget/'].map(actionContext)).toEqual(['home','recipes','pantry','shopping','budget']);
  expect(actionContext('/cumparaturi/lista/?id=x')).toBe('shopping');
  for (const route of ['/retete/editare/', '/retete/import/', '/retete/reteta/', '/autentificare/', '/plan/', '/buget/diverse/']) expect(actionContext(route)).toBeNull();
});
