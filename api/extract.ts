import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
// `.js` + a dependency-free module: Vercel compiles this function to native ESM, file by file.
import { isExtractionResponse } from '../src/etl/extractionSchema.js';

// Vercel docs' raw-body pattern. readBody() below listens for 'data'/'end', which also works when
// the runtime's helpers have already buffered and replayed the body.
export const config = { api: { bodyParser: false } };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 10;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const TOOL_NAME = 'record_equipment_rows';

const PROMPT = 'Extract every equipment row from this schedule or submittal. Copy values exactly as printed. ' +
  'Leave a field empty rather than guess. Skip rows that are not equipment. ' +
  'Report the 1-based page each row came from and your confidence.';

const TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: 'Record the equipment rows found in the document.',
  input_schema: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Equipment tag exactly as printed' },
            desc: { type: 'string', description: 'Equipment description' },
            location: { type: 'string' },
            mfr: { type: 'string', description: 'Manufacturer' },
            model: { type: 'string' },
            serial: { type: 'string', description: 'Serial number' },
            sourcePage: { type: 'integer', description: '1-based page the row came from' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['tag', 'desc', 'sourcePage', 'confidence'],
        },
      },
    },
    required: ['rows'],
  },
};

// Per warm instance only: each serverless instance has its own map, so this is a soft limit.
const hits = new Map<string, number[]>();

function allow(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const ok = recent.length < RATE_LIMIT;
  if (ok) recent.push(now);
  hits.set(ip, recent);
  return ok;
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/** Reads the raw body; returns null once it passes `limit` bytes (the rest is drained, not kept). */
function readBody(req: VercelRequest, limit: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size <= limit) chunks.push(buf);
    });
    req.on('end', () => resolve(size > limit ? null : Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Counts `/Type /Page` objects (not `/Type /Pages` tree nodes). */
export function countPdfPages(bytes: Uint8Array): number {
  return (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST with a PDF body.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (process.env.EXTRACT_ENABLED !== 'true' || !apiKey || !model) {
    return res.status(503).json({ error: 'Extraction is turned off' });
  }

  if (!allow(clientIp(req), Date.now())) {
    return res.status(429).json({ error: 'Too many extractions from this address. Try again in an hour.' });
  }

  const declared = Number(req.headers['content-length']);
  if (declared > MAX_BYTES) return res.status(413).json({ error: 'PDF is larger than 5 MB.' });
  const body = await readBody(req, MAX_BYTES);
  if (!body) return res.status(413).json({ error: 'PDF is larger than 5 MB.' });
  if (body.subarray(0, 4).toString('latin1') !== '%PDF') return res.status(400).json({ error: "That file isn't a PDF." });
  if (countPdfPages(body) > MAX_PAGES) return res.status(413).json({ error: 'PDF has more than 10 pages.' });

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model,
      max_tokens: 16000,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.toString('base64') } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    const call = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === TOOL_NAME);
    if (!call || !isExtractionResponse(call.input)) {
      console.error('extract: no valid tool call', { stop_reason: message.stop_reason });
      return res.status(502).json({ error: "Couldn't read equipment rows from that PDF." });
    }
    return res.status(200).json({ rows: call.input.rows });
  } catch (err) {
    // Log only the status/type, never the request (it carries the PDF) or the key.
    const status = err instanceof Error && 'status' in err ? (err as { status?: unknown }).status : undefined;
    console.error('extract: API call failed', { status, name: err instanceof Error ? err.name : typeof err });
    return res.status(502).json({ error: 'Extraction failed. Try again later.' });
  }
}
