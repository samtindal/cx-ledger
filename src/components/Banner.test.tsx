// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Banner } from './Banner';
import { renderWithStore } from '../test/render';
import { seedState } from '../data/seed';

describe('Banner reset', () => {
  it('needs two clicks and restores the seed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const dirty = seedState();
    dirty.equipment = dirty.equipment.slice(1);
    const { getState } = renderWithStore(<Banner onAbout={() => {}} />, { state: dirty });
    await userEvent.click(screen.getByRole('button', { name: 'Reset demo data' }));
    expect(getState().equipment).toHaveLength(26);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reset everything' }));
    await waitFor(() => expect(getState().equipment).toHaveLength(27)); // reset is async (reset hooks)
    expect(confirmSpy).not.toHaveBeenCalled();
  });
  it('can cancel', async () => {
    renderWithStore(<Banner onAbout={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset demo data' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Reset demo data' })).toBeInTheDocument();
  });
});
