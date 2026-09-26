// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { putBlob, getBlob, clearBlobs, deleteBlob } from './store';

describe('blob store', () => {
  it('round-trips, deletes, and clears', async () => {
    await putBlob('a', new Blob(['hello'], { type: 'text/plain' }));
    expect(await (await getBlob('a'))!.text()).toBe('hello');
    await deleteBlob('a');
    expect(await getBlob('a')).toBeUndefined();
    await putBlob('b', new Blob(['x']));
    await clearBlobs();
    expect(await getBlob('b')).toBeUndefined();
  });
});
