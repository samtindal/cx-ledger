import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('honesty rules', () => {
  it('never names HDR in the app or README', () => {
    const files = [...walk('src'), 'README.md'].filter((f) => !f.endsWith('honesty.test.ts'));
    const hits = files.filter((f) => /\bHDR\b/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('uses the exact banner and About wording', () => {
    expect(readFileSync('src/components/Banner.tsx', 'utf8')).toContain('Demo with sample data. Changes stay in your browser.');
    expect(readFileSync('src/components/About.tsx', 'utf8')).toContain("Inspired by commissioning data work I supported at an engineering firm's commissioning group in 2016.");
  });
});
