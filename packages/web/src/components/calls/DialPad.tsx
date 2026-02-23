import { useRef } from 'react';

type DialKey = { digit: string; letters: string };

type Props = {
  onKeyPress: (digit: string) => void;
  onPlusInsert?: () => void;
};

const KEYPAD: DialKey[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export default function DialPad({ onKeyPress, onPlusInsert }: Props) {
  const zeroHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeroHoldTriggeredRef = useRef(false);

  const startZeroHold = () => {
    zeroHoldTriggeredRef.current = false;
    if (zeroHoldTimerRef.current) clearTimeout(zeroHoldTimerRef.current);
    zeroHoldTimerRef.current = setTimeout(() => {
      zeroHoldTriggeredRef.current = true;
      onPlusInsert?.();
    }, 500);
  };

  const endZeroHold = () => {
    if (zeroHoldTimerRef.current) {
      clearTimeout(zeroHoldTimerRef.current);
      zeroHoldTimerRef.current = null;
    }
  };

  const clickZero = () => {
    if (zeroHoldTriggeredRef.current) {
      zeroHoldTriggeredRef.current = false;
      return;
    }
    onKeyPress('0');
  };

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
      {KEYPAD.map((key) => (
        <button
          key={key.digit}
          type="button"
          aria-label={key.digit === '0' ? 'Dial 0, long press for plus' : `Dial ${key.digit}`}
          onClick={key.digit === '0' ? clickZero : () => onKeyPress(key.digit)}
          onMouseDown={key.digit === '0' ? startZeroHold : undefined}
          onMouseUp={key.digit === '0' ? endZeroHold : undefined}
          onMouseLeave={key.digit === '0' ? endZeroHold : undefined}
          onTouchStart={key.digit === '0' ? startZeroHold : undefined}
          onTouchEnd={key.digit === '0' ? endZeroHold : undefined}
          className="group inline-flex h-[60px] flex-col items-center justify-center rounded-2xl border border-border bg-card text-text-main shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          <span className="text-[22px] font-semibold leading-none tracking-tight tabular-nums">
            {key.digit}
          </span>
          <span className="mt-0.5 min-h-[10px] text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            {key.letters}
          </span>
        </button>
      ))}
    </div>
  );
}
