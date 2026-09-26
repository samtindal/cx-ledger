import { createStore, get, set, del, clear } from 'idb-keyval';
import type { DocumentRef } from '../types';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const store = () => createStore('cx-ledger', 'blobs');

// Stored as { type, bytes } rather than a raw Blob: fake-indexeddb's structured
// clone (used under jsdom in tests) does not reliably round-trip Blob instances,
// and jsdom's own Blob doesn't implement arrayBuffer()/text().
interface StoredBlob { type: string; bytes: ArrayBuffer }

function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

export const putBlob = async (key: string, blob: Blob) => {
  const bytes = await readAsArrayBuffer(blob);
  await set(key, { type: blob.type, bytes }, store());
};

export const getBlob = async (key: string): Promise<Blob | undefined> => {
  const stored = await get<StoredBlob>(key, store());
  if (!stored) return undefined;
  const blob = new Blob([stored.bytes], { type: stored.type });
  // jsdom's Blob (used under the jsdom test environment) lacks text()/arrayBuffer();
  // patch them in from the bytes we already have. Real browsers already implement both.
  if (typeof blob.text !== 'function') {
    Object.assign(blob, {
      arrayBuffer: () => Promise.resolve(stored.bytes),
      text: () => Promise.resolve(new TextDecoder().decode(stored.bytes)),
    });
  }
  return blob;
};

export const deleteBlob = (key: string) => del(key, store());
export const clearBlobs = () => clear(store());

export async function getDocumentBlob(ref: DocumentRef): Promise<Blob | undefined> {
  const stored = await getBlob(ref.blobKey);
  if (stored) return stored;
  if (ref.blobKey.startsWith('seed:')) {
    const res = await fetch(`${import.meta.env.BASE_URL}samples/${ref.blobKey.slice(5)}`);
    return res.ok ? res.blob() : undefined;
  }
  return undefined;
}

export const storageUsed = (docs: DocumentRef[]) => docs.reduce((n, d) => n + d.size, 0);
