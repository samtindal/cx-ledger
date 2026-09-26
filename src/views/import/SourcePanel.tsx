import { useState, type DragEvent } from 'react';
import type { SheetGrid } from '../../types';
import { parseCsv } from '../../etl/parseCsv';
import { isExtractionResponse, startAiSession, type ExtractionResponse } from '../../etl/aiExtract';
import { useLedger } from '../../state/store';
import cachedSample from '../../../fixtures/ahu-schedule.extract.json';

export interface ImportSource { source: string; origin: 'csv' | 'xlsx'; sheets: SheetGrid[] }

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const PDF_MESSAGE = 'PDFs go to Documents (attach) — or use Extract from PDF.';
const EXTRACT_OFF = 'Live extraction is off in this demo — try the sample.';
// Bundled at build time: the sample never calls /api/extract.
const SAMPLE = cachedSample as ExtractionResponse;

const hasRows = (sheets: SheetGrid[]) => sheets.some((s) => s.rows.length > 0);

export function SourcePanel({ onSource }: { onSource(src: ImportSource): void }) {
  const { commit } = useLedger();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
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
        const { readWorkbook } = await import('../../etl/readWorkbook');
        submit({ source: file.name, origin: 'xlsx', sheets: readWorkbook(await file.arrayBuffer()) });
      } else {
        setMessage(`${file.name} isn't a CSV or Excel file.`);
      }
    } catch {
      setMessage(`Couldn't read ${file.name}.`);
    }
  }

  function stageAi(resp: ExtractionResponse, source: string) {
    setMessage(null);
    setExtractError(null);
    commit((s) => startAiSession(s, resp, source));
  }

  async function extractPdf(file: File) {
    setMessage(null);
    setExtractError(null);
    if (file.size > MAX_PDF_BYTES) { setExtractError(`${file.name} is larger than 5 MB.`); return; }
    setExtracting(true);
    try {
      const res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file });
      const body: unknown = await res.json().catch(() => null);
      if (res.status === 503) { setExtractError(EXTRACT_OFF); return; }
      if (!res.ok) {
        const error = (body as { error?: unknown } | null)?.error;
        setExtractError(typeof error === 'string' ? error : `Extraction failed (${res.status}).`);
        return;
      }
      if (!isExtractionResponse(body)) { setExtractError(`Couldn't read equipment rows from ${file.name}.`); return; }
      stageAi(body, file.name);
    } catch {
      setExtractError('Extraction failed. Check your connection and try again.');
    } finally {
      setExtracting(false);
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
      <div className="toolbar" role="group" aria-label="Extract from PDF">
        <label>
          Extract from PDF{' '}
          <input
            type="file"
            aria-label="Extract from PDF"
            accept=".pdf,application/pdf"
            disabled={extracting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void extractPdf(file);
            }}
          />
        </label>
        <button type="button" disabled={extracting} onClick={() => stageAi(SAMPLE, 'ahu-schedule.pdf (cached sample)')}>
          Try the sample
        </button>
        <a href="/samples/ahu-schedule.pdf" target="_blank" rel="noreferrer">View sample PDF</a>
        {extracting && <span role="status">Extracting…</span>}
      </div>
      {message && <p className="import-message" role="status">{message}</p>}
      {extractError && <div className="import-alert" role="alert"><p>{extractError}</p></div>}
    </section>
  );
}
