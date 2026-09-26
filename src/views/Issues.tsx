import { useMemo, useState, type FormEvent } from 'react';
import { SEVERITIES, TRADES, type Severity, type Trade } from '../types';
import { useLedger, useUi } from '../state/store';
import { filterIssues, emptyMessage, daysLabel, severityTone, nextIssueId, type IssueFilter, type IssueSegment } from '../domain/issues';
import { today } from '../lib/dates';
import { Chip } from '../components/Chip';
import { Nameplate } from '../components/Nameplate';

const SEGMENTS: IssueSegment[] = ['Open', 'Closed', 'All'];

export function Issues() {
  const { state, change } = useLedger();
  const { setOpenTag } = useUi();

  const [segment, setSegment] = useState<IssueSegment>('Open');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [trade, setTrade] = useState<Trade | 'all'>('all');
  const [q, setQ] = useState('');

  const [tag, setTag] = useState(state.equipment[0]?.tag ?? '');
  const [desc, setDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<Severity>(SEVERITIES[0]);
  const [newTrade, setNewTrade] = useState<Trade>(TRADES[0]);

  const filter: IssueFilter = { segment, severity, trade, q };
  const rows = useMemo(() => filterIssues(state.issues, filter), [state.issues, segment, severity, trade, q]);
  const todayISO = today();

  function addIssue(e: FormEvent) {
    e.preventDefault();
    if (!tag || !desc.trim()) return;
    change({
      entity: 'issue',
      op: 'create',
      value: { id: nextIssueId(state.issues), tag, desc, severity: newSeverity, trade: newTrade, opened: todayISO, closed: null },
    });
    setDesc('');
    setNewSeverity(SEVERITIES[0]);
    setNewTrade(TRADES[0]);
  }

  function closeIssue(id: string) {
    change({ entity: 'issue', op: 'update', key: id, patch: { closed: todayISO } });
  }

  return (
    <div>
      <h2>Issues</h2>

      <form aria-label="New issue" onSubmit={addIssue} className="toolbar">
        <label htmlFor="new-issue-tag">Tag</label>
        <select id="new-issue-tag" aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}>
          {state.equipment.map((eq) => <option key={eq.tag} value={eq.tag}>{eq.tag}</option>)}
        </select>
        <label htmlFor="new-issue-desc">Issue</label>
        <input
          id="new-issue-desc"
          type="text"
          aria-label="Issue"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <label htmlFor="new-issue-severity">Severity</label>
        <select id="new-issue-severity" aria-label="Severity" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as Severity)}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label htmlFor="new-issue-trade">Trade</label>
        <select id="new-issue-trade" aria-label="Trade" value={newTrade} onChange={(e) => setNewTrade(e.target.value as Trade)}>
          {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="submit">Add issue</button>
      </form>

      <div className="toolbar">
        <div role="group" aria-label="Segment" className="segment">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={segment === s}
              onClick={() => setSegment(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <select aria-label="Filter severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'all')}>
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Filter trade" value={trade} onChange={(e) => setTrade(e.target.value as Trade | 'all')}>
          <option value="all">All trades</option>
          {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="search"
          aria-label="Search issues"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <p>{emptyMessage(filter)}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tag</th>
                <th>Issue</th>
                <th>Severity</th>
                <th>Trade</th>
                <th>Opened</th>
                <th>Days open</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.id}</td>
                  <td>
                    <button type="button" onClick={() => setOpenTag(i.tag)}>
                      <Nameplate tag={i.tag} />
                    </button>
                  </td>
                  <td>{i.desc}</td>
                  <td><Chip tone={severityTone(i.severity)}>{i.severity}</Chip></td>
                  <td>{i.trade}</td>
                  <td className="mono">{i.opened}</td>
                  <td className="num">{daysLabel(i, todayISO)}</td>
                  <td>
                    {i.closed === null && (
                      <button type="button" aria-label={`Close ${i.id}`} onClick={() => closeIssue(i.id)}>Close</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
