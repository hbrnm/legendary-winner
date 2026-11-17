// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { InstallApp, InstallAppProvider } from './install-app';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete (navigator as Navigator & { install?: unknown }).install; });
function setup(standalone = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
it('does not show a nonfunctional action when unsupported or already standalone', () => {
  setup();
  const view = render(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  expect(view.queryByRole('button')).toBeNull();
});
it('offers the deferred prompt, allows cancellation then hides after installation', async () => {
  setup();
  const view = render(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  const prompt = vi.fn(async () => {});
  const offer = () => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  };
  offer();
  fireEvent.click(view.getByRole('button'));
  await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  await waitFor(() => expect(view.queryByRole('button')).toBeNull());
  offer();
  expect(view.getByRole('button')).toBeTruthy();
  act(() => { window.dispatchEvent(new Event('appinstalled')); });
  expect(view.queryByRole('button')).toBeNull();
});
it('calls the native installation API directly and keeps cancellation retryable', async () => {
  setup();
  const install = vi.fn().mockRejectedValueOnce(new DOMException('cancel', 'AbortError')).mockResolvedValueOnce(undefined);
  Object.defineProperty(navigator, 'install', { value: install, configurable: true });
  const view = render(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  fireEvent.click(view.getByRole('button'));
  expect(install).toHaveBeenCalledOnce();
  await waitFor(() => expect(view.getByRole('button').getAttribute('aria-disabled')).toBe('false'));
  fireEvent.click(view.getByRole('button'));
  await waitFor(() => expect(view.queryByRole('button')).toBeNull());
  delete (navigator as Navigator & { install?: unknown }).install;
});
it('hides installation in standalone mode even when the native API exists', () => {
  setup(true);
  Object.defineProperty(navigator, 'install', { value: vi.fn(), configurable: true });
  const view = render(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  expect(view.queryByRole('button')).toBeNull();
});
it('shows unexpected native errors and prevents duplicate requests while pending', async () => {
  setup();
  let reject!: (cause: Error) => void;
  const install = vi.fn(() => new Promise((_, no) => { reject = no; }));
  Object.defineProperty(navigator, 'install', { value: install, configurable: true });
  const view = render(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  fireEvent.click(view.getByRole('button'));
  fireEvent.click(view.getByRole('button'));
  expect(install).toHaveBeenCalledOnce();
  await act(async () => { reject(new Error('unavailable')); });
  expect(view.getByRole('status').textContent).toContain('Nu am putut');
  expect(view.getByRole('button').getAttribute('aria-disabled')).toBe('false');
});

it('retains browser offers received before settings mounts and across settings navigation', () => {
  setup();
  const view = render(<InstallAppProvider><p>Acasă</p></InstallAppProvider>);
  const prompt = vi.fn(async () => {});
  act(() => { window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) })); });
  view.rerender(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  expect(view.getByRole('button').textContent).toContain('Instalează');
  view.rerender(<InstallAppProvider><p>Acasă</p></InstallAppProvider>);
  view.rerender(<InstallAppProvider><InstallApp /></InstallAppProvider>);
  expect(view.getByRole('button').textContent).toContain('Instalează');
});
