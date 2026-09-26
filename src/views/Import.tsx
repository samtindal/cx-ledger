import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLedger, useUi } from '../state/store';
import { rollbackBatch, type RollbackConflict } from '../etl/rollback';
import { setApproval, approveAll, clearAll, discardStaged } from '../etl/load';
import { addProfile, createProfile, deleteProfile, renameProfile } from '../etl/profiles';
import { startSession, restage, stepSummary, mappingDetails, applySuggestedProfile, loadSession, rollbackSession } from './import/session';
import { SourcePanel, type ImportSource } from './import/SourcePanel';
import { StepStrip } from './import/StepStrip';
import { MappingPanel } from './import/MappingPanel';
import { ReviewTable } from './import/ReviewTable';
import { HistoryPanel } from './import/HistoryPanel';
import { ProfilesPanel } from './import/ProfilesPanel';

export function Import() {
  const { state, commit } = useLedger();
  const { setRegisterPreset, highlightBatch } = useUi();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ batchId: string; list: RollbackConflict[] } | null>(null);
  const [profileName, setProfileName] = useState('');
  const [savedProfile, setSavedProfile] = useState<string | null>(null);
  const reviewRef = useRef<HTMLElement>(null);

  const staged = state.batches.find((b) => b.status === 'staged');
  const loaded = loadedId ? state.batches.find((b) => b.id === loadedId && b.status === 'loaded') : undefined;
  const current = staged ?? loaded;
  const details = useMemo(() => (staged ? mappingDetails(state, staged) : null), [state, staged]);

  // A staged batch survives reload; resume at Review.
  useEffect(() => {
    if (reviewRef.current) reviewRef.current.scrollIntoView?.({ block: 'start' });
  }, []);

  const steps = current ? stepSummary(current) : null;
  const appliedProfile = current?.profileId ? state.profiles.find((p) => p.id === current.profileId) : undefined;
  if (steps && appliedProfile) steps[1] = { ...steps[1], value: `${steps[1].value} · profile "${appliedProfile.name}"` };

  function begin(src: ImportSource) {
    setLoadedId(null);
    setConflicts(null);
    setSavedProfile(null);
    commit((s) => startSession(s, src));
  }

  function load(id: string) {
    setLoadedId(id);
    setConflicts(null);
    setSavedProfile(null);
    commit((s) => loadSession(s, id));
  }

  function rollBack(id: string) {
    const r = rollbackBatch(state, id);
    if (!r.ok) { setConflicts({ batchId: id, list: r.conflicts }); return; }
    setConflicts(null);
    commit((s) => rollbackSession(s, id));
  }

  function viewInRegister(batchId: string, tags: string[]) {
    setRegisterPreset({ batchId, tags });
    window.location.hash = 'equipment';
  }

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!loaded) return;
    const b = loaded;
    const name = profileName.trim() || 'Untitled profile';
    commit((s) => addProfile(s, createProfile({
      name, headers: b.headers, mapping: b.mapping, headerRow: b.headerRow, sheetName: b.sheetName, existing: s.profiles,
    })));
    setSavedProfile(name);
    setProfileName('');
  }

  const report = loaded?.loadReport;
  const approvedCount = staged ? staged.rows.filter((r) => r.approved).length : 0;

  return (
    <div className="import-view">
      <h2>Import</h2>
      {steps && <StepStrip steps={steps} />}

      <SourcePanel onSource={begin} />

      {staged && details && (
        <MappingPanel
          key={staged.id}
          batch={staged}
          details={details}
          onRestage={(change) => commit((s) => restage(s, staged.id, change))}
          onApplyProfile={(profileId) => commit((s) => applySuggestedProfile(s, staged.id, profileId))}
        />
      )}

      {staged && (
        <section className="import-panel" aria-labelledby="import-review-h" ref={reviewRef}>
          <h3 id="import-review-h">Review {staged.id} · {staged.source}{staged.sheetName ? ` · ${staged.sheetName}` : ''}</h3>
          <ReviewTable
            key={staged.id}
            batch={staged}
            onApprove={(rowNum, approved) => commit((s) => setApproval(s, staged.id, rowNum, approved))}
          />
          <div className="toolbar import-actions">
            <button type="button" onClick={() => commit((s) => approveAll(s, staged.id))}>Approve all</button>
            <button type="button" onClick={() => commit((s) => clearAll(s, staged.id))}>Clear all</button>
            <button type="button" onClick={() => commit((s) => discardStaged(s, staged.id))}>Discard import</button>
            <button type="button" className="primary" disabled={approvedCount === 0} onClick={() => load(staged.id)}>
              Load approved rows
            </button>
          </div>
        </section>
      )}

      {!staged && loaded && report && (
        <section className="import-panel" aria-labelledby="import-result-h">
          <h3 id="import-result-h">Loaded {loaded.id}</h3>
          <p role="status">
            Loaded: {report.created.length} created · {report.updated.length} updated · {report.unchanged.length} unchanged · {report.skipped} skipped
          </p>
          <div className="toolbar">
            <button type="button" onClick={() => viewInRegister(loaded.id, [...report.created, ...report.updated])}>View in register</button>
          </div>
          <form className="toolbar" onSubmit={saveProfile}>
            <input
              type="text"
              aria-label="Profile name"
              placeholder="Profile name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <button type="submit">Save mapping as profile</button>
          </form>
          {savedProfile && <p className="muted">Saved profile “{savedProfile}”.</p>}
        </section>
      )}

      <HistoryPanel
        batches={state.batches}
        profiles={state.profiles}
        highlightBatch={highlightBatch}
        conflicts={conflicts}
        onRollback={rollBack}
      />

      <ProfilesPanel
        profiles={state.profiles}
        onRename={(id, name) => commit((s) => renameProfile(s, id, name))}
        onDelete={(id) => commit((s) => deleteProfile(s, id))}
      />
    </div>
  );
}
