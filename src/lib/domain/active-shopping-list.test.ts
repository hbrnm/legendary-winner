import { expect, it } from 'vitest';
import { selectActiveList } from './active-shopping-list';
const a = {id:'a',pending:2,updated_at:'2026-11-17',archived_at:null,deleted_at:null};
const b = {...a,id:'b',pending:3};
it('keeps a valid preferred list then chooses most remaining, newest and stable id', () => {
  expect(selectActiveList([b,a],'a')).toBe('a');
  expect(selectActiveList([a,b],'missing')).toBe('b');
  expect(selectActiveList([a,{...a,id:'c',updated_at:'2026-11-18'}],null)).toBe('c');
  expect(selectActiveList([{...a,id:'z'},a],null)).toBe('a');
});
it('ignores deleted and archived choices, including the preferred one', () => {
  expect(selectActiveList([a,{...b,archived_at:'2026-11-17'}],'b')).toBe('a');
  expect(selectActiveList([{...a,deleted_at:'2026-11-17'}],null)).toBeNull();
});
