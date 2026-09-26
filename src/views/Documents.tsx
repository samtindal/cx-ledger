import { useMemo, useState } from 'react';
import type { DocKind, DocumentRef } from '../types';
import { DOC_KINDS } from '../types';
import { useLedger } from '../state/store';
import { planIntake, attachDocument, assignDocument, setDocumentKind, removeDocument, nextDocId, type AttachDocumentInput, type IntakePlan } from '../docs/intake';
import { putBlob, deleteBlob, storageUsed } from '../docs/store';
import { openDocument } from '../docs/open';
import { DropZone } from '../components/DropZone';
import { Nameplate } from '../components/Nameplate';

type GroupBy = 'kind' | 'unit';

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(plan: IntakePlan): string {
  if (plan.status === 'too-large') return 'Over 25 MB — not saved';
  if (plan.status === 'linked') return `Linked to ${plan.tags[0]}`;
  if (plan.status === 'ambiguous') return `Ambiguous — ${plan.tags.join(', ')}`;
  return 'Unassigned — no matching tag';
}

function TagSelect({
  doc,
  allTags,
  onAssign,
}: {
  doc: DocumentRef;
  allTags: string[];
  onAssign(tag: string): void;
}) {
  return (
    <select
      aria-label={`Tag for ${doc.filename}`}
      value={doc.tag ?? ''}
      onChange={(e) => { if (e.target.value) onAssign(e.target.value); }}
    >
      <option value="">Choose a tag…</option>
      {doc.candidates && doc.candidates.length > 0 && (
        <optgroup label="Suggested">
          {doc.candidates.map((t) => <option key={t} value={t}>{t}</option>)}
        </optgroup>
      )}
      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

export function Documents() {
  const { state, commit } = useLedger();
  const [preview, setPreview] = useState<{ file: File; plan: IntakePlan }[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('kind');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(state.equipment.map((e) => e.tag))).sort(),
    [state.equipment],
  );

  const unassigned = state.documents.filter((d) => d.tag === null);
  const saveableCount = preview.filter((p) => p.plan.status !== 'too-large').length;

  function handleFiles(files: File[]) {
    const plans = planIntake(files, allTags);
    setPreview(files.map((file, i) => ({ file, plan: plans[i] })));
  }

  async function handleSave() {
    const toSave = preview.filter((p) => p.plan.status !== 'too-large');
    let docs = state.documents;
    const attachments: AttachDocumentInput[] = [];
    for (const { file, plan } of toSave) {
      const id = nextDocId(docs);
      await putBlob(id, file);
      const attach: AttachDocumentInput = {
        id,
        filename: file.name,
        kind: plan.kind,
        mime: plan.mime,
        size: plan.size,
        tag: plan.status === 'linked' ? plan.tags[0] : null,
        matchedBy: 'filename',
        candidates: plan.status === 'ambiguous' ? plan.tags : undefined,
        blobKey: id,
      };
      attachments.push(attach);
      docs = [...docs, { ...attach, addedAt: new Date().toISOString() }];
    }
    commit((s) => attachments.reduce((acc, a) => attachDocument(acc, a), s));
    setPreview([]);
  }

  function assign(id: string, tag: string) {
    commit((s) => assignDocument(s, id, tag));
  }

  function setKind(id: string, kind: DocKind) {
    commit((s) => setDocumentKind(s, id, kind));
  }

  async function remove(doc: DocumentRef) {
    if (pendingRemove !== doc.id) {
      setPendingRemove(doc.id);
      return;
    }
    await deleteBlob(doc.blobKey);
    commit((s) => removeDocument(s, doc.id));
    setPendingRemove(null);
  }

  const groups = useMemo(() => {
    const key = (d: DocumentRef) => (groupBy === 'kind' ? d.kind : d.tag ?? 'Unassigned');
    const map = new Map<string, DocumentRef[]>();
    for (const d of state.documents) {
      const k = key(d);
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state.documents, groupBy]);

  return (
    <div>
      <h2>Documents</h2>

      <p>{formatBytes(storageUsed(state.documents))} used</p>

      <DropZone label="Add documents" onFiles={handleFiles} multiple />

      {preview.length > 0 && (
        <div className="import-panel">
          <div className="table-wrap">
            <table aria-label="Intake preview">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Tag(s)</th>
                  <th>Kind</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map(({ file, plan }) => (
                  <tr key={file.name}>
                    <td>{file.name}</td>
                    <td>{plan.tags.length > 0 ? plan.tags.join(', ') : '—'}</td>
                    <td>{plan.kind}</td>
                    <td>{statusLabel(plan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <button type="button" className="primary" disabled={saveableCount === 0} onClick={() => void handleSave()}>
              Save {saveableCount} files
            </button>
          </div>
        </div>
      )}

      {unassigned.length > 0 && (
        <section aria-label="Unassigned queue">
          <h3>Unassigned queue</h3>
          <ul>
            {unassigned.map((doc) => (
              <li key={doc.id}>
                {doc.filename} ({doc.kind})
                {' '}
                <TagSelect doc={doc} allTags={allTags} onAssign={(tag) => assign(doc.id, tag)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="segment">
        <button type="button" aria-pressed={groupBy === 'kind'} onClick={() => setGroupBy('kind')}>By kind</button>
        <button type="button" aria-pressed={groupBy === 'unit'} onClick={() => setGroupBy('unit')}>By unit</button>
      </div>

      {groups.map(([label, docs]) => (
        <section key={label} aria-label={label}>
          <h3>{groupBy === 'unit' && label !== 'Unassigned' ? <Nameplate tag={label} /> : label}</h3>
          <ul>
            {docs.map((doc) => (
              <li key={doc.id}>
                <button type="button" onClick={() => void openDocument(doc)}>Open</button>
                {' '}
                {doc.filename}
                {' '}
                {doc.tag && <Nameplate tag={doc.tag} />}
                {' '}
                <label>
                  Kind
                  <select
                    aria-label={`Kind for ${doc.filename}`}
                    value={doc.kind}
                    onChange={(e) => setKind(doc.id, e.target.value as DocKind)}
                  >
                    {DOC_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                {' '}
                <label>
                  Re-assign
                  <TagSelect doc={doc} allTags={allTags} onAssign={(tag) => assign(doc.id, tag)} />
                </label>
                {' '}
                <button type="button" onClick={() => void remove(doc)}>
                  {pendingRemove === doc.id ? 'Confirm remove' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
