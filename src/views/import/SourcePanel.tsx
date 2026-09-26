import { useState, type DragEvent } from 'react';
import type { SheetGrid } from '../../types';
import { parseCsv } from '../../etl/parseCsv';
import { readWorkbook } from '../../etl/readWorkbook';

export interface ImportSource { source: string; origin: 'csv' | 'xlsx'; sheets: SheetGrid[] }

const MAX_BYTES = 25 * 1024 * 1024;
const PDF_MESSAGE = 'PDFs go to Documents (attach) — or use Extract from PDF.';

const hasRows = (sheets: SheetGrid[]) => sheets.some((s) => s.rows.length > 0);

export function SourcePanel({ onSource }: { onSource(src: ImportSource): void }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function submit(src: ImportSource) {
    if (!hasRows(src.sheets)) { setMessage(`No rows found in ${src.source}.`); return; }
    setMessage(null);
    onSource(src);
  }

  async function readFile(file: File) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) { setMessage(PDF_MESSAGE); return; }
    if (file.size > MAX_BYTES) { setMessage(`${file.name} is larger than 25 MB. Split it or export fewer rows.`); return; }
    try {
      if (name.endsWith('.csv')) {
        submit({ source: file.name, origin: 'csv', sheets: [{ sheetName: 'CSV', rows: parseCsv(await file.text()) }] });
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        submit({ source: file.name, origin: 'xlsx', sheets: readWorkbook(await file.arrayBuffer()) });
      } else {
        setMessage(`${file.name} isn't a CSV or Excel file.`);
      }
    } catch {
      setMessage(`Couldn't read ${file.name}.`);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  }

  return (
    <section className="import-panel" aria-labelledby="import-source-h">
      <h3 id="import-source-h">Source</h3>
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p>Drop a CSV or Excel file here, or</p>
        <input
          type="file"
          aria-label="Choose file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void readFile(file);
          }}
        />
      </div>
      <textarea
        aria-label="Paste CSV or tab-separated rows"
        placeholder="…or paste rows copied from a spreadsheet"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="toolbar">
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => submit({ source: 'Pasted text', origin: 'csv', sheets: [{ sheetName: 'CSV', rows: parseCsv(text) }] })}
        >
          Run import
        </button>
      </div>
      {message && <p className="import-message" role="status">{message}</p>}
    </section>
  );
}
