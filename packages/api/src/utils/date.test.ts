/**
 * Date Utility Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  diffInDays,
  format,
  parseDate,
  isToday,
  isPast,
  isFuture,
  getDateRange,
  calculateNights,
} from './date.js';

describe('Date Utilities', () => {
  describe('startOfDay', () => {
    it('should return date with time set to 00:00:00.000', () => {
      const date = new Date('2024-06-15T14:30:45.123Z');
      const result = startOfDay(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should not mutate the original date', () => {
      const date = new Date('2024-06-15T14:30:45.123Z');
      const originalTime = date.getTime();
      startOfDay(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe('endOfDay', () => {
    it('should return date with time set to 23:59:59.999', () => {
      const date = new Date('2024-06-15T14:30:45.123Z');
      const result = endOfDay(date);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should not mutate the original date', () => {
      const date = new Date('2024-06-15T14:30:45.123Z');
      const originalTime = date.getTime();
      endOfDay(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe('startOfMonth', () => {
    it('should return first day of the month', () => {
      const date = new Date('2024-06-15');
      const result = startOfMonth(date);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(5); // June (0-indexed)
      expect(result.getFullYear()).toBe(2024);
    });

    it('should handle end of month input', () => {
      const date = new Date('2024-06-30');
      const result = startOfMonth(date);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(5);
    });
  });

  describe('endOfMonth', () => {
    it('should return last day of the month', () => {
      const date = new Date('2024-06-15');
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(30); // June has 30 days
      expect(result.getMonth()).toBe(5);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
    });

    it('should handle February in leap year', () => {
      const date = new Date('2024-02-15');
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(29); // 2024 is a leap year
      expect(result.getMonth()).toBe(1);
    });

    it('should handle February in non-leap year', () => {
      const date = new Date('2023-02-15');
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(28);
      expect(result.getMonth()).toBe(1);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2024-06-15');
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(5);
    });

    it('should handle month boundary', () => {
      const date = new Date('2024-06-28');
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(3);
      expect(result.getMonth()).toBe(6); // July
    });

    it('should not mutate the original date', () => {
      const date = new Date('2024-06-15');
      const originalDate = date.getDate();
      addDays(date, 5);

      expect(date.getDate()).toBe(originalDate);
    });
  });

  describe('subDays', () => {
    it('should subtract days', () => {
      const date = new Date('2024-06-15');
      const result = subDays(date, 5);

      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(5);
    });

    it('should handle month boundary', () => {
      const date = new Date('2024-06-03');
      const result = subDays(date, 5);

      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(4); // May
    });
  });

  describe('diffInDays', () => {
    it('should calculate positive difference', () => {
      const date1 = new Date('2024-06-20');
      const date2 = new Date('2024-06-15');

      expect(diffInDays(date1, date2)).toBe(5);
    });

    it('should calculate negative difference', () => {
      const date1 = new Date('2024-06-15');
      const date2 = new Date('2024-06-20');

      expect(diffInDays(date1, date2)).toBe(-5);
    });

    it('should return 0 for same day', () => {
      const date1 = new Date('2024-06-15');
      const date2 = new Date('2024-06-15');

      expect(diffInDays(date1, date2)).toBe(0);
    });
  });

  describe('format', () => {
    it('should format date with yyyy-MM-dd pattern', () => {
      const date = new Date('2024-06-15T14:30:45');
      const result = format(date, 'yyyy-MM-dd');

      expect(result).toBe('2024-06-15');
    });

    it('should format date with HH:mm:ss pattern', () => {
      const date = new Date('2024-06-15T14:30:45');
      const result = format(date, 'HH:mm:ss');

      expect(result).toBe('14:30:45');
    });

    it('should format date with full pattern', () => {
      const date = new Date('2024-06-15T09:05:03');
      const result = format(date, 'yyyy-MM-dd HH:mm:ss');

      expect(result).toBe('2024-06-15 09:05:03');
    });

    it('should pad single digits with zeros', () => {
      const date = new Date('2024-01-05T03:02:01');
      const result = format(date, 'yyyy-MM-dd HH:mm:ss');

      expect(result).toBe('2024-01-05 03:02:01');
    });
  });

  describe('parseDate', () => {
    it('should parse ISO date string', () => {
      const result = parseDate('2024-06-15T14:30:45.000Z');

      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(5);
      expect(result.getUTCDate()).toBe(15);
    });

    it('should parse simple date string', () => {
      const result = parseDate('2024-06-15');

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = subDays(new Date(), 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = addDays(new Date(), 1);
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe('isPast', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date('2020-01-01');
      expect(isPast(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date('2030-01-01');
      expect(isPast(futureDate)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('should return true for future dates', () => {
      const futureDate = new Date('2030-01-01');
      expect(isFuture(futureDate)).toBe(true);
    });

    it('should return false for past dates', () => {
      const pastDate = new Date('2020-01-01');
      expect(isFuture(pastDate)).toBe(false);
    });
  });

  describe('getDateRange', () => {
    it('should return array of dates between start and end', () => {
      const start = new Date('2024-06-15');
      const end = new Date('2024-06-18');
      const result = getDateRange(start, end);

      expect(result).toHaveLength(4);
      expect(result[0].getDate()).toBe(15);
      expect(result[1].getDate()).toBe(16);
      expect(result[2].getDate()).toBe(17);
      expect(result[3].getDate()).toBe(18);
    });

    it('should return single date when start equals end', () => {
      const date = new Date('2024-06-15');
      const result = getDateRange(date, date);

      expect(result).toHaveLength(1);
      expect(result[0].getDate()).toBe(15);
    });

    it('should return empty array when end is before start', () => {
      const start = new Date('2024-06-18');
      const end = new Date('2024-06-15');
      const result = getDateRange(start, end);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateNights', () => {
    it('should calculate nights between check-in and check-out', () => {
      const checkIn = new Date('2024-06-15');
      const checkOut = new Date('2024-06-18');

      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });

    it('should return 0 for same day checkout', () => {
      const checkIn = new Date('2024-06-15');
      const checkOut = new Date('2024-06-15');

      expect(calculateNights(checkIn, checkOut)).toBe(0);
    });

    it('should return 0 when checkout is before checkin', () => {
      const checkIn = new Date('2024-06-18');
      const checkOut = new Date('2024-06-15');

      expect(calculateNights(checkIn, checkOut)).toBe(0);
    });

    it('should calculate single night stay', () => {
      const checkIn = new Date('2024-06-15');
      const checkOut = new Date('2024-06-16');

      expect(calculateNights(checkIn, checkOut)).toBe(1);
    });
  });
});
