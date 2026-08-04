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
        ? JSON.stringify({ version: 1, theme: 'ocean', background: 'sand' })
        : null
    );

    expect(readAppearancePreferences()).toEqual({ theme: 'ocean', background: 'sand' });
  });

  it('stores a versioned preference payload', () => {
    saveAppearancePreferences({ theme: 'amber', background: 'dusk' });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'laflo:appearance',
      JSON.stringify({ version: 1, theme: 'amber', background: 'dusk' })
    );
  });
});
