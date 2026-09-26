import type { ReactNode } from 'react';

export type Tone = 'ok' | 'warn' | 'bad' | 'idle' | 'accent';
const GLYPH: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', idle: '○', accent: '•' };

export function Chip({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip--${tone}`} title={title}>
      <span aria-hidden="true" className="chip__glyph">{GLYPH[tone]}</span>
      {children}
    </span>
  );
}
