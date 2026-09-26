// Dependency-free on purpose: api/extract.ts imports this at runtime on Vercel, where each file is
// compiled to native ESM and extensionless relative imports don't resolve.

export interface ExtractedRow { tag: string; desc: string; location?: string; mfr?: string; model?: string; serial?: string; sourcePage: number; confidence: 'high' | 'medium' | 'low' }
export interface ExtractionResponse { rows: ExtractedRow[] }

const CONF = new Set(['high', 'medium', 'low']);

export function isExtractionResponse(x: unknown): x is ExtractionResponse {
  if (typeof x !== 'object' || x === null || !Array.isArray((x as { rows?: unknown }).rows)) return false;
  return (x as ExtractionResponse).rows.every((r) =>
    typeof r === 'object' && r !== null && typeof r.tag === 'string' && typeof r.desc === 'string' &&
    Number.isInteger(r.sourcePage) && CONF.has(r.confidence) &&
    (['location', 'mfr', 'model', 'serial'] as const).every((k) => r[k] === undefined || typeof r[k] === 'string'));
}
