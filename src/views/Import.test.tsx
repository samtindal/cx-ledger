// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Import } from './Import';
import { Equipment } from './Equipment';
import { renderWithStore } from '../test/render';
import { loadFixtureText } from '../etl/__tests__/fixtures';
import { useLedger } from '../state/store';
import { startSession } from './import/session';
import { seedState } from '../data/seed';
import { parseCsv } from '../etl/parseCsv';

describe('Import view', () => {
  it('paste → review → load → roll back', async () => {
    const { getState } = renderWithStore(<Import />);
    const ta = screen.getByRole('textbox', { name: /paste/i });
    await userEvent.click(ta);
    await userEvent.paste(loadFixtureText('contractor-export.csv'));
    await userEvent.click(screen.getByRole('button', { name: 'Run import' }));
    const review = await screen.findByRole('table', { name: 'Review' });
    expect(within(review).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'New (7)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load approved rows' }));
    expect(await screen.findByText('7 new, 2 updated')).toBeInTheDocument();
    expect(getState().equipment.some((e) => e.tag === 'AHU-3')).toBe(true);
    const history = screen.getByRole('table', { name: 'Import history' });
    await userEvent.click(within(history).getByRole('button', { name: 'Roll back IMP-0001' }));
    expect(getState().batches[0].status).toBe('rolled back');
    expect(getState().equipment).toHaveLength(27);
  });
  it('shows the rollback conflict message', async () => {
    const { getState } = renderWithStore(<><Import /><EditAhu3 /></>);
    await userEvent.click(screen.getByRole('textbox', { name: /paste/i }));
    await userEvent.paste(loadFixtureText('contractor-export.csv'));
    await userEvent.click(screen.getByRole('button', { name: 'Run import' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Load approved rows' }));
    await userEvent.click(await screen.findByRole('button', { name: 'edit AHU-3' })); // later manual edit
    const history = screen.getByRole('table', { name: 'Import history' });
    await userEvent.click(within(history).getByRole('button', { name: 'Roll back IMP-0001' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AHU-3 was edited after this import (checklist, 1 change). Roll back those first or keep the batch.');
    expect(getState().batches[0].status).toBe('loaded');
  });
  it('View in register presets the Equipment register to the loaded tags', async () => {
    renderWithStore(<><Import /><Equipment /></>);
    await userEvent.click(screen.getByRole('textbox', { name: /paste/i }));
    await userEvent.paste(loadFixtureText('contractor-export.csv'));
    await userEvent.click(screen.getByRole('button', { name: 'Run import' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Load approved rows' }));
    expect(screen.queryByText(/Showing \d+ rows from/)).not.toBeInTheDocument();
    expect(screen.queryByText('Imported')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View in register' }));
    expect(screen.getByText(/Showing 9 rows from IMP-0001/)).toBeInTheDocument();
    expect(screen.getAllByText('Imported')).toHaveLength(9);
    expect(window.location.hash).toBe('#equipment');
  });
  it('resumes a staged batch at Review and restages on mapping change', async () => {
    const state = startSession(seedState(), { source: 'x.csv', origin: 'csv', sheets: [{ sheetName: 'CSV', rows: parseCsv(loadFixtureText('contractor-export.csv')) }] });
    const { getState } = renderWithStore(<Import />, { state });
    expect(screen.getByRole('table', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByText('9 approved')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Map serial' }), 'Not in file');
    expect(getState().batches[0].mapping.serial).toBeNull();
    expect(screen.getByRole('button', { name: 'Updated (1)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Updated (1)' }));
    expect(within(screen.getByRole('table', { name: 'Review' })).getAllByRole('row')).toHaveLength(2);
  });
});

/** Test-only stand-in for a drawer edit: toggles AHU-3's first checklist item through the store. */
function EditAhu3() {
  const { state, change } = useLedger();
  const eq = state.equipment.find((e) => e.tag === 'AHU-3');
  if (!eq) return null;
  return (
    <button onClick={() => change({ entity: 'equipment', op: 'update', key: 'AHU-3', patch: { pfc: [true, ...eq.pfc.slice(1)] } })}>
      edit AHU-3
    </button>
  );
}
