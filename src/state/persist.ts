import type { AppState } from '../types';
import { seedState } from '../data/seed';

export const STORAGE_KEY = 'cx-ledger:v1';
const ARRAYS = ['equipment', 'issues', 'documents', 'profiles', 'batches', 'changes'] as const;

function isAppState(x: unknown): x is AppState {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return o.version === 1 && ARRAYS.every((k) => Array.isArray(o[k]));
}

export function loadState(now: Date = new Date()): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isAppState(parsed)) return parsed;
    }
  } catch {
    // corrupt storage: fall through to seed
  }
  return seedState(now);
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Cx Ledger: could not save state', err);
  }
}

export function clearSaved(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
