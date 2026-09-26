import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes only when needed', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny']])).toBe('a,"b,c","say ""hi""","x\ny"');
    expect(toCsv([['1'], ['2']])).toBe('1\r\n2');
  });
});
