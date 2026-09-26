import { useState } from 'react';
import type { ImportBatch, RowResult } from '../../types';
import { Chip, type Tone } from '../../components/Chip';
import { Nameplate } from '../../components/Nameplate';

export const RESULT_LABEL: Record<RowResult, string> = {
  new: 'New', update: 'Updated', noChange: 'No change', duplicate: 'Duplicate', error: 'Error', blank: 'Blank',
};
export const RESULT_TONE: Record<RowResult, Tone> = {
  new: 'ok', update: 'accent', noChange: 'idle', duplicate: 'warn', error: 'bad', blank: 'idle',
};
const RESULTS: RowResult[] = ['new', 'update', 'noChange', 'duplicate', 'error', 'blank'];
const NOT_APPROVABLE = new Set<RowResult>(['error', 'blank', 'noChange']);

export function ReviewTable({ batch, readOnly = false, onApprove }: {
  batch: ImportBatch;
  readOnly?: boolean;
  onApprove?(rowNum: number, approved: boolean): void;
}) {
  const [filter, setFilter] = useState<RowResult | null>(null);
  const rows = filter ? batch.rows.filter((r) => r.result === filter) : batch.rows;

  return (
    <>
      {!readOnly && (
        <div className="toolbar" role="group" aria-label="Filter rows">
          {RESULTS.map((r) => (
            <button
              key={r}
              type="button"
              className="filter-chip"
              aria-pressed={filter === r}
              onClick={() => setFilter(filter === r ? null : r)}
            >
              {RESULT_LABEL[r]} ({batch.counts[r]})
            </button>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table aria-label={readOnly ? `Rows in ${batch.id}` : 'Review'} className="review-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Source tag</th>
              <th>Tag</th>
              <th>Description</th>
              <th>Type</th>
              <th>Result</th>
              <th>Changes / notes</th>
              <th>{readOnly ? 'Approved' : 'Approve'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowNum}>
                <td className="num">{r.rowNum}</td>
                <td className="mono">
                  {r.sourceTag}
                  {r.ai && (
                    <div className="review-ai">
                      <Chip tone="accent">AI</Chip> p. {r.ai.sourcePage} · {r.ai.confidence} confidence
                    </div>
                  )}
                </td>
                <td>{r.tag && <Nameplate tag={r.tag} />}</td>
                <td>{r.values.desc ?? ''}</td>
                <td>{r.type}</td>
                <td><Chip tone={RESULT_TONE[r.result]}>{RESULT_LABEL[r.result]}</Chip></td>
                <td className="review-notes">
                  {r.diff.map((d) => <div key={d.field}>{d.field}: {d.before} → {d.after}</div>)}
                  {r.notes.map((n, i) => <div key={i}>{n}</div>)}
                  {r.warnings.map((w, i) => <div key={i}><Chip tone="warn">{w}</Chip></div>)}
                </td>
                <td>
                  {readOnly ? (r.approved ? 'Yes' : 'No') : (
                    <input
                      type="checkbox"
                      aria-label={'Approve row ' + r.rowNum}
                      checked={r.approved}
                      disabled={NOT_APPROVABLE.has(r.result)}
                      onChange={(e) => onApprove?.(r.rowNum, e.target.checked)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
