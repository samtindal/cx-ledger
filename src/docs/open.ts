import type { DocumentRef } from '../types';
import { getDocumentBlob } from './store';

// Give the new tab time to start loading the blob before the URL is revoked.
export const REVOKE_DELAY_MS = 60_000;

export async function openDocument(ref: DocumentRef): Promise<void> {
  const blob = await getDocumentBlob(ref);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
