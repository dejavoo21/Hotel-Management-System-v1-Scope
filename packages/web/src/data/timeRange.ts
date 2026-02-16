export type TimeRange = '7d' | '30d' | '3m' | '6m' | '1y';

export type DateRange = { startDate: string; endDate: string };

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function timeRangeToDateRange(timeRange: TimeRange, now = new Date()): DateRange {
  const end = new Date(now);
  const start = new Date(now);

  if (timeRange === '7d') start.setDate(start.getDate() - 6);
  if (timeRange === '30d') start.setDate(start.getDate() - 29);
  if (timeRange === '3m') start.setDate(start.getDate() - 89);
  if (timeRange === '6m') start.setDate(start.getDate() - 179);
  if (timeRange === '1y') start.setDate(start.getDate() - 364);

  return { startDate: toISODate(start), endDate: toISODate(end) };
}

export function timeRangeLabel(timeRange: TimeRange) {
  if (timeRange === '7d') return 'Last 7 Days';
  if (timeRange === '30d') return 'Last 30 Days';
  if (timeRange === '3m') return 'Last 3 Months';
  if (timeRange === '6m') return 'Last 6 Months';
  return 'This Year';
}
