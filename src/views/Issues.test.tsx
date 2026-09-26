// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Issues } from './Issues';
import { renderWithStore } from '../test/render';

describe('Issues view', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 26, 12)); });
  afterEach(() => vi.useRealTimers());
  it('creates CX-017 from the New issue form', async () => {
    const { getState } = renderWithStore(<Issues />);
    const form = screen.getByRole('form', { name: 'New issue' });
    await userEvent.selectOptions(within(form).getByRole('combobox', { name: 'Tag' }), 'CH-1');
    await userEvent.type(within(form).getByRole('textbox', { name: 'Issue' }), 'Low delta T');
    await userEvent.selectOptions(within(form).getByRole('combobox', { name: 'Severity' }), 'Major');
    await userEvent.selectOptions(within(form).getByRole('combobox', { name: 'Trade' }), 'Controls');
    await userEvent.click(within(form).getByRole('button', { name: 'Add issue' }));
    expect(getState().issues.at(-1)).toMatchObject({ id: 'CX-017', tag: 'CH-1', severity: 'Major', opened: '2026-09-26' });
  });
  it('shows the empty-state reason', async () => {
    renderWithStore(<Issues />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter severity' }), 'Critical');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter trade' }), 'Mechanical');
    expect(screen.getByText('No open Critical issues for Mechanical.')).toBeInTheDocument();
  });
});
