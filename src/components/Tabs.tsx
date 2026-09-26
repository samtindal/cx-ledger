import { TABS, TAB_LABELS, type Tab } from '../lib/route';

export function Tabs({ active }: { active: Tab }) {
  return (
    <nav aria-label="Sections">
      {TABS.map((t) => (
        <a key={t} href={'#' + t} aria-current={t === active ? 'page' : undefined}>
          {TAB_LABELS[t]}
        </a>
      ))}
    </nav>
  );
}
