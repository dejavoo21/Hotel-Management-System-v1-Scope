import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { BACKGROUNDS, THEMES } from './appearance';

function ThemeHarness() {
  const { theme, background, setTheme, setBackground } = useTheme();
  return (
    <div>
      <span>{theme}</span>
      <span>{background}</span>
      <button type="button" onClick={() => setTheme('midnight-dark')}>Use dark mode</button>
      <button type="button" onClick={() => setBackground('tide-lines')}>Use tide lines</button>
      {THEMES.map((value) => (
        <button type="button" key={value} onClick={() => setTheme(value)}>
          Theme {value}
        </button>
      ))}
      {BACKGROUNDS.map((value) => (
        <button type="button" key={value} onClick={() => setBackground(value)}>
          Background {value}
        </button>
      ))}
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
      expect(document.documentElement).toHaveAttribute('data-theme', 'midnight-dark');
      expect(document.documentElement).toHaveAttribute('data-background', 'tide-lines');
      expect(document.body).toHaveAttribute('data-background', 'tide-lines');
    });
  });

  it('applies every supported theme and background through document-level selectors', async () => {
    render(<ThemeProvider><ThemeHarness /></ThemeProvider>);

    for (const theme of THEMES) {
      fireEvent.click(screen.getByRole('button', { name: `Theme ${theme}` }));
      await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', theme));
    }

    for (const background of BACKGROUNDS) {
      fireEvent.click(screen.getByRole('button', { name: `Background ${background}` }));
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-background', background);
        expect(document.body).toHaveAttribute('data-background', background);
      });
    }
  });
});
