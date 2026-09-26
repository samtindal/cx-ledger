import type { AppState, Equipment } from '../types';
import { runPipeline, buildBatch, countRows, type PipelineResult } from './stage';
import { emptyMapping } from './fuzzy';
import { nextBatchId, stageBatch } from './load';
import type { ExtractionResponse } from './extractionSchema';

export { isExtractionResponse, type ExtractedRow, type ExtractionResponse } from './extractionSchema';

const HEADERS = ['Tag', 'Description', 'Location', 'Mfr', 'Model', 'Serial'];

export const extractionToGrid = (resp: ExtractionResponse): string[][] =>
  [HEADERS, ...resp.rows.map((r) => [r.tag, r.desc, r.location ?? '', r.mfr ?? '', r.model ?? '', r.serial ?? ''])];

export function stageExtraction(resp: ExtractionResponse, register: Equipment[]): PipelineResult {
  const mapping = { ...emptyMapping(), tag: 'Tag', desc: 'Description', location: 'Location', mfr: 'Mfr', model: 'Model', serial: 'Serial' };
  const r = runPipeline({ grid: extractionToGrid(resp), register, headerRowOverride: 0, mappingOverride: mapping });
  const rows = r.rows.map((row, i) => {
    const src = resp.rows[i];
    const ai = { sourcePage: src.sourcePage, confidence: src.confidence };
    return { ...row, ai, approved: src.confidence === 'low' ? false : row.approved };
  });
  return { ...r, rows, counts: countRows(rows) };
}

export function startAiSession(s: AppState, resp: ExtractionResponse, source: string, now = new Date().toISOString()): AppState {
  const r = stageExtraction(resp, s.equipment);
  return stageBatch(s, buildBatch(r, { id: nextBatchId(s.batches), source, origin: 'ai-extract', createdAt: now }));
}
