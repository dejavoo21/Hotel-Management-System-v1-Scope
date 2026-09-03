import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  readAppearancePreferences,
  saveAppearancePreferences,
} from './appearance';

describe('appearance preferences', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('returns defaults for missing or invalid preferences', () => {
    expect(readAppearancePreferences()).toEqual(DEFAULT_APPEARANCE);

    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'laflo:appearance' ? '{invalid' : null
    );
    expect(readAppearancePreferences()).toEqual(DEFAULT_APPEARANCE);
  });

  it('reads valid saved preferences', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'laflo:appearance'
        ? JSON.stringify({ version: 1, theme: 'ocean-blue', background: 'sand-wash' })
        : null
    );

    expect(readAppearancePreferences()).toEqual({ theme: 'ocean-blue', background: 'sand-wash' });
  });

  it('migrates legacy appearance identifiers', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'laflo:appearance'
        ? JSON.stringify({ version: 1, theme: 'ocean', background: 'sand' })
        : null
    );

    expect(readAppearancePreferences()).toEqual({ theme: 'ocean-blue', background: 'sand-wash' });
  });

  it('migrates the previous production theme identifiers', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'laflo:appearance'
        ? JSON.stringify({ version: 1, theme: 'dark-mode', background: 'mist-gradient' })
        : null
    );

    expect(readAppearancePreferences()).toEqual({ theme: 'midnight-dark', background: 'mist-gradient' });
  });

  it('stores a versioned preference payload', () => {
    saveAppearancePreferences({ theme: 'amber-sunset', background: 'dusk-horizon' });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'laflo:appearance',
      JSON.stringify({ version: 1, theme: 'amber-sunset', background: 'dusk-horizon' })
    );
    expect(localStorage.setItem).toHaveBeenCalledWith('laflo-theme', 'amber-sunset');
    expect(localStorage.setItem).toHaveBeenCalledWith('laflo-background', 'dusk-horizon');
  });
});
