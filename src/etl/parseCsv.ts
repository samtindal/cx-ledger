export function detectDelimiter(text: string): ',' | '\t' {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const tabs = (first.match(/\t/g) ?? []).length;
  const commas = (first.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

export function parseCsv(text: string, delimiter?: ',' | '\t'): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue; }
    if (ch === delim) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
