import { useCallback, useEffect, useState } from 'react';

export const TABS = ['overview', 'equipment', 'issues', 'documents', 'import'] as const;
export type Tab = (typeof TABS)[number];
export const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  equipment: 'Equipment',
  issues: 'Issues',
  documents: 'Documents',
  import: 'Import',
};

export function parseHash(hash: string): Tab {
  const head = hash.replace(/^#/, '').split('/')[0].toLowerCase();
  return (TABS as readonly string[]).includes(head) ? (head as Tab) : 'overview';
}

export function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setTab(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((t: Tab) => {
    window.location.hash = t;
    setTab(t);
  }, []);
  return [tab, go];
}
