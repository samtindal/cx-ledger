import { useEffect, useRef, useState, type FormEvent } from 'react';
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

export function EquipmentDrawer() {
  const { openTag, setOpenTag, setHighlightBatch } = useUi();
  const { state, change } = useLedger();
  const dialogRef = useRef<HTMLElement>(null);
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<Severity>(SEVERITIES[0]);
  const [trade, setTrade] = useState<Trade>(TRADES[0]);

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

      <section aria-label="Documents" />

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
