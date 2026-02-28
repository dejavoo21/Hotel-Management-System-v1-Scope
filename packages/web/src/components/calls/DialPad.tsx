import { useMemo, useRef } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  onCall: () => void;
  disabled?: boolean;
  onOpenContacts?: () => void;
};

const KEYS = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
] as const;

export default function DialPad({
  value,
  onChange,
  onCall,
  disabled,
  onOpenContacts,
}: Props) {
  const display = useMemo(() => value || '', [value]);
  const zeroHoldTimerRef = useRef<number | null>(null);
  const backspaceHoldTimerRef = useRef<number | null>(null);
  const zeroLongPressFiredRef = useRef(false);
  const backspaceLongPressFiredRef = useRef(false);

  const append = (ch: string) => onChange((value || '') + ch);
  const onKeyPress = (k: string) => append(k);

  const startHoldZero = () => {
    zeroLongPressFiredRef.current = false;
    zeroHoldTimerRef.current = window.setTimeout(() => {
      zeroLongPressFiredRef.current = true;
      onChange((value || '') + '+');
      zeroHoldTimerRef.current = null;
    }, 450);
  };

  const endHoldZero = () => {
    if (zeroHoldTimerRef.current) {
      window.clearTimeout(zeroHoldTimerRef.current);
      zeroHoldTimerRef.current = null;
    }
    if (!zeroLongPressFiredRef.current) {
      onChange((value || '') + '0');
    }
  };

  const startHoldBackspace = () => {
    backspaceLongPressFiredRef.current = false;
    backspaceHoldTimerRef.current = window.setTimeout(() => {
      backspaceLongPressFiredRef.current = true;
      onChange('');
      backspaceHoldTimerRef.current = null;
    }, 550);
  };

  const endHoldBackspace = () => {
    if (backspaceHoldTimerRef.current) {
      window.clearTimeout(backspaceHoldTimerRef.current);
      backspaceHoldTimerRef.current = null;
    }
    if (!backspaceLongPressFiredRef.current) {
      onChange((value || '').slice(0, -1));
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {onOpenContacts ? (
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Dial pad</div>
            <button
              type="button"
              onClick={onOpenContacts}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Contacts
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            value={display}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter number"
            inputMode="tel"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-xl border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {KEYS.map(([k, sub]) => {
            if (k === '0') {
              return (
                <button
                  key={k}
                  type="button"
                  onMouseDown={startHoldZero}
                  onMouseUp={endHoldZero}
                  onMouseLeave={endHoldZero}
                  onTouchStart={startHoldZero}
                  onTouchEnd={endHoldZero}
                  className="rounded-2xl border border-slate-200 bg-white py-3 text-center hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="text-lg font-semibold text-slate-900">{k}</div>
                  <div className="text-[10px] font-semibold text-slate-400">{sub}</div>
                </button>
              );
            }

            return (
              <button
                key={k}
                type="button"
                onClick={() => onKeyPress(k)}
                className="rounded-2xl border border-slate-200 bg-white py-3 text-center hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="text-lg font-semibold text-slate-900">{k}</div>
                <div className="text-[10px] font-semibold text-slate-400">{sub}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onMouseDown={startHoldBackspace}
            onMouseUp={endHoldBackspace}
            onMouseLeave={endHoldBackspace}
            onTouchStart={startHoldBackspace}
            onTouchEnd={endHoldBackspace}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title="Tap to delete • Hold to clear"
          >
            Backspace
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onCall}
            className="flex-1 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Call
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Tip: hold <span className="font-semibold">0</span> to type <span className="font-semibold">+</span> for external numbers.
        </p>
      </div>
    </div>
  );
}
