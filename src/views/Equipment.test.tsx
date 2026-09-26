// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Equipment } from './Equipment';
import { renderWithStore } from '../test/render';

describe('Equipment register', () => {
  it('lists units with nameplates and filters by search', async () => {
    renderWithStore(<Equipment />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(28); // header + 27
    await userEvent.type(screen.getByRole('searchbox', { name: /search/i }), 'greenheck');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });
  it('copies CSV to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithStore(<Equipment />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy as CSV' }));
    expect(writeText.mock.calls[0][0]).toMatch(/^Tag,Description/);
  });
  it('falls back to a selected textarea when the clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    renderWithStore(<Equipment />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy as CSV' }));
    const ta = await screen.findByRole('textbox', { name: /csv/i });
    expect((ta as HTMLTextAreaElement).value).toMatch(/^Tag,Description/);
  });
});
