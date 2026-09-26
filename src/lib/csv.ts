const needsQuote = /[",\r\n]/;
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((v) => (needsQuote.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\r\n');
}
