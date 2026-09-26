import { useEffect, useState } from 'react';
import { FIELDS, type ColumnMapping, type ImportBatch } from '../../types';
import { Chip } from '../../components/Chip';
import type { mappingDetails } from './session';

type Details = ReturnType<typeof mappingDetails>;
type Restage = { sheetIndex?: number; headerRow?: number; mapping?: ColumnMapping };

export function MappingPanel({ batch, details, onRestage, onApplyProfile }: {
  batch: ImportBatch;
  details: Details;
  onRestage(change: Restage): void;
  onApplyProfile(profileId: string): void;
}) {
  const sheets = batch.input?.sheets ?? [];
  const sheetIndex = batch.input?.sheetIndex ?? 0;
  const maxRow = sheets[sheetIndex]?.rows.length ?? 1;
  const [headerDraft, setHeaderDraft] = useState(String(batch.headerRow + 1));
  const [showMapping, setShowMapping] = useState(details.profile?.mode !== 'applied');
  useEffect(() => { setHeaderDraft(String(batch.headerRow + 1)); }, [batch.headerRow]);

  const headers = batch.headers.filter(Boolean);
  const profile = details.profile;

  function changeHeader(value: string) {
    setHeaderDraft(value);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= maxRow && n - 1 !== batch.headerRow) onRestage({ headerRow: n - 1 });
  }

  return (
    <section className="import-panel" aria-labelledby="import-mapping-h">
      <h3 id="import-mapping-h">Map columns</h3>
      <div className="toolbar">
        {sheets.length > 1 && (
          <label>
            Sheet{' '}
            <select aria-label="Sheet" value={sheetIndex} onChange={(e) => onRestage({ sheetIndex: Number(e.target.value) })}>
              {sheets.map((s, i) => <option key={s.sheetName} value={i}>{s.sheetName}</option>)}
            </select>
          </label>
        )}
        <label>
          Header row{' '}
          <input
            type="number"
            aria-label="Header row"
            min={1}
            max={maxRow}
            value={headerDraft}
            onChange={(e) => changeHeader(e.target.value)}
          />
        </label>
      </div>
      {!details.headerConfident && <p className="import-message">Couldn&apos;t find a header row — pick one.</p>}

      {profile?.mode === 'applied' && (
        <p className="profile-banner">
          Using profile: <strong>{profile.profile.name}</strong>
          {!showMapping && <>{' · '}<button type="button" className="link-button" onClick={() => setShowMapping(true)}>Change</button></>}
        </p>
      )}
      {profile?.mode === 'suggested' && (
        <p className="profile-banner">
          Suggested profile: <strong>{profile.profile.name}</strong>
          {' · '}
          <button type="button" className="link-button" onClick={() => onApplyProfile(profile.profile.id)}>Apply</button>
        </p>
      )}

      {(showMapping || profile?.mode !== 'applied') && (
        <div className="mapping-grid">
          {FIELDS.map((f) => {
            const c = details.confidence[f];
            return (
              <div key={f} className="mapping-row">
                <label htmlFor={`map-${f}`} className="mapping-row__field">{f}</label>
                <select
                  id={`map-${f}`}
                  aria-label={'Map ' + f}
                  value={batch.mapping[f] ?? ''}
                  onChange={(e) => onRestage({ mapping: { ...batch.mapping, [f]: e.target.value || null } })}
                >
                  {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                  <option value="">Not in file</option>
                </select>
                {c !== null && (c < 0.8
                  ? <Chip tone="warn">{Math.round(c * 100)}% check</Chip>
                  : <Chip tone="ok">{Math.round(c * 100)}%</Chip>)}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
