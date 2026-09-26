import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { AppState } from '../types';
import { LedgerProvider, UiProvider, useLedger } from '../state/store';
import { seedState } from '../data/seed';

export function renderWithStore(ui: ReactElement, opts: { state?: AppState } = {}): RenderResult & { getState(): AppState } {
  let latest: AppState = opts.state ?? seedState();
  function Probe() { latest = useLedger().state; return null; }
  const result = render(
    <LedgerProvider initial={opts.state ?? seedState()}>
      <UiProvider>{ui}<Probe /></UiProvider>
    </LedgerProvider>,
  );
  return Object.assign(result, { getState: () => latest });
}
