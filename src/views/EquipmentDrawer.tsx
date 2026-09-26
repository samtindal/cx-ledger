import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DocumentRef } from '../types';
import { FPT_STATUSES, SEVERITIES, TRADES, type FptStatus, type Severity, type Trade } from '../types';
import { useLedger, useUi } from '../state/store';
import { checklistFor } from '../data/checklists';
import { readiness } from '../domain/derived';
import { readinessTone, fptTone } from '../domain/register';
import { historyFor, describeChange } from '../domain/history';
import { nextIssueId } from '../domain/issues';
import { today } from '../lib/dates';
import { Chip } from '../components/Chip';
import { Nameplate } from '../components/Nameplate';
import { DropZone } from '../components/DropZone';
import { attachDocument, assignDocument, removeDocument, nextDocId, type AttachDocumentInput } from '../docs/intake';
import { detectKind } from '../docs/matchFilename';
import { putBlob, deleteBlob } from '../docs/store';
import { openDocument } from '../docs/open';

export function EquipmentDrawer() {
  const { openTag, setOpenTag, setHighlightBatch } = useUi();
  const { state, change, commit } = useLedger();
  const dialogRef = useRef<HTMLElement>(null);
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<Severity>(SEVERITIES[0]);
  const [trade, setTrade] = useState<Trade>(TRADES[0]);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const eq = openTag ? state.equipment.find((e) => e.tag === openTag) : undefined;

  useEffect(() => {
    if (eq) dialogRef.current?.focus();
  }, [eq?.tag]);

  useEffect(() => {
    if (!eq) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenTag(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eq, setOpenTag]);

  useEffect(() => {
    setDesc('');
    setSeverity(SEVERITIES[0]);
    setTrade(TRADES[0]);
  }, [openTag]);

  if (!eq) return null;

  const checklist = checklistFor(eq.type, eq.system);
  const issues = state.issues.filter((i) => i.tag === eq.tag);
  const r = readiness(eq, state.issues);
  const docs = state.documents.filter((d) => d.tag === eq.tag);
  const allTags = Array.from(new Set(state.equipment.map((e) => e.tag))).sort();

  const historyItems = [
    ...historyFor(state, 'equipment', eq.tag),
    ...issues.flatMap((i) => historyFor(state, 'issue', i.id)),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  function toggleItem(idx: number) {
    const nextPfc = eq!.pfc.map((v, i) => (i === idx ? !v : v));
    change({ entity: 'equipment', op: 'update', key: eq!.tag, patch: { pfc: nextPfc } });
  }

  function logIssue(e: FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    change({
      entity: 'issue',
      op: 'create',
      value: { id: nextIssueId(state.issues), tag: eq!.tag, desc, severity, trade, opened: today(), closed: null },
    });
    setDesc('');
    setSeverity(SEVERITIES[0]);
    setTrade(TRADES[0]);
  }

  function closeIssue(id: string) {
    change({ entity: 'issue', op: 'update', key: id, patch: { closed: today() } });
  }

  async function attachFiles(files: File[]) {
    let docList = state.documents;
    const attachments: AttachDocumentInput[] = [];
    for (const file of files) {
      const id = nextDocId(docList);
      await putBlob(id, file);
      const attach: AttachDocumentInput = {
        id,
        filename: file.name,
        kind: detectKind(file.name),
        mime: file.type,
        size: file.size,
        tag: eq!.tag,
        matchedBy: 'manual',
        blobKey: id,
      };
      attachments.push(attach);
      docList = [...docList, { ...attach, addedAt: new Date().toISOString() }];
    }
    if (attachments.length) commit((s) => attachments.reduce((acc, a) => attachDocument(acc, a), s));
  }

  function reassignDoc(id: string, tag: string) {
    commit((s) => assignDocument(s, id, tag));
  }

  async function removeDoc(doc: DocumentRef) {
    if (pendingRemove !== doc.id) {
      setPendingRemove(doc.id);
      return;
    }
    await deleteBlob(doc.blobKey);
    commit((s) => removeDocument(s, doc.id));
    setPendingRemove(null);
  }

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="drawer"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="drawer__header">
        <h2 id="drawer-title">
          <Nameplate tag={eq.tag} /> {eq.desc}
        </h2>
        <Chip tone={readinessTone(r)}>{r}</Chip>
        <button type="button" onClick={() => setOpenTag(null)}>Close</button>
      </div>

      <dl className="drawer__nameplate">
        <dt>Manufacturer</dt><dd>{eq.mfr}</dd>
        <dt>Model</dt><dd>{eq.model}</dd>
        <dt>Serial</dt><dd>{eq.serial}</dd>
      </dl>

      <section aria-label="Checklist">
        <h3>PFC checklist</h3>
        {checklist.map((item, idx) => (
          <label key={item} className="drawer__checklist-item">
            <input type="checkbox" checked={eq.pfc[idx]} onChange={() => toggleItem(idx)} />
            {item}
          </label>
        ))}
      </section>

      <section aria-label="FPT">
        <h3>FPT</h3>
        <Chip tone={fptTone(eq.fpt)}>{eq.fpt}</Chip>
        <label htmlFor="fpt-status">FPT status</label>
        <select
          id="fpt-status"
          aria-label="FPT status"
          value={eq.fpt}
          onChange={(e) => change({ entity: 'equipment', op: 'update', key: eq.tag, patch: { fpt: e.target.value as FptStatus } })}
        >
          {FPT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label htmlFor="fpt-date">FPT date</label>
        <input
          id="fpt-date"
          type="date"
          aria-label="FPT date"
          value={eq.fptDate ?? ''}
          onChange={(e) => change({ entity: 'equipment', op: 'update', key: eq.tag, patch: { fptDate: e.target.value } })}
        />
      </section>

      <section aria-label="Issues">
        <h3>Issues</h3>
        <ul>
          {issues.map((i) => (
            <li key={i.id}>
              <strong>{i.id}</strong>: {i.desc} ({i.severity}, {i.trade})
              {i.closed === null
                ? <button type="button" aria-label={`Close ${i.id}`} onClick={() => closeIssue(i.id)}>Close</button>
                : <span> Closed {i.closed}</span>}
            </li>
          ))}
        </ul>
        <form onSubmit={logIssue}>
          <label htmlFor="issue-desc">Issue description</label>
          <input
            id="issue-desc"
            type="text"
            aria-label="Issue description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <label htmlFor="issue-severity">Severity</label>
          <select id="issue-severity" aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label htmlFor="issue-trade">Trade</label>
          <select id="issue-trade" aria-label="Trade" value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="submit">Log issue</button>
        </form>
      </section>

      <section aria-label="Documents">
        <h3>Documents</h3>
        <ul>
          {docs.map((doc) => (
            <li key={doc.id}>
              <button type="button" onClick={() => void openDocument(doc)}>Open</button>
              {' '}
              {doc.filename}
              {' '}
              <label>
                Re-assign
                <select
                  aria-label={`Tag for ${doc.filename}`}
                  value={doc.tag ?? ''}
                  onChange={(e) => { if (e.target.value) reassignDoc(doc.id, e.target.value); }}
                >
                  <option value="">Choose a tag…</option>
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {' '}
              <button type="button" onClick={() => void removeDoc(doc)}>
                {pendingRemove === doc.id ? 'Confirm remove' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
        <DropZone label={`Add documents for ${eq.tag}`} onFiles={(files) => void attachFiles(files)} multiple />
      </section>

      <section aria-label="History">
        <h3>History</h3>
        <ul>
          {historyItems.map((rec) => {
            const batchId = rec.batchId;
            return (
              <li key={rec.id}>
                <span>{describeChange(rec)}</span>
                {' — '}
                <span className="mono">{new Date(rec.at).toLocaleString()}</span>
                {batchId && (
                  <>
                    {' · '}
                    <a href="#import" onClick={() => setHighlightBatch(batchId)}>{batchId}</a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
