import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeHarness() {
  const { theme, background, setTheme, setBackground } = useTheme();
  return (
    <div>
      <span>{theme}</span>
      <span>{background}</span>
      <button type="button" onClick={() => setTheme('dark-mode')}>Use dark mode</button>
      <button type="button" onClick={() => setBackground('tide-lines')}>Use tide lines</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-background');
    document.body.removeAttribute('data-background');
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'laflo:appearance'
        ? JSON.stringify({ version: 1, theme: 'amber-sunset', background: 'sand-wash' })
        : null
    );
  });

  it('applies saved appearance at the document root and updates the whole app selectors', async () => {
    render(<ThemeProvider><ThemeHarness /></ThemeProvider>);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'amber-sunset');
      expect(document.documentElement).toHaveAttribute('data-background', 'sand-wash');
      expect(document.body).toHaveAttribute('data-background', 'sand-wash');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Use dark mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use tide lines' }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark-mode');
      expect(document.documentElement).toHaveAttribute('data-background', 'tide-lines');
      expect(document.body).toHaveAttribute('data-background', 'tide-lines');
    });
  });
});
