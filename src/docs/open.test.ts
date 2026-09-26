// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DocumentRef } from '../types';

vi.mock('./store', () => ({ getDocumentBlob: vi.fn() }));

import { getDocumentBlob } from './store';
import { openDocument, REVOKE_DELAY_MS } from './open';

const doc: DocumentRef = {
  id: 'DOC-0001',
  tag: 'AHU-1',
  filename: 'test.pdf',
  kind: 'Other',
  mime: 'application/pdf',
  size: 3,
  addedAt: '2026-09-01T00:00:00.000Z',
  blobKey: 'DOC-0001',
  matchedBy: 'manual',
};

describe('openDocument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the blob in a new tab and revokes the URL after the delay, not before', async () => {
    vi.mocked(getDocumentBlob).mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    const createObjectURL = vi.fn(() => 'blob:test-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await openDocument(doc);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('blob:test-url', '_blank', 'noopener');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('does nothing when the blob is missing', async () => {
    vi.mocked(getDocumentBlob).mockResolvedValue(undefined);
    const createObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await openDocument(doc);

    expect(openSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
