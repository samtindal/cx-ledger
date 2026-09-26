// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('App shell', () => {
  beforeEach(() => { window.location.hash = ''; });
  it('shows the demo banner and phase', () => {
    render(<App />);
    expect(screen.getByText('Demo with sample data. Changes stay in your browser.')).toBeInTheDocument();
    expect(screen.getByText('Acceptance')).toBeInTheDocument();
  });
  it('switches tabs via hash links', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: 'Import' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('aria-current', 'page');
  });
  it('shows the About wording', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText("Inspired by commissioning data work I supported at an engineering firm's commissioning group in 2016.")).toBeInTheDocument();
  });
});
