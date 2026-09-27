import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { deflateSync } from 'node:zlib';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadFixtureBytes } from '../src/etl/__tests__/fixtures';

const create = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  const Anthropic = vi.fn(function Anthropic() { return { messages: { create } }; });
  return { ...actual, default: Object.assign(Anthropic, { BadRequestError: actual.BadRequestError }) };
});

import { BadRequestError } from '@anthropic-ai/sdk';
import handler, { countPdfPages } from './extract';

const pdf = Buffer.from(loadFixtureBytes('ahu-schedule.pdf'));

function mockReq(body: Buffer, ip: string, method = 'POST'): VercelRequest {
  const req = Readable.from([body]) as unknown as VercelRequest;
  req.method = method;
  req.headers = { 'x-forwarded-for': `${ip}, 10.0.0.1`, 'content-type': 'application/pdf' };
  return req;
}

function mockRes() {
  const out = { statusCode: 0, body: undefined as unknown };
  const res = {
    status(code: number) { out.statusCode = code; return res; },
    json(body: unknown) { out.body = body; return res; },
  };
  return { res: res as unknown as VercelResponse, out };
}

async function call(req: VercelRequest) {
  const { res, out } = mockRes();
  await handler(req, res);
  return out;
}

/** A PDF 1.5-style file whose page objects live only in a Flate-compressed object stream. */
function objStmPdf(pages: number): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ');
  const objs = [
    `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`,
    ...Array.from({ length: pages }, () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'),
  ];
  let offset = 0;
  const header: string[] = [];
  const bodies: string[] = [];
  objs.forEach((o, i) => { header.push(`${i + 2} ${offset}`); bodies.push(o); offset += o.length + 1; });
  const head = header.join(' ') + '\n';
  const packed = deflateSync(Buffer.from(head + bodies.join('\n'), 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.5\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'latin1'),
    Buffer.from(`${pages + 3} 0 obj\n<< /Type /ObjStm /N ${objs.length} /First ${head.length} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`, 'latin1'),
    packed,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
}

describe('countPdfPages', () => {
  it('counts page objects, not the page tree', () => {
    expect(countPdfPages(loadFixtureBytes('ahu-schedule.pdf'))).toBe(1);
  });
  it('counts page objects inside Flate-compressed object streams', () => {
    const bytes = objStmPdf(3);
    expect(bytes.toString('latin1')).not.toMatch(/\/Type \/Page\b/);
    expect(countPdfPages(bytes)).toBe(3);
    expect(countPdfPages(objStmPdf(12))).toBe(12);
  });
  it('returns 0 when no page objects can be found', () => {
    expect(countPdfPages(Buffer.from('%PDF-1.7\nnot really a pdf\n%%EOF\n'))).toBe(0);
  });
});

describe('POST /api/extract', () => {
  beforeEach(() => {
    create.mockReset();
    vi.stubEnv('EXTRACT_ENABLED', 'true');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_MODEL', 'test-model');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns 503 when extraction is turned off', async () => {
    vi.stubEnv('EXTRACT_ENABLED', '');
    const out = await call(mockReq(pdf, '203.0.113.1'));
    expect(out).toEqual({ statusCode: 503, body: { error: 'Extraction is turned off' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 413 for a body over 4 MB (below Vercel\'s 4.5 MB request limit)', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(4 * 1024 * 1024)]);
    const out = await call(mockReq(big, '203.0.113.2'));
    expect(out).toEqual({ statusCode: 413, body: { error: 'PDF is larger than 4 MB.' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 413 for a PDF whose 11 pages sit in a compressed object stream', async () => {
    const out = await call(mockReq(objStmPdf(11), '203.0.113.7'));
    expect(out).toEqual({ statusCode: 413, body: { error: 'PDF has more than 10 pages.' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 400 when the page count cannot be verified', async () => {
    const out = await call(mockReq(Buffer.from('%PDF-1.7\nnot really a pdf\n%%EOF\n'), '203.0.113.8'));
    expect(out).toEqual({ statusCode: 400, body: { error: "Couldn't verify the PDF's page count" } });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 429 on the 6th request from one IP within an hour', async () => {
    const notPdf = Buffer.from('hello');
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await call(mockReq(notPdf, '203.0.113.3'))).statusCode);
    expect(codes).toEqual([400, 400, 400, 400, 400, 429]);
    expect((await call(mockReq(notPdf, '203.0.113.4'))).statusCode).toBe(400);
  });

  it('returns 200 with the tool input when the model calls the tool', async () => {
    const rows = [{ tag: 'AHU-4', desc: 'Air handling unit - lab wing supply', sourcePage: 1, confidence: 'high' }];
    create.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'record_equipment_rows', input: { rows } }],
    });
    const out = await call(mockReq(pdf, '203.0.113.5'));
    expect(out).toEqual({ statusCode: 200, body: { rows } });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe('test-model');
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'record_equipment_rows' });
    const [doc, text] = params.messages[0].content;
    expect(doc).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } });
    expect(text.type).toBe('text');
  });

  it('returns 502 naming the model setting when the API rejects forced tool use', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValue(new BadRequestError(400,
      { type: 'error', error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' } },
      'tool_choice: type "tool" and "any" are not supported for this model.', new Headers()));
    const out = await call(mockReq(pdf, '203.0.113.6'));
    expect(out).toEqual({
      statusCode: 502,
      body: { error: 'The configured ANTHROPIC_MODEL rejected forced tool use; choose a model that supports tool_choice (see README).' },
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('test-key');
    errorSpy.mockRestore();
  });
});
