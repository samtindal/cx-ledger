import { Fragment, useState } from 'react';
import type { ImportBatch, MappingProfile } from '../../types';
import type { RollbackConflict } from '../../etl/rollback';
import { toLocalISO } from '../../lib/dates';
import { Chip, type Tone } from '../../components/Chip';
import { ReviewTable } from './ReviewTable';

const STATUS_TONE: Record<ImportBatch['status'], Tone> = { staged: 'accent', loaded: 'ok', 'rolled back': 'idle' };

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${toLocalISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function countsText(b: ImportBatch): string {
  const c = b.counts;
  return `${c.new} new · ${c.update} upd · ${c.noChange} same · ${c.error} err`;
}

export function HistoryPanel({ batches, profiles, highlightBatch, conflicts, onRollback }: {
  batches: ImportBatch[];
  profiles: MappingProfile[];
  highlightBatch: string | null;
  conflicts: { batchId: string; list: RollbackConflict[] } | null;
  onRollback(id: string): void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const newestFirst = [...batches].reverse();
  const profileName = (id?: string) => (id ? profiles.find((p) => p.id === id)?.name ?? id : '—');

  return (
    <section className="import-panel" aria-labelledby="import-history-h">
      <h3 id="import-history-h">Import history</h3>
      {conflicts && conflicts.list.length > 0 && (
        <div role="alert" className="import-alert">
          <p><strong>Can&apos;t roll back {conflicts.batchId}.</strong></p>
          {conflicts.list.map((c) => <p key={c.key}>{c.message}</p>)}
        </div>
      )}
      {batches.length === 0 ? (
        <p>No imports yet.</p>
      ) : (
        <div className="table-wrap">
          <table aria-label="Import history" className="history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>Origin</th>
                <th>Profile</th>
                <th>Time</th>
                <th>Counts</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((b) => (
                <Fragment key={b.id}>
                  <tr className={b.id === highlightBatch ? 'row--highlight' : undefined} aria-current={b.id === highlightBatch ? 'true' : undefined}>
                    <td className="mono">{b.id}</td>
                    <td>{b.source}</td>
                    <td>{b.origin}</td>
                    <td>{profileName(b.profileId)}</td>
                    <td className="mono">{formatTime(b.loadedAt ?? b.createdAt)}</td>
                    <td className="mono">{countsText(b)}</td>
                    <td><Chip tone={STATUS_TONE[b.status]}>{b.status}</Chip></td>
                    <td className="history-actions">
                      {b.status === 'loaded' && (
                        <button type="button" aria-label={`Roll back ${b.id}`} onClick={() => onRollback(b.id)}>Roll back</button>
                      )}
                      <button
                        type="button"
                        aria-expanded={expanded === b.id}
                        aria-label={`View rows ${b.id}`}
                        onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                      >
                        View rows
                      </button>
                    </td>
                  </tr>
                  {expanded === b.id && (
                    <tr className="history-rows">
                      <td colSpan={8}><ReviewTable batch={b} readOnly /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
