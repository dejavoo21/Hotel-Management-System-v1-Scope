import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppearancePanel from './AppearancePanel';
import type { ThemeName } from '@/theme/ThemeProvider';
import type { BackgroundName } from '@/theme/appearance';

function StatefulPanel() {
  const [theme, setTheme] = useState<ThemeName>('ocean-blue');
  const [background, setBackground] = useState<BackgroundName>('sand-wash');

  return (
    <AppearancePanel
      theme={theme}
      background={background}
      isDirty={theme !== 'ocean-blue' || background !== 'sand-wash'}
      onThemeChange={setTheme}
      onBackgroundChange={setBackground}
      onSave={vi.fn()}
      onReset={vi.fn()}
    />
  );
}

describe('AppearancePanel', () => {
  it('renders accessible theme and background choices with the current summary', () => {
    render(<StatefulPanel />);

    expect(screen.getByText('Ocean Blue + Sand Wash')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Ocean Blue/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Sand Wash/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Ocean Blue/ })).toHaveClass('border-primary-500');
    expect(screen.getByRole('radio', { name: /Sand Wash/ })).toHaveClass('border-primary-500');
    expect(document.querySelectorAll('.appearance-background-preview')).toHaveLength(6);
    expect(document.querySelector('.appearance-background-preview--mist-gradient')).toBeInTheDocument();
    expect(document.querySelector('.appearance-background-preview--linen-pattern')).toBeInTheDocument();
    expect(document.querySelector('.appearance-background-preview--soft-glow')).toBeInTheDocument();
    expect(document.querySelector('.appearance-background-preview--dusk-horizon')).toBeInTheDocument();
    expect(document.querySelector('.appearance-background-preview--sand-wash')).toBeInTheDocument();
    expect(document.querySelector('.appearance-background-preview--tide-lines')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save appearance/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save appearance/i })).toHaveClass('w-full');
    expect(screen.getByRole('button', { name: /Reset to default/i })).toHaveClass('w-full');
  });

  it('updates the summary and dirty state when a choice changes', () => {
    render(<StatefulPanel />);

    fireEvent.click(screen.getByRole('radio', { name: /LaFlo Green/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Tide Lines/ }));

    expect(screen.getByText('LaFlo Green + Tide Lines')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save appearance/i })).toBeEnabled();
  });

  it('exposes save and reset actions', () => {
    const onSave = vi.fn();
    const onReset = vi.fn();

    render(
      <AppearancePanel
        theme="amber-sunset"
        background="soft-glow"
        isDirty
        onThemeChange={vi.fn()}
        onBackgroundChange={vi.fn()}
        onSave={onSave}
        onReset={onReset}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Save appearance/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reset to default/i }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });
});
