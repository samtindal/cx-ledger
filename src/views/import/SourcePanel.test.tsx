// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Import } from '../Import';
import { renderWithStore } from '../../test/render';

afterEach(() => vi.unstubAllGlobals());

describe('AI extraction in the Import view', () => {
  it('Try the sample stages the cached extraction without a network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { getState } = renderWithStore(<Import />);
    await userEvent.click(screen.getByRole('button', { name: 'Try the sample' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    const batch = getState().batches[0];
    expect(batch).toMatchObject({ origin: 'ai-extract', source: 'ahu-schedule.pdf (cached sample)', status: 'staged' });
    const review = await screen.findByRole('table', { name: 'Review' });
    expect(within(review).getAllByText('AI')).toHaveLength(5);
    expect(within(review).getAllByText(/p\. 2 · low confidence/)).toHaveLength(2);
    expect(within(review).getByRole('checkbox', { name: 'Approve row 1' })).toBeChecked();
    expect(within(review).getByRole('checkbox', { name: 'Approve row 5' })).not.toBeChecked();
  });

  it('shows the demo message when live extraction is off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Extraction is turned off' }), { status: 503 })));
    renderWithStore(<Import />);
    const file = new File(['%PDF-1.4'], 'schedule.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Extract from PDF', { selector: 'input' }), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('Live extraction is off in this demo — try the sample.');
  });

  it("shows the server's error text", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'PDF has more than 10 pages.' }), { status: 413 })));
    const { getState } = renderWithStore(<Import />);
    const file = new File(['%PDF-1.4'], 'big.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Extract from PDF', { selector: 'input' }), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF has more than 10 pages.');
    expect(getState().batches).toHaveLength(0);
  });

  it('rejects a PDF over 4 MB before uploading it', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderWithStore(<Import />);
    const file = new File([new Uint8Array(4.5 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Extract from PDF', { selector: 'input' }), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('huge.pdf is larger than 4 MB.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
