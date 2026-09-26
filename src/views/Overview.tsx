import { useLedger, useUi } from '../state/store';
import { computeStats, readinessBySystem, agingBySeverity, needsAttention } from '../domain/overview';
import { severityTone } from '../domain/issues';
import { today } from '../lib/dates';
import { SEVERITIES, type Severity } from '../types';
import { Chip } from '../components/Chip';
import { Nameplate } from '../components/Nameplate';

const AGING_COLOR: Record<Severity, string> = { Critical: 'var(--bad)', Major: 'var(--warn)', Minor: 'var(--idle)' };

function formatMedian(days: number | null): string {
  if (days === null) return '—';
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

export function Overview() {
  const { state } = useLedger();
  const { setOpenTag } = useUi();
  const todayISO = today();

  const stats = computeStats(state, todayISO);
  const bySystem = readinessBySystem(state);
  const aging = agingBySeverity(state, todayISO);
  const attention = needsAttention(state, todayISO);
  const unassignedDocs = state.documents.filter((d) => d.tag === null).length;

  const bucketTotal = (counts: Record<Severity, number>) => SEVERITIES.reduce((n, s) => n + counts[s], 0);
  const maxAgingTotal = Math.max(1, ...aging.map((a) => bucketTotal(a.counts)));

  return (
    <div>
      <h2>Overview</h2>

      <section aria-label="Summary" className="stat-strip">
        <div className="stat-tile">
          <div className="stat-num">{stats.equipmentCount}</div>
          <div className="stat-label">Equipment</div>
        </div>
        <div className="stat-tile">
          <div className="stat-num">{stats.pfcComplete}/{stats.equipmentCount}</div>
          <div className="stat-label">PFCs complete</div>
        </div>
        <div className="stat-tile">
          <div className="stat-num">{stats.fptPassed}/{stats.equipmentCount}</div>
          <div className="stat-label">FPTs passed</div>
        </div>
        <div className="stat-tile">
          <div className="stat-num">{stats.openIssues}</div>
          <div className="stat-label">Open issues</div>
          <div className="stat-sub">{stats.openCritical} critical</div>
        </div>
        <div className="stat-tile">
          <div className="stat-num">{formatMedian(stats.medianDaysOpen)}</div>
          <div className="stat-label">Median days open</div>
        </div>
      </section>

      <section aria-label="Readiness by system">
        <h3>Readiness by system</h3>
        <div className="table-wrap">
          <table aria-label="Readiness by system">
            <thead>
              <tr>
                <th>System</th>
                <th>Units</th>
                <th>PFC</th>
                <th>FPT</th>
                <th>Open issues</th>
                <th>Docs</th>
              </tr>
            </thead>
            <tbody>
              {bySystem.map((r) => (
                <tr key={r.system}>
                  <th scope="row">{r.system}</th>
                  <td className="num">{r.units}</td>
                  <td className="num">
                    <div className="bar"><div style={{ width: `${r.pfcPct}%` }} /></div>
                    {r.pfcPct}%
                  </td>
                  <td className="num">{r.fptPassed}/{r.units}</td>
                  <td className="num">{r.openIssues}</td>
                  <td className="num">{r.docs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Issue aging">
        <h3>Issue aging</h3>
        <div className="aging-chart">
          {aging.map(({ bucket, counts }) => {
            const total = bucketTotal(counts);
            return (
              <div className="aging-row" key={bucket}>
                <span className="aging-row__label">{bucket} days</span>
                <div className="aging-row__track">
                  <div className="aging-row__bar" style={{ width: `${(total / maxAgingTotal) * 100}%` }}>
                    {SEVERITIES.filter((sev) => counts[sev] > 0).map((sev) => (
                      <div
                        key={sev}
                        className="aging-seg"
                        style={{ width: `${(counts[sev] / total) * 100}%`, background: AGING_COLOR[sev] }}
                        title={`${sev}: ${counts[sev]}`}
                      >
                        {counts[sev]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ul className="aging-legend">
          {SEVERITIES.map((sev) => (
            <li key={sev}>
              <Chip tone={severityTone(sev)}>{sev}</Chip>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Needs attention">
        <h3>Needs attention</h3>
        <ul aria-label="Needs attention">
          {attention.map(({ issue, days }) => (
            <li key={issue.id}>
              <button type="button" onClick={() => setOpenTag(issue.tag)}>
                <span className="mono">{issue.id}</span> <Nameplate tag={issue.tag} /> {issue.desc}{' '}
                <Chip tone={severityTone(issue.severity)}>{issue.severity}</Chip> {days} days
              </button>
            </li>
          ))}
        </ul>
        {unassignedDocs > 0 && (
          <p>
            <a href="#documents">{unassignedDocs} documents waiting for a tag</a>
          </p>
        )}
      </section>
    </div>
  );
}
