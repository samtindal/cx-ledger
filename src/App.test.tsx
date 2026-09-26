// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { renderWithStore } from './test/render';

describe('App shell', () => {
  beforeEach(() => { window.location.hash = ''; });
  it('shows the demo banner and phase', () => {
    renderWithStore(<App />);
    expect(screen.getByText('Demo with sample data. Changes stay in your browser.')).toBeInTheDocument();
    expect(screen.getByText('Acceptance')).toBeInTheDocument();
  });
  it('switches tabs via hash links', async () => {
    renderWithStore(<App />);
    await userEvent.click(screen.getByRole('link', { name: 'Import' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('aria-current', 'page');
  });
  it('shows the About wording', async () => {
    renderWithStore(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText("Inspired by commissioning data work I supported at an engineering firm's commissioning group in 2016.")).toBeInTheDocument();
  });
});
