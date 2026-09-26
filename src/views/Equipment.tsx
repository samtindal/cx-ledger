import { useEffect, useMemo, useRef, useState } from 'react';
import { SYSTEMS, type System } from '../types';
import { useLedger, useUi } from '../state/store';
import {
  registerRows, registerCsv, fptTone, pfcTone, readinessTone,
  type RegisterFilter, type StateFilter,
} from '../domain/register';
import { Chip } from '../components/Chip';
import { Nameplate } from '../components/Nameplate';

const STATE_OPTIONS: [StateFilter, string][] = [
  ['all', 'All'],
  ['pfcIncomplete', 'PFC incomplete'],
  ['fptFailed', 'FPT failed'],
  ['hasOpenIssues', 'Has open issues'],
  ['missingTab', 'Missing TAB report'],
  ['ready', 'Ready'],
];

export function Equipment() {
  const { state } = useLedger();
  const { setOpenTag, registerPreset, setRegisterPreset } = useUi();
  const [q, setQ] = useState('');
  const [system, setSystem] = useState<System | 'all'>('all');
  const [type, setType] = useState<string | 'all'>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [csvFallback, setCsvFallback] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const types = useMemo(() => Array.from(new Set(state.equipment.map((e) => e.type))).sort(), [state.equipment]);

  const filter: RegisterFilter = { q, system, type, state: stateFilter, tags: registerPreset?.tags };
  const rows = registerRows(state, filter);

  useEffect(() => {
    if (csvFallback !== null) textareaRef.current?.select();
  }, [csvFallback]);

  async function copyCsv() {
    const csv = registerCsv(rows);
    try {
      await navigator.clipboard.writeText(csv);
      setCsvFallback(null);
    } catch {
      setCsvFallback(csv);
    }
  }

  return (
    <div>
      <h2>Equipment</h2>
      {registerPreset && (
        <div className="preset-bar">
          Showing {rows.length} rows from {registerPreset.batchId}
          {' · '}
          <button type="button" onClick={() => setRegisterPreset(null)}>Clear</button>
        </div>
      )}
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search equipment"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select aria-label="System" value={system} onChange={(e) => setSystem(e.target.value as System | 'all')}>
          <option value="all">All</option>
          {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value as StateFilter)}>
          {STATE_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button type="button" onClick={() => void copyCsv()}>Copy as CSV</button>
      </div>
      {csvFallback !== null && (
        <textarea aria-label="CSV export" readOnly ref={textareaRef} value={csvFallback} />
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Description</th>
              <th>Type</th>
              <th>Location</th>
              <th>PFC</th>
              <th>FPT</th>
              <th>Open issues</th>
              <th>Docs</th>
              <th>Readiness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.eq.tag}
                tabIndex={0}
                onClick={() => setOpenTag(r.eq.tag)}
                onKeyDown={(e) => { if (e.key === 'Enter') setOpenTag(r.eq.tag); }}
              >
                <td>
                  <Nameplate tag={r.eq.tag} />
                  {registerPreset && <Chip tone="accent">Imported</Chip>}
                </td>
                <td>{r.eq.desc}</td>
                <td>{r.eq.type}</td>
                <td>{r.eq.location}</td>
                <td className="num">
                  {r.pfcDone}/{r.pfcTotal} <Chip tone={pfcTone(r.pfc)}>{r.pfc}</Chip>
                </td>
                <td><Chip tone={fptTone(r.eq.fpt)}>{r.eq.fpt}</Chip></td>
                <td className="num">{r.openIssues}</td>
                <td className="num">{r.docs}</td>
                <td><Chip tone={readinessTone(r.readiness)}>{r.readiness}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
