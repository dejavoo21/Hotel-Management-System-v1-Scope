export type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'bad';

export function pillTone(tone: Tone): string {
  switch (tone) {
    case 'info':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'good':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'warn':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'bad':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

export function cardTone(tone: Tone): string {
  switch (tone) {
    case 'info':
      return 'border-sky-200 bg-sky-50/30';
    case 'good':
      return 'border-emerald-200 bg-emerald-50/30';
    case 'warn':
      return 'border-amber-200 bg-amber-50/30';
    case 'bad':
      return 'border-rose-200 bg-rose-50/30';
    default:
      return 'border-slate-200 bg-white';
  }
}

