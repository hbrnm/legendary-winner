"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type InstallNavigator = Navigator & { install?: () => Promise<unknown>; standalone?: boolean };

const InstallContext = createContext({ available: false, busy: false, error: false, install: async () => {} });

/** Listen at the persistent app root: the browser offer can precede settings navigation. */
export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const prompt = useRef<InstallPrompt | null>(null);
  const busyRef = useRef(false);
  const installed = useRef(false);
  useEffect(() => {
    const nav = navigator as InstallNavigator;
    const display = window.matchMedia('(display-mode: standalone)');
    installed.current = display.matches || nav.standalone === true;
    setAvailable(!installed.current && typeof nav.install === 'function');
    const offer = (event: Event) => {
      if (installed.current) return;
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      setAvailable(true);
    };
    const done = () => { installed.current = true; prompt.current = null; setAvailable(false); };
    const displayChanged = () => { if (display.matches) done(); };
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', done);
    display.addEventListener('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', done);
      display.removeEventListener('change', displayChanged);
    };
  }, []);

  async function install() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    const nav = navigator as InstallNavigator;
    try {
      if (typeof nav.install === 'function') {
        await nav.install(); // Called synchronously from the user activation.
        installed.current = true;
        prompt.current = null;
        setAvailable(false);
      } else if (prompt.current) {
        const current = prompt.current;
        prompt.current = null; // Legacy prompts are single-use, even on cancellation.
        setAvailable(false);
        await current.prompt();
        const choice = await current.userChoice;
        if (choice.outcome === 'accepted') installed.current = true;
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return <InstallContext.Provider value={{ available, busy, error, install }}>{children}</InstallContext.Provider>;
}

/** Only offer an action the current browser can actually perform. */
export function InstallApp() {
  const { available, busy, error, install } = useContext(InstallContext);
  return <>
    {available && <Button variant="secondary" icon={<Download size={18} />} aria-disabled={busy} onClick={() => void install()}>Instalează Cămara</Button>}
    {error && <p role="status" className="text-sm text-ink-2">Nu am putut porni instalarea. Încearcă din meniul browserului.</p>}
  </>;
}
