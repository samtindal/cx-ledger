// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Documents } from './Documents';
import { renderWithStore } from '../test/render';

const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

describe('Documents', () => {
  it('previews matches before saving, then files them', async () => {
    const { getState } = renderWithStore(<Documents />);
    const input = screen.getByLabelText('Add documents', { selector: 'input' });
    await userEvent.upload(input, [pdf('AHU-2_TAB_Report.pdf'), pdf('AHU-1 and AHU-2 filters.pdf'), pdf('Mech_Schedules_M-601.pdf')]);
    const preview = screen.getByRole('table', { name: 'Intake preview' });
    expect(within(preview).getAllByRole('row')).toHaveLength(4);
    expect(getState().documents).toHaveLength(3); // nothing saved yet
    await userEvent.click(screen.getByRole('button', { name: 'Save 3 files' }));
    await waitFor(() => expect(getState().documents).toHaveLength(6));
    const queue = screen.getByRole('region', { name: 'Unassigned queue' });
    expect(within(queue).getAllByRole('combobox')).toHaveLength(2);
    await userEvent.selectOptions(within(queue).getByRole('combobox', { name: 'Tag for AHU-1 and AHU-2 filters.pdf' }), 'AHU-1');
    expect(getState().documents.find((d) => d.filename.startsWith('AHU-1 and'))).toMatchObject({ tag: 'AHU-1', matchedBy: 'manual' });
  });
});
