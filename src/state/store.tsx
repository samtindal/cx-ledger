import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { AppState } from '../types';
import { applyChange, type Change } from './applyChange';
import { clearSaved, loadState, saveState } from './persist';
import { seedState } from '../data/seed';

export type LedgerAction =
  | { type: 'change'; change: Change }
  | { type: 'commit'; fn: (s: AppState) => AppState }
  | { type: 'replace'; state: AppState };

export function ledgerReducer(state: AppState, action: LedgerAction): AppState {
  try {
    switch (action.type) {
      case 'change': return applyChange(state, action.change, { batchId: null });
      case 'commit': return action.fn(state);
      case 'replace': return action.state;
    }
  } catch (err) {
    // A rejected change must never take the app down: keep the prior state.
    console.error('Change rejected:', err);
    return state;
  }
}

const resetHooks: Array<() => Promise<void> | void> = [];
export function registerResetHook(fn: () => Promise<void> | void) {
  if (!resetHooks.includes(fn)) resetHooks.push(fn);
}

interface Ledger {
  state: AppState;
  change(c: Change): void;
  commit(fn: (s: AppState) => AppState): void;
  reset(): Promise<void>;
}
const LedgerContext = createContext<Ledger | null>(null);

export function LedgerProvider({ initial, children }: { initial?: AppState; children: ReactNode }) {
  const [state, dispatch] = useReducer(ledgerReducer, initial, (i) => i ?? loadState());
  useEffect(() => { saveState(state); }, [state]);
  const change = useCallback((c: Change) => dispatch({ type: 'change', change: c }), []);
  const commit = useCallback((fn: (s: AppState) => AppState) => dispatch({ type: 'commit', fn }), []);
  const reset = useCallback(async () => {
    clearSaved();
    for (const hook of resetHooks) await hook();
    dispatch({ type: 'replace', state: seedState() });
  }, []);
  const value = useMemo(() => ({ state, change, commit, reset }), [state, change, commit, reset]);
  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): Ledger {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger outside LedgerProvider');
  return ctx;
}

interface Ui {
  openTag: string | null; setOpenTag(t: string | null): void;
  registerPreset: { batchId: string; tags: string[] } | null; setRegisterPreset(p: { batchId: string; tags: string[] } | null): void;
  highlightBatch: string | null; setHighlightBatch(id: string | null): void;
}
const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [openTag, setOpenTag] = useState<string | null>(null);
  const [registerPreset, setRegisterPreset] = useState<Ui['registerPreset']>(null);
  const [highlightBatch, setHighlightBatch] = useState<string | null>(null);
  const value = useMemo(() => ({ openTag, setOpenTag, registerPreset, setRegisterPreset, highlightBatch, setHighlightBatch }),
    [openTag, registerPreset, highlightBatch]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi outside UiProvider');
  return ctx;
}
