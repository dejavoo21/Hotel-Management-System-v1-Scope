import { useEffect, useRef } from 'react';
import { ArrowRight, Command, Search, X } from 'lucide-react';

export type CommandPaletteItem = {
  id: string;
  name: string;
  href: string;
  section: string;
};

type CommandPaletteProps = {
  open: boolean;
  query: string;
  items: CommandPaletteItem[];
  activeIndex: number;
  workspaceLabel: string;
  onQueryChange: (value: string) => void;
  onActiveIndexChange: (value: number | ((current: number) => number)) => void;
  onSelect: (item: CommandPaletteItem) => void;
  onClose: () => void;
};

export default function CommandPalette({
  open,
  query,
  items,
  activeIndex,
  workspaceLabel,
  onQueryChange,
  onActiveIndexChange,
  onSelect,
  onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onActiveIndexChange((index) => Math.min(index + 1, Math.max(0, items.length - 1)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onActiveIndexChange((index) => Math.max(0, index - 1));
        return;
      }

      if (event.key === 'Enter') {
        const item = items[activeIndex] || items[0];
        if (!item) return;
        event.preventDefault();
        onSelect(item);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, items, onActiveIndexChange, onClose, onSelect, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/35 px-3 py-20 backdrop-blur-sm sm:px-6" role="presentation" onMouseDown={onClose}>
      <div
        className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Command className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Command Palette</p>
            <p className="truncate text-xs text-slate-500">{workspaceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative border-b border-slate-100">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onActiveIndexChange(0);
            }}
            placeholder="Search pages, centers, workflows..."
            className="h-12 w-full border-0 bg-white pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0"
            aria-label="Search commands"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {items.length > 0 ? (
            <div role="listbox" aria-label="Command results">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  onClick={() => onSelect(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    index === activeIndex ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      index === activeIndex ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
                    }`}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className={`truncate text-xs ${index === activeIndex ? 'text-white/70' : 'text-slate-500'}`}>
                      {item.section} / {item.href}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">No commands found</p>
              <p className="mt-1 text-sm text-slate-500">Try another page name, center, or workflow keyword.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
          <span>Use Up/Down to move, Enter to open.</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600">Ctrl K</span>
        </div>
      </div>
    </div>
  );
}
