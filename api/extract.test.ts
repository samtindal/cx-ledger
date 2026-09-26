import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadFixtureBytes } from '../src/etl/__tests__/fixtures';

const create = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function Anthropic() { return { messages: { create } }; }),
}));

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

describe('countPdfPages', () => {
  it('counts page objects, not the page tree', () => {
    expect(countPdfPages(loadFixtureBytes('ahu-schedule.pdf'))).toBe(1);
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

  it('returns 413 for a body over 5 MB', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024)]);
    const out = await call(mockReq(big, '203.0.113.2'));
    expect(out.statusCode).toBe(413);
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
});
