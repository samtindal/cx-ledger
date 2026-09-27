import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inflateSync } from 'node:zlib';
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
const MODEL_REJECTED = 'The configured ANTHROPIC_MODEL rejected forced tool use; choose a model that supports tool_choice (see README).';

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

// A `/Type /Page` object, not a `/Type /Pages` tree node (a PDF name ends at a delimiter).
const PAGE_OBJECT = /\/Type\s*\/Page(?=[\s()<>[\]{}/%]|$)/g;
// An indirect object's dictionary up to its `stream` keyword (never crossing `endobj`).
const STREAM_OBJECT = /\d+\s+\d+\s+obj\b((?:(?!endobj)[\s\S])*?)(?<!end)stream\r?\n/g;

/**
 * Counts page objects, both in plain file text and inside Flate-compressed object streams
 * (`/Type /ObjStm`), where PDF 1.5+ writers usually put them. Returns 0 if none are found.
 */
export function countPdfPages(bytes: Uint8Array): number {
  const buf = Buffer.from(bytes);
  const text = buf.toString('latin1');
  let count = (text.match(PAGE_OBJECT) ?? []).length;
  STREAM_OBJECT.lastIndex = 0;
  for (let m; (m = STREAM_OBJECT.exec(text)); ) {
    const dict = m[1];
    const start = m.index + m[0].length;
    const direct = /\/Length\s+(\d+)(?![\d\s]*R)/.exec(dict);
    const byLength = direct ? start + Number(direct[1]) : -1;
    const end = byLength > start && byLength <= buf.length ? byLength : text.indexOf('endstream', start);
    if (end < 0) break;
    STREAM_OBJECT.lastIndex = end; // don't scan the stream's binary data for objects
    if (!/\/Type\s*\/ObjStm\b/.test(dict) || !/\/FlateDecode\b/.test(dict)) continue;
    try {
      count += (inflateSync(buf.subarray(start, end)).toString('latin1').match(PAGE_OBJECT) ?? []).length;
    } catch {
      // Unreadable stream: contributes nothing; a total of 0 fails closed in the handler.
    }
  }
  return count;
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
  const pages = countPdfPages(body);
  if (pages === 0) return res.status(400).json({ error: "Couldn't verify the PDF's page count" });
  if (pages > MAX_PAGES) return res.status(413).json({ error: 'PDF has more than 10 pages.' });

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
    // A 400 here is almost always the model refusing forced tool_choice (see README / .env.example).
    if (err instanceof Anthropic.BadRequestError) {
      console.error('extract: model rejected the request', { status: err.status });
      return res.status(502).json({ error: MODEL_REJECTED });
    }
    // Log only the status/type, never the request (it carries the PDF) or the key.
    const status = err instanceof Error && 'status' in err ? (err as { status?: unknown }).status : undefined;
    console.error('extract: API call failed', { status, name: err instanceof Error ? err.name : typeof err });
    return res.status(502).json({ error: 'Extraction failed. Try again later.' });
  }
}
