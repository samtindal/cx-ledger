import type { AppState, DocKind, DocumentRef } from '../types';
import { applyChange } from '../state/applyChange';
import { matchFilename, type MatchStatus } from './matchFilename';
import { MAX_UPLOAD_BYTES } from './store';

export interface IntakePlan {
  name: string;
  size: number;
  mime: string;
  kind: DocKind;
  tags: string[];
  status: MatchStatus | 'too-large';
}

export function nextDocId(docs: DocumentRef[]): string {
  const max = docs.reduce((n, d) => Math.max(n, Number(d.id.slice(4)) || 0), 0);
  return `DOC-${String(max + 1).padStart(4, '0')}`;
}

export function planIntake(files: { name: string; size: number; type: string }[], registerTags: string[]): IntakePlan[] {
  return files.map((f) => {
    const { tags, kind, status } = matchFilename(f.name, registerTags);
    return {
      name: f.name,
      size: f.size,
      mime: f.type,
      kind,
      tags,
      status: f.size > MAX_UPLOAD_BYTES ? 'too-large' : status,
    };
  });
}

export interface AttachDocumentInput {
  id: string;
  filename: string;
  kind: DocKind;
  mime: string;
  size: number;
  tag: string | null;
  matchedBy: 'filename' | 'manual';
  candidates?: string[];
  blobKey: string;
  at?: string;
}

export function attachDocument(s: AppState, p: AttachDocumentInput): AppState {
  const value: DocumentRef = {
    id: p.id,
    tag: p.tag,
    filename: p.filename,
    kind: p.kind,
    mime: p.mime,
    size: p.size,
    addedAt: p.at ?? new Date().toISOString(),
    blobKey: p.blobKey,
    matchedBy: p.matchedBy,
    ...(p.candidates ? { candidates: p.candidates } : {}),
  };
  return applyChange(s, { entity: 'document', op: 'create', value }, { batchId: null });
}

/** Attach several new documents, allocating each ID from the state being committed to. */
export function attachNewDocuments(s: AppState, inputs: Omit<AttachDocumentInput, 'id'>[]): AppState {
  return inputs.reduce((acc, p) => attachDocument(acc, { ...p, id: nextDocId(acc.documents) }), s);
}

export function assignDocument(s: AppState, id: string, tag: string | null): AppState {
  return applyChange(
    s,
    { entity: 'document', op: 'update', key: id, patch: { tag, matchedBy: 'manual', candidates: undefined } },
    { batchId: null },
  );
}

export function setDocumentKind(s: AppState, id: string, kind: DocKind): AppState {
  return applyChange(s, { entity: 'document', op: 'update', key: id, patch: { kind } }, { batchId: null });
}

export function removeDocument(s: AppState, id: string): AppState {
  return applyChange(s, { entity: 'document', op: 'delete', key: id }, { batchId: null });
}
