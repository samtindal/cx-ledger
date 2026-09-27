// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EquipmentDrawer } from './EquipmentDrawer';
import { renderWithStore } from '../test/render';
import { useUi } from '../state/store';
import { useEffect } from 'react';

function Open({ tag }: { tag: string }) {
  const { setOpenTag } = useUi();
  useEffect(() => setOpenTag(tag), [tag, setOpenTag]);
  return <EquipmentDrawer />;
}

describe('EquipmentDrawer', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 26, 12)); });
  afterEach(() => vi.useRealTimers());

  it('toggles a checklist item through applyChange', async () => {
    const { getState } = renderWithStore(<Open tag="EF-1" />);
    const dialog = await screen.findByRole('dialog', { name: /EF-1/ });
    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes).toHaveLength(6);
    await userEvent.click(boxes[5]);
    expect(getState().equipment.find((e) => e.tag === 'EF-1')!.pfc.every(Boolean)).toBe(true);
    expect(getState().changes.at(-1)).toMatchObject({ key: 'EF-1', field: 'pfc', batchId: null });
    expect(within(dialog).getByText('checklist: 5/6 → 6/6')).toBeInTheDocument();
  });
  it('logs and closes issues', async () => {
    const { getState } = renderWithStore(<Open tag="P-3" />);
    const dialog = await screen.findByRole('dialog', { name: /P-3/ });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /issue description/i }), 'Gauge missing');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /severity/i }), 'Minor');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /trade/i }), 'Mechanical');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log issue' }));
    expect(getState().issues.find((i) => i.id === 'CX-017')).toMatchObject({ tag: 'P-3', opened: '2026-09-26', closed: null });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close CX-003' }));
    expect(getState().issues.find((i) => i.id === 'CX-003')!.closed).toBe('2026-09-26');
  });
  it('closes on Escape', async () => {
    renderWithStore(<Open tag="AHU-1" />);
    await screen.findByRole('dialog');
    await act(async () => { await userEvent.keyboard('{Escape}'); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('ignores a second drop while attaching, with blob keys independent of IDs', async () => {
    const { getState, container } = renderWithStore(<Open tag="EF-1" />);
    const dialog = await screen.findByRole('dialog', { name: /EF-1/ });
    const zone = within(dialog).getByRole('button', { name: 'Add documents for EF-1' }).closest('.drop-zone')!;
    const files = [new File(['%PDF-1.4'], 'EF-1_Startup.pdf', { type: 'application/pdf' })];
    fireEvent.drop(zone, { dataTransfer: { files } });
    fireEvent.drop(zone, { dataTransfer: { files } });
    await waitFor(() => expect(getState().documents).toHaveLength(4));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(container.innerHTML.length).toBeGreaterThan(0);
    const docs = getState().documents;
    expect(docs).toHaveLength(4);
    expect(docs.at(-1)).toMatchObject({ id: 'DOC-0004', tag: 'EF-1', matchedBy: 'manual' });
    expect(docs.at(-1)!.blobKey).not.toBe('DOC-0004');
  });
});
