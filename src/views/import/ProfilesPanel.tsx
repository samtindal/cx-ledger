import { useState } from 'react';
import type { MappingProfile } from '../../types';

export function ProfilesPanel({ profiles, onRename, onDelete }: {
  profiles: MappingProfile[];
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
}) {
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <section className="import-panel" aria-labelledby="import-profiles-h">
      <h3 id="import-profiles-h">Saved profiles</h3>
      {profiles.length === 0 ? (
        <p>No saved profiles yet. Save a mapping after loading an import.</p>
      ) : (
        <ul className="profile-list">
          {profiles.map((p) => (
            <li key={p.id}>
              {editing?.id === p.id ? (
                <form
                  className="toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.name.trim()) onRename(p.id, editing.name.trim());
                    setEditing(null);
                  }}
                >
                  <input
                    type="text"
                    aria-label={`New name for ${p.name}`}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                  />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <div className="toolbar">
                  <strong>{p.name}</strong>
                  {p.sheetName && <span className="muted">sheet {p.sheetName}</span>}
                  <span className="muted">header row {p.headerRow + 1}</span>
                  <button type="button" aria-label={`Rename ${p.name}`} onClick={() => { setConfirming(null); setEditing({ id: p.id, name: p.name }); }}>Rename</button>
                  {confirming === p.id ? (
                    <>
                      <span>Delete {p.name}?</span>
                      <button type="button" onClick={() => { onDelete(p.id); setConfirming(null); }}>Confirm delete</button>
                      <button type="button" onClick={() => setConfirming(null)}>Keep</button>
                    </>
                  ) : (
                    <button type="button" aria-label={`Delete ${p.name}`} onClick={() => setConfirming(p.id)}>Delete</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
