// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Overview } from './Overview';
import { EquipmentDrawer } from './EquipmentDrawer';
import { renderWithStore } from '../test/render';
import { seedState } from '../data/seed';

describe('Overview', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 26, 12)); });
  afterEach(() => vi.useRealTimers());

  it('shows hand-counted stats', () => {
    renderWithStore(<Overview />, { state: seedState(new Date(2026, 8, 26, 12)) });
    const strip = screen.getByRole('region', { name: 'Summary' });
    expect(within(strip).getByText('27')).toBeInTheDocument();
    expect(within(strip).getByText('18/27')).toBeInTheDocument();
    expect(within(strip).getByText('11/27')).toBeInTheDocument();
    expect(within(strip).getByText('12')).toBeInTheDocument();
    expect(within(strip).getByText('2 critical')).toBeInTheDocument();
    expect(within(strip).getByText('23')).toBeInTheDocument();
  });
  it('shows readiness by system rows', () => {
    renderWithStore(<Overview />, { state: seedState(new Date(2026, 8, 26, 12)) });
    const table = screen.getByRole('table', { name: 'Readiness by system' });
    const air = within(table).getByRole('row', { name: /Air side/ });
    expect(within(air).getByText('87%')).toBeInTheDocument();
    expect(within(air).getByText('3/11')).toBeInTheDocument();
  });
  it('opens the drawer from needs attention', async () => {
    renderWithStore(<><Overview /><EquipmentDrawer /></>, { state: seedState(new Date(2026, 8, 26, 12)) });
    const list = screen.getByRole('list', { name: 'Needs attention' });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('CX-003');
    await userEvent.click(items[0]);
    expect(await screen.findByRole('dialog', { name: /P-3/ })).toBeInTheDocument();
  });
});
